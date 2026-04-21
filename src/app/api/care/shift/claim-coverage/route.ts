import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';
import { inferShiftTypeFromAST, type ShiftT } from '@/lib/shift-coverage';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE'];
const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * POST /api/care/shift/claim-coverage
 *
 * Body: { colors: string[], shiftSessionId, shiftType? }
 *
 * Usado por el CoveragePickerModal cuando:
 *   A) un sustituto llega y elige qué color cubrir, o
 *   B) un cuidador llega tarde y quiere tomar de vuelta su color
 *      que ya había sido redistribuido (este caso también se
 *      resuelve en shift/start Parte C, pero el modal ofrece un
 *      camino explícito).
 *
 * Crea ShiftPatientOverride (reason LATE_COVER) para cada residente
 * ACTIVE de los colores elegidos asignándolos al cuidador entrante.
 * Si alguno de esos pacientes tenía override activo a otro cuidador,
 * ese override se marca isActive=false + resolvedAt=now.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const invokerId = (session.user as any).id;
        const invokerName = (session.user as any).name || 'Cuidador';
        const hqId = (session.user as any).headquartersId;

        const body = await req.json();
        const { colors, shiftSessionId, shiftType: shiftTypeParam } = body as {
            colors?: string[];
            shiftSessionId?: string;
            shiftType?: ShiftT;
        };

        if (!Array.isArray(colors) || colors.length === 0) {
            return NextResponse.json({ success: false, error: 'colors requerido (array no vacío)' }, { status: 400 });
        }
        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: 'shiftSessionId requerido' }, { status: 400 });
        }

        // Validar sesión del invocador
        const shiftSession = await prisma.shiftSession.findFirst({
            where: { id: shiftSessionId, caregiverId: invokerId, headquartersId: hqId, actualEndTime: null },
            select: { id: true, startTime: true },
        });
        if (!shiftSession) {
            return NextResponse.json({ success: false, error: 'Sesión inválida o cerrada' }, { status: 404 });
        }

        const shiftType: ShiftT = shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
            ? shiftTypeParam
            : inferShiftTypeFromAST();

        const shiftDate = todayStartAST();
        const nextDay = new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000);

        // Pacientes ACTIVE de los colores elegidos en la sede
        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                colorGroup: { in: colors as any[] },
            },
            select: { id: true, name: true, colorGroup: true },
        });

        if (patients.length === 0) {
            return NextResponse.json({
                success: true,
                claimed: 0,
                message: 'No hay residentes ACTIVE en los colores seleccionados',
            });
        }

        // Overrides previos activos sobre estos pacientes (a otros cuidadores)
        const patientIds = patients.map(p => p.id);
        const priorOverrides = await prisma.shiftPatientOverride.findMany({
            where: {
                patientId: { in: patientIds },
                shiftDate: { gte: shiftDate, lt: nextDay },
                isActive: true,
                caregiverId: { not: invokerId },
            },
            select: { id: true, caregiverId: true, patientId: true },
        });

        const now = new Date();
        const vitalsExpiresAt = new Date(shiftSession.startTime.getTime() + VITALS_WINDOW_MS);
        const vitalsWindowOpen = vitalsExpiresAt > now;

        let claimed = 0;
        let vitalsCreated = 0;

        await prisma.$transaction(async (tx) => {
            // Desactivar overrides previos de otros cuidadores
            if (priorOverrides.length > 0) {
                await tx.shiftPatientOverride.updateMany({
                    where: { id: { in: priorOverrides.map(o => o.id) } },
                    data: { isActive: false, resolvedAt: now },
                });
            }

            // Crear overrides LATE_COVER para este cuidador (skip si ya tiene uno activo)
            for (const patient of patients) {
                const existing = await tx.shiftPatientOverride.findFirst({
                    where: {
                        patientId: patient.id,
                        caregiverId: invokerId,
                        shiftDate: { gte: shiftDate, lt: nextDay },
                        isActive: true,
                    },
                    select: { id: true },
                });
                if (existing) continue;

                await tx.shiftPatientOverride.create({
                    data: {
                        headquartersId: hqId,
                        patientId: patient.id,
                        originalColor: patient.colorGroup,
                        assignedColor: patient.colorGroup, // cubre ese color
                        caregiverId: invokerId,
                        shiftDate,
                        shiftType,
                        reason: 'LATE_COVER',
                        autoAssigned: false,
                        isActive: true,
                    },
                });
                claimed++;

                // VitalsOrder si ventana 4h abierta (y no existe ya uno PENDING)
                if (vitalsWindowOpen) {
                    const existingVital = await tx.vitalsOrder.findFirst({
                        where: { patientId: patient.id, shiftSessionId, status: 'PENDING' },
                        select: { id: true },
                    });
                    if (!existingVital) {
                        await tx.vitalsOrder.create({
                            data: {
                                headquartersId: hqId,
                                patientId: patient.id,
                                orderedById: invokerId,
                                caregiverId: invokerId,
                                reason: `Vitales de entrada — cobertura ${patient.colorGroup}`,
                                orderedAt: now,
                                expiresAt: vitalsExpiresAt,
                                status: 'PENDING',
                                autoCreated: true,
                                shiftSessionId,
                                penaltyApplied: false,
                            },
                        });
                        vitalsCreated++;
                    }
                }
            }

            await tx.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: shiftSessionId,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: invokerId,
                    payloadChanges: {
                        trigger: 'LATE_COVER_PICKER',
                        shiftType,
                        colors,
                        claimed,
                        vitalsCreated,
                        priorOverridesReleased: priorOverrides.length,
                    } as any,
                },
            });
        });

        // Notificar supervisor
        try {
            await notifyRoles(hqId, ['SUPERVISOR'], {
                type: 'EMAR_ALERT',
                title: `${invokerName} cubre ${colors.join(', ')}`,
                message: `${invokerName} tomó cobertura de ${claimed} residentes de ${colors.join(', ')}${priorOverrides.length > 0 ? ` (reemplazando ${priorOverrides.length} overrides previos)` : ''}.`,
            });
        } catch (e) { console.error('[claim-coverage notify]', e); }

        return NextResponse.json({
            success: true,
            claimed,
            vitalsCreated,
            priorOverridesReleased: priorOverrides.length,
            colors,
        });
    } catch (error: any) {
        console.error('claim-coverage error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error tomando cobertura',
        }, { status: 500 });
    }
}
