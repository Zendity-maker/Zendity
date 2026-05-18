import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { redistributeUncoveredColors } from '@/lib/shift-redistribute';
import { logError, logWarn } from '@/lib/logger';
import type { ShiftT } from '@/lib/shift-coverage';

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
        logError('care.supervisor.uncovered_colors.get', err);
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

        const result = await redistributeUncoveredColors({
            hqId,
            shiftType: shiftType as ShiftT,
            color,
            trigger: 'MANUAL',
        });

        if (result.error) {
            return NextResponse.json({ success: false, error: result.error.message }, { status: result.error.status });
        }

        if (result.overridesCreated.length === 0) {
            return NextResponse.json({
                success: true,
                residentsRedistributed: 0,
                alreadyRedistributed: result.alreadyRedistributedCount,
                message: result.alreadyRedistributedCount > 0
                    ? `Los residentes del Grupo ${colorLabel} ya están redistribuidos (${result.alreadyRedistributedCount}).`
                    : `Sin residentes pendientes en el Grupo ${colorLabel}.`,
            });
        }

        // Audit trail (best-effort) — caller-specific metadata
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: result.overridesCreated[0].id,
                    action: 'SHIFT_REDISTRIBUTE' as any,
                    performedById: markedById,
                    payloadChanges: {
                        trigger: 'MANUAL_UNCOVERED_COLOR',
                        color,
                        shiftType,
                        redistributedCount: result.overridesCreated.length,
                        overrideIds: result.overridesCreated.map(o => o.id),
                    } as any,
                },
            });
        } catch (e) { logWarn('care.supervisor.uncovered_colors.audit', e, { hqId, color, shiftType }); }

        const distribution = result.overridesCreated.reduce<Array<{ caregiver: string; count: number }>>((acc, ov) => {
            const existing = acc.find(d => d.caregiver === ov.caregiverName);
            if (existing) existing.count++;
            else acc.push({ caregiver: ov.caregiverName, count: 1 });
            return acc;
        }, []);

        return NextResponse.json({
            success: true,
            residentsRedistributed: result.overridesCreated.length,
            distribution,
            message: `${result.overridesCreated.length} residente${result.overridesCreated.length === 1 ? '' : 's'} del Grupo ${colorLabel} distribuido${result.overridesCreated.length === 1 ? '' : 's'} entre ${distribution.length} cuidadora${distribution.length === 1 ? '' : 's'}.`,
        });

    } catch (err: any) {
        logError('care.supervisor.uncovered_colors.post', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
