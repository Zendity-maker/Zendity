import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError, logWarn } from '@/lib/logger';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';
import { type ShiftT } from '@/lib/shift-coverage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * POST /api/care/supervisor/assign-color
 *
 * Asignación top-down explícita: el supervisor elige UN caregiver activo
 * y le asigna TODOS los residentes ACTIVE de un color específico vía
 * ShiftPatientOverride. Alternativa al round-robin automático de
 * /api/care/shift/redistribute — útil cuando el supervisor quiere
 * consolidar cobertura en una persona específica (más experimentada,
 * mejor relación con esos residentes, etc.) en lugar de distribuir.
 *
 * Body: { color, shiftType, targetCaregiverId }
 *
 * Comportamiento:
 *   - Valida que targetCaregiverId tenga sesión activa en HQ.
 *   - Para cada residente ACTIVE del color en HQ:
 *     • Si tiene override activo al MISMO caregiver → skip (idempotente).
 *     • Si tiene override activo a OTRO caregiver → mark isActive=false +
 *       resolvedAt=now en el viejo, crea nuevo a target.
 *     • Si no tiene override → crea nuevo a target.
 *   - Notifica al target con la lista NUEVA (no spammear con los que
 *     ya tenía cubiertos).
 *   - Notifica a supervisores con resumen.
 *   - Audit log con conteos.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerId = auth.id;
        const invokerName = auth.name || 'Supervisor';
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const color: string | undefined = body.color;
        const shiftType: ShiftT | undefined = body.shiftType;
        const targetCaregiverId: string | undefined = body.targetCaregiverId;

        if (!color || !shiftType || !targetCaregiverId) {
            return NextResponse.json(
                { success: false, error: 'color, shiftType y targetCaregiverId son requeridos' },
                { status: 400 }
            );
        }
        if (!['MORNING', 'EVENING', 'NIGHT'].includes(shiftType)) {
            return NextResponse.json({ success: false, error: 'shiftType inválido' }, { status: 400 });
        }

        // ── Validar caregiver target — debe tener sesión activa en HQ ──
        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const targetSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId: targetCaregiverId,
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: fourteenHrsAgo },
            },
            include: { caregiver: { select: { id: true, name: true } } },
        });
        if (!targetSession) {
            return NextResponse.json(
                { success: false, error: 'La cuidadora seleccionada no tiene sesión activa en esta sede' },
                { status: 400 }
            );
        }
        const targetName = targetSession.caregiver?.name || 'Cuidadora';

        // ── Residentes ACTIVE del color en HQ ──
        const residents = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE', colorGroup: color as any },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        if (residents.length === 0) {
            return NextResponse.json({
                success: true,
                created: 0,
                reassigned: 0,
                alreadyAssigned: 0,
                target: { id: targetCaregiverId, name: targetName },
                message: `Sin residentes ACTIVE en el Grupo ${color}.`,
            });
        }

        // ── Rango de fecha del turno (día clínico AST) ──
        const scheduledDayRange = clinicalDayCalendarUTCRange();
        const shiftDate = scheduledDayRange.start;

        // ── Procesar cada residente ──
        // Para cada uno:
        //  1. Buscar override ACTIVO existente (cualquier caregiver) para este shift.
        //  2. Si apunta a target → skip (idempotente, contabilizar alreadyAssigned).
        //  3. Si apunta a OTRO → marcar viejo isActive=false + resolvedAt, crear nuevo a target.
        //  4. Si no hay → crear nuevo a target.
        let created = 0;
        let reassigned = 0;
        let alreadyAssigned = 0;
        const newResidents: typeof residents = [];

        for (const r of residents) {
            const existing = await prisma.shiftPatientOverride.findFirst({
                where: {
                    patientId: r.id,
                    shiftDate: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                    shiftType: shiftType,
                    isActive: true,
                },
                select: { id: true, caregiverId: true },
            });

            if (existing && existing.caregiverId === targetCaregiverId) {
                alreadyAssigned++;
                continue;
            }

            if (existing) {
                // Reasignación — cerrar viejo y crear nuevo
                await prisma.shiftPatientOverride.update({
                    where: { id: existing.id },
                    data: { isActive: false, resolvedAt: new Date() },
                });
                reassigned++;
            } else {
                created++;
            }

            await prisma.shiftPatientOverride.create({
                data: {
                    headquartersId: hqId,
                    patientId: r.id,
                    originalColor: color,
                    assignedColor: color, // asignación top-down al mismo color (no es cobertura cruzada)
                    caregiverId: targetCaregiverId,
                    shiftDate,
                    shiftType,
                    reason: 'MANUAL',
                    autoAssigned: false,
                    isActive: true,
                },
            });
            newResidents.push(r);
        }

        const totalNew = created + reassigned;
        const colorLabels: Record<string, string> = {
            RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde',
        };
        const colorLabel = colorLabels[color] || color;

        // ── Audit log ──
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: targetCaregiverId,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: invokerId,
                    payloadChanges: {
                        trigger: 'MANUAL_ASSIGN_COLOR',
                        color,
                        shiftType,
                        targetCaregiverId,
                        targetCaregiverName: targetName,
                        created,
                        reassigned,
                        alreadyAssigned,
                        residentsTotal: residents.length,
                    },
                },
            });
        } catch (e) { logWarn('care.supervisor.assign_color.audit', e, { color, shiftType, targetCaregiverId }); }

        // ── Notificaciones ──
        // Solo notificar si hubo movimiento real (creados o reasignados).
        // Si todo era idempotente (alreadyAssigned === residents.length),
        // no spammeamos.
        if (totalNew > 0) {
            const names = newResidents.map(r => r.name).join(', ');
            await Promise.all([
                notifyUser(targetCaregiverId, {
                    type: 'SHIFT_ALERT',
                    title: `Asignación — Grupo ${colorLabel}`,
                    message: `${invokerName} te asignó ${totalNew} residente${totalNew === 1 ? '' : 's'} del Grupo ${colorLabel}: ${names}.`,
                    link: '/care',
                }),
                notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                    type: 'SHIFT_ALERT',
                    title: `Asignación de cobertura — Grupo ${colorLabel}`,
                    message: `${invokerName} asignó ${totalNew} residente${totalNew === 1 ? '' : 's'} del Grupo ${colorLabel} a ${targetName}.`,
                    link: '/care/supervisor',
                }),
            ]);
        }

        const summaryMessage = totalNew === 0
            ? `${targetName} ya tenía asignados los ${alreadyAssigned} residentes del Grupo ${colorLabel}.`
            : reassigned > 0
                ? `${totalNew} residente${totalNew === 1 ? '' : 's'} del Grupo ${colorLabel} asignado${totalNew === 1 ? '' : 's'} a ${targetName} (${created} nuevo${created === 1 ? '' : 's'}, ${reassigned} reasignado${reassigned === 1 ? '' : 's'}).`
                : `${created} residente${created === 1 ? '' : 's'} del Grupo ${colorLabel} asignado${created === 1 ? '' : 's'} a ${targetName}.`;

        return NextResponse.json({
            success: true,
            created,
            reassigned,
            alreadyAssigned,
            target: { id: targetCaregiverId, name: targetName },
            message: summaryMessage,
        });

    } catch (err: any) {
        logError('care.supervisor.assign_color.post', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Error asignando color' },
            { status: 500 }
        );
    }
}
