import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { computeShiftCoverage, type ShiftT } from '@/lib/shift-coverage';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/uncovered-colors?hqId=X
 *
 * Detecta grupos de color del turno actual que no tienen cuidadora con sesión activa.
 * Retorna los grupos sin cobertura y las cuidadoras activas disponibles para redistribuir.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId') || auth.headquartersId;

        // Usar UTC midnight — los shifts se guardan como 2026-05-11T00:00:00.000Z.
        // setHours(0,0,0,0) en servidor UTC-4 produce 04:00 UTC, excluyendo esos shifts.
        const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);
        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);

        // Turno activo según hora PR
        const prHour = parseInt(
            new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico' })
                .format(new Date()), 10
        ) % 24;
        const activeShiftType = prHour >= 22 || prHour < 6 ? 'NIGHT' : prHour >= 14 ? 'EVENING' : 'MORNING';

        // Turnos programados para el turno activo de hoy (publicados, no ausentes)
        const scheduledShifts = await prisma.scheduledShift.findMany({
            where: {
                date: { gte: todayStart, lte: todayEnd },
                shiftType: activeShiftType,
                isAbsent: false,
                schedule: { headquartersId: hqId, status: 'PUBLISHED' },
                colorGroup: { not: null },
            },
            select: { userId: true, colorGroup: true, user: { select: { name: true } } }
        });

        // Cuidadoras con sesión activa ahora
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                actualEndTime: null,
                startTime: { gte: fourteenHrsAgo },
                caregiver: { headquartersId: hqId, role: 'CAREGIVER' }
            },
            select: { caregiverId: true, startTime: true, caregiver: { select: { name: true } } }
        });
        const activeIds = new Set(activeSessions.map(s => s.caregiverId));

        // Detectar colores sin sesión activa
        const uncoveredColors: { color: string; assignedCaregiverName: string; assignedCaregiver: string }[] = [];
        const seenColors = new Set<string>();

        for (const shift of scheduledShifts) {
            if (!shift.colorGroup || shift.colorGroup === 'ALL' || shift.colorGroup === 'UNASSIGNED') continue;
            if (seenColors.has(shift.colorGroup)) continue;
            seenColors.add(shift.colorGroup);

            if (!activeIds.has(shift.userId)) {
                uncoveredColors.push({
                    color: shift.colorGroup,
                    assignedCaregiver: shift.userId,
                    assignedCaregiverName: shift.user?.name || 'Desconocida',
                });
            }
        }

        // Cuidadoras activas con su color asignado (para mostrar quiénes pueden recibir)
        const activeCaregivers = activeSessions.map(s => ({
            id: s.caregiverId,
            name: s.caregiver?.name || 'Cuidadora',
        }));

        return NextResponse.json({ success: true, activeShiftType, uncoveredColors, activeCaregivers });

    } catch (err: any) {
        console.error('[uncovered-colors GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/care/supervisor/uncovered-colors
 *
 * Redistribuye los residentes de un color sin cobertura entre las cuidadoras activas.
 * Usa computeShiftCoverage para idempotencia: solo procesa residentes que NO tienen
 * un ShiftPatientOverride activo todavía. Previene duplicados al tocar el botón
 * múltiples veces.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: markedById, headquartersId: hqId } = auth;
        const { color, shiftType } = await req.json();

        if (!color || !shiftType) {
            return NextResponse.json({ success: false, error: 'color y shiftType son requeridos' }, { status: 400 });
        }
        if (!['MORNING', 'EVENING', 'NIGHT'].includes(shiftType)) {
            return NextResponse.json({ success: false, error: 'shiftType inválido' }, { status: 400 });
        }

        const colorLabels: Record<string, string> = { RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde' };
        const colorLabel = colorLabels[color] || color;

        // Una sola fuente de verdad: computeShiftCoverage ya excluye los pacientes
        // con override activo. Por eso usa ESTE helper en vez de queries propias.
        const coverage = await computeShiftCoverage({ hqId, shiftType: shiftType as ShiftT });

        // Residentes del color solicitado que aún NO tienen override.
        const pendingResidents = coverage.uncoveredPatients.filter(p => p.colorGroup === color);

        if (pendingResidents.length === 0) {
            // O no hay residentes con ese color, o todos ya están redistribuidos.
            // En cualquiera de los dos casos no hay nada que hacer — mensaje claro.
            const alreadyDoneCount = coverage.activeOverrides.filter(o => o.originalColor === color).length;
            return NextResponse.json({
                success: true,
                residentsRedistributed: 0,
                alreadyRedistributed: alreadyDoneCount,
                message: alreadyDoneCount > 0
                    ? `Los residentes del Grupo ${colorLabel} ya están redistribuidos (${alreadyDoneCount}).`
                    : `Sin residentes pendientes en el Grupo ${colorLabel}.`,
            });
        }

        const recipients = coverage.activeCaregivers.filter(c => c.color);
        if (recipients.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No hay cuidadoras activas con color asignado para redistribuir',
            }, { status: 400 });
        }

        const now = new Date();
        const shiftDate = new Date(); shiftDate.setHours(0, 0, 0, 0);

        // Round-robin sobre receptores con check de duplicado por residente.
        type Override = { id: string; patientId: string; patientName: string; caregiverId: string; caregiverName: string };
        const overridesCreated: Override[] = [];
        const notifyByCaregiver = new Map<string, string[]>();

        for (let i = 0; i < pendingResidents.length; i++) {
            const patient = pendingResidents[i];
            const recipient = recipients[i % recipients.length];

            // Defensa adicional: aunque coverage.uncoveredPatients ya filtra
            // overrides, validamos por si pasó algo concurrente entre lecturas.
            const dupe = await prisma.shiftPatientOverride.findFirst({
                where: {
                    patientId: patient.patientId,
                    shiftDate: { gte: shiftDate, lt: new Date(shiftDate.getTime() + 24 * 3600000) },
                    shiftType,
                    isActive: true,
                },
                select: { id: true },
            });
            if (dupe) continue;

            const override = await prisma.shiftPatientOverride.create({
                data: {
                    headquartersId: hqId,
                    patientId: patient.patientId,
                    originalColor: color,
                    assignedColor: recipient.color || color,
                    caregiverId: recipient.userId,
                    shiftDate,
                    shiftType,
                    reason: 'ABSENCE_REDISTRIB',
                    autoAssigned: false,
                    isActive: true,
                },
            });

            overridesCreated.push({
                id: override.id,
                patientId: patient.patientId,
                patientName: patient.name,
                caregiverId: recipient.userId,
                caregiverName: recipient.name,
            });

            if (!notifyByCaregiver.has(recipient.userId)) notifyByCaregiver.set(recipient.userId, []);
            notifyByCaregiver.get(recipient.userId)!.push(patient.name);
        }

        if (overridesCreated.length === 0) {
            return NextResponse.json({
                success: true,
                residentsRedistributed: 0,
                message: `Sin cambios. Los residentes del Grupo ${colorLabel} ya están cubiertos.`,
            });
        }

        // Notificar receptores (una por cuidadora con la lista completa)
        await Promise.all(
            Array.from(notifyByCaregiver.entries()).map(([cgId, names]) =>
                notifyUser(cgId, {
                    type: 'SHIFT_ALERT',
                    title: `Cobertura adicional — Grupo ${colorLabel}`,
                    message: `Se te asignaron ${names.length} residente${names.length === 1 ? '' : 's'} del Grupo ${colorLabel} por ausencia: ${names.join(', ')}.`,
                    link: '/care',
                }).catch(e => console.error('[uncovered-colors notifyUser]', e))
            )
        );

        // Notificar supervisión (agregado)
        try {
            const distribLine = Array.from(notifyByCaregiver.entries())
                .map(([cgId, names]) => {
                    const r = recipients.find(x => x.userId === cgId);
                    return `${r?.name || 'Cuidadora'} (${names.length})`;
                })
                .join(', ');
            await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'SHIFT_ALERT',
                title: `Grupo ${colorLabel} redistribuido (manual)`,
                message: `${overridesCreated.length} residente${overridesCreated.length === 1 ? '' : 's'} distribuido${overridesCreated.length === 1 ? '' : 's'}: ${distribLine}.`,
                link: '/care/supervisor',
            });
        } catch (e) {
            console.error('[uncovered-colors notifyRoles]', e);
        }

        // Audit trail mínimo (best-effort)
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: overridesCreated[0].id,
                    action: 'SHIFT_REDISTRIBUTE' as any,
                    performedById: markedById,
                    payloadChanges: {
                        trigger: 'MANUAL_UNCOVERED_COLOR',
                        color,
                        shiftType,
                        shiftDate: shiftDate.toISOString(),
                        redistributedCount: overridesCreated.length,
                        overrideIds: overridesCreated.map(o => o.id),
                    } as any,
                },
            });
        } catch (e) { console.error('[uncovered-colors audit]', e); }

        // void unused var (markedById ya está usado en audit + assignedBy si lo necesitaras)
        void now;

        const distribution = Array.from(notifyByCaregiver.entries()).map(([cgId, names]) => {
            const r = recipients.find(x => x.userId === cgId);
            return { caregiver: r?.name || 'Cuidadora', count: names.length };
        });

        return NextResponse.json({
            success: true,
            residentsRedistributed: overridesCreated.length,
            distribution,
            message: `${overridesCreated.length} residente${overridesCreated.length === 1 ? '' : 's'} del Grupo ${colorLabel} distribuido${overridesCreated.length === 1 ? '' : 's'} entre ${distribution.length} cuidadora${distribution.length === 1 ? '' : 's'}.`,
        });

    } catch (err: any) {
        console.error('[uncovered-colors POST]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
