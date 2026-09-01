import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';
import { todayStartAST } from '@/lib/dates';
import {
    inferShiftType,
    resolveColorGroupsForCaregiver,
    resolvePatientsByColors,
    collectShiftActivity,
    buildZendiSummary,
} from '@/lib/shift-closure-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Sprint L — Cierre de turno con reporte INDIVIDUAL por cuidador.
 *
 * Flujo 1 (Wizard — el cuidador mismo cierra):
 *   1. El wizard YA mostró al cuidador el reporte vía /api/care/shift/preview.
 *      Si handoverData.aiSummaryReport viene → respetamos ese texto literal
 *      (lo que el cuidador firmó === lo que se guarda).
 *   2. Si no viene (cierre legado sin preview), regeneramos con GPT-4o-mini.
 *   3. Crear ShiftHandover + HandoverNotes + actualizar ShiftSession.
 *
 * Flujo 2 (forceEnd por supervisor):
 *   - Crea ShiftHandover "vacío" con nota de cierre forzado.
 *   - Log SystemAuditAction.SYSTEM_ABANDONED.
 */

export async function POST(req: Request) {
    try {
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, role: invokerRole, headquartersId: invokerHqId } = auth;
        const invokerName = auth.name || 'Supervisor';

        const { shiftSessionId, handoverData, signature, forceEnd } = await req.json();

        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: "shiftSessionId requerido" }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: { caregiver: true },
        });

        if (!session) {
            return NextResponse.json({ success: false, error: "Turno no encontrado" }, { status: 404 });
        }

        const isOwner = session.caregiverId === invokerId;
        const isSupervisor = SUPERVISOR_ROLES.includes(invokerRole) && session.headquartersId === invokerHqId;
        if (!isOwner && !isSupervisor) {
            return NextResponse.json({ success: false, error: "No tienes permiso para cerrar este turno" }, { status: 403 });
        }

        if (session.actualEndTime && !forceEnd) {
            return NextResponse.json({ success: false, error: "Este turno ya fue finalizado" }, { status: 400 });
        }

        const now = new Date();
        const shiftTypeDraft = inferShiftType(now);
        const shiftStart = session.startTime < todayStartAST() ? todayStartAST() : session.startTime;

        // ──────────────────────────────────────────────────────────────────
        // FLUJO 1 — Cierre con Wizard
        // ──────────────────────────────────────────────────────────────────
        if (handoverData && signature && !forceEnd) {
            const colorGroups = await resolveColorGroupsForCaregiver(session.caregiverId, session.headquartersId, shiftStart);
            const patients = await resolvePatientsByColors(colorGroups, session.headquartersId);
            const activity = await collectShiftActivity({
                caregiverId: session.caregiverId,
                patientIds: patients.map(p => p.id),
                shiftStart,
            });

            // Si el wizard ya mostró al cuidador un reporte pre-generado y lo
            // confirmó, usamos ese texto literal. Esto garantiza que lo que
            // firmó === lo que se guarda.
            const justifications = (handoverData.justifications ?? {}) as Record<string, string>;
            const previewedReport: string | undefined = handoverData.aiSummaryReport;
            let zendiSummary: string;
            if (typeof previewedReport === 'string' && previewedReport.trim().length > 40) {
                zendiSummary = previewedReport.trim();
                console.log(`[shift/end] usando reporte pre-generado del wizard (len=${zendiSummary.length}) caregiver=${session.caregiver?.name}`);
            } else {
                const built = await buildZendiSummary({
                    caregiverName: session.caregiver?.name || 'Cuidador(a)',
                    shiftType: shiftTypeDraft,
                    patients,
                    activity,
                    justifications,
                    shiftDate: shiftStart,
                });
                zendiSummary = built.summary;
            }

            /**
             * Guarda contra doble envio del cierre de turno.
             *
             * Medido el 30-ago-2026: 11 relevos duplicados de 860. Misma
             * cuidadora, mismo tipo de turno, menos de dos minutos aparte. Un
             * relevo duplicado no es cosmetico: cada uno arrastra su reporte de
             * Zendi, sus notas y su firma, y en el historial parece que el turno
             * se entrego dos veces.
             *
             * Va FUERA de la transaccion a proposito: si ya existe, no hay nada
             * que abrir. Y devuelve exito con el id del que ya esta, porque un
             * error rojo al final de un turno hace que la cuidadora lo repita —
             * que es exactamente lo que produce el duplicado.
             */
            const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
            const relevoReciente = await prisma.shiftHandover.findFirst({
                where: {
                    headquartersId: session.headquartersId,
                    outgoingNurseId: session.caregiverId,
                    shiftType: shiftTypeDraft,
                    isDailyPrologue: false,
                    createdAt: { gte: dosMinutosAtras },
                },
                select: { id: true },
                orderBy: { createdAt: 'desc' },
            });
            if (relevoReciente) {
                return NextResponse.json({
                    success: true,
                    duplicado: true,
                    handoverId: relevoReciente.id,
                    message: 'Tu turno ya fue cerrado hace un momento. No se duplicó.',
                });
            }

            const [handover, closedSession] = await prisma.$transaction(async (tx) => {
                // Flujo nuevo: cuidador firma → supervisor firma directo.
                // Sin paso de "senior confirma" (eliminado).
                // La firma del cuidador en el Wizard es suficiente para cerrar el relevo.
                // Status → ACCEPTED directamente (no requiere firma adicional del supervisor).
                // El supervisor puede ver y revisar el reporte en /corporate/reports pero
                // el relevo no queda bloqueado esperando su firma.
                const shiftHandover = await tx.shiftHandover.create({
                    data: {
                        headquartersId: session.headquartersId,
                        shiftType: shiftTypeDraft,
                        outgoingNurseId: session.caregiverId,
                        status: 'ACCEPTED',
                        acceptedAt: now,
                        aiSummaryReport: zendiSummary,
                        signature,
                        signedOutAt: now,
                        justifications,
                        handoverCompleted: true,
                        colorGroups,
                        isDailyPrologue: false,
                    },
                });

                const selected = (handoverData.selectedPatients ?? {}) as Record<string, string>;
                const selectedIds = Object.keys(selected);
                if (selectedIds.length > 0) {
                    await tx.handoverNote.createMany({
                        data: selectedIds.map(patientId => ({
                            shiftHandoverId: shiftHandover.id,
                            patientId,
                            clinicalNotes: selected[patientId],
                            isCritical: false,
                        })),
                    });
                } else if (patients.length > 0) {
                    const criticalIds = new Set<string>([
                        ...activity.falls.map(f => patients.find(p => p.name === f.patientName)?.id).filter((x): x is string => !!x),
                        ...activity.clinicalAlerts.map(a => patients.find(p => p.name === a.patientName)?.id).filter((x): x is string => !!x),
                    ]);
                    await tx.handoverNote.createMany({
                        data: patients.map(p => ({
                            shiftHandoverId: shiftHandover.id,
                            patientId: p.id,
                            clinicalNotes: `Turno ${shiftTypeDraft} cerrado por ${session.caregiver?.name || 'cuidador(a)'}. Ver aiSummaryReport para detalle.`,
                            isCritical: criticalIds.has(p.id),
                        })),
                    });
                }

                const updatedSession = await tx.shiftSession.update({
                    where: { id: shiftSessionId },
                    data: {
                        actualEndTime: now,
                        handoverCompleted: true,
                        aiSummaryReport: zendiSummary,
                        shiftHandoverId: shiftHandover.id,
                    },
                });

                // Cleanup: cancelar ventanas de vitales auto-creadas que quedaron
                // PENDING al cerrar el turno. Antes persistían como fantasmas en
                // el dashboard del supervisor hasta su expiresAt.
                await tx.vitalsOrder.updateMany({
                    where: {
                        shiftSessionId,
                        status: 'PENDING',
                        autoCreated: true,
                    },
                    data: { status: 'EXPIRED' },
                });

                // Cleanup: cerrar ShiftPatientOverride activos donde esta
                // cuidadora era la RECEPTORA. Antes quedaban isActive=true
                // indefinidamente al cerrar turno — el chokepoint los filtra
                // en runtime vía filterRealOverrides(... activeUserIdsSet)
                // así que no afectaban el wall, pero la DB acumulaba data
                // sucia y queries históricas que no aplicaran ese filtro
                // veían overrides "activos" de hace semanas.
                const cleanedOverrides = await tx.shiftPatientOverride.updateMany({
                    where: {
                        caregiverId: session.caregiverId,
                        isActive: true,
                    },
                    data: { isActive: false, resolvedAt: now },
                });

                await tx.systemAuditLog.create({
                    data: {
                        headquartersId: session.headquartersId,
                        entityName: 'ShiftHandover',
                        entityId: shiftHandover.id,
                        action: SystemAuditAction.SIGNED_OUT,
                        performedById: invokerId,
                        payloadChanges: {
                            shiftSessionId: session.id,
                            tasksExempted: justifications,
                            zendiApproved: true,
                            reportPreviewedByCaregiver: typeof previewedReport === 'string',
                            closedBySupervisor: !isOwner,
                            ownerCaregiverId: session.caregiverId,
                            colorGroups,
                            patientCount: patients.length,
                            overridesCleaned: cleanedOverrides.count,
                        },
                    },
                });

                return [shiftHandover, updatedSession];
            });

            // Recorte de ruido (17-ago-2026): el cierre de turno ya NO
            // notifica a supervisión — generaba 1,265 campanas/mes por un
            // evento que es el happy path. El reporte vive en
            // /corporate/reports y los handovers sin firmar tienen su propio
            // flujo de seguimiento. El cierre forzado (flujo 2) tampoco
            // notifica: lo ejecuta el propio supervisor.

            return NextResponse.json({ success: true, shiftSession: closedSession, handover });
        }

        // ──────────────────────────────────────────────────────────────────
        // FLUJO 2 — Cierre forzado por supervisor
        // ──────────────────────────────────────────────────────────────────
        if (!isSupervisor) {
            return NextResponse.json({
                success: false,
                error: "Debes completar el wizard de cierre. Si el cuidador no puede, un supervisor debe forzar el cierre.",
            }, { status: 400 });
        }

        const forcedSummary = `Cierre forzado por supervisor ${invokerName}. Sin reporte clínico del cuidador.`;

        // Misma guarda en el cierre forzado. Aqui la clave es el CUIDADOR cuyo
        // turno se cierra, no el supervisor que lo fuerza: dos supervisores
        // forzando el mismo turno producirian dos relevos de la misma persona.
        const relevoForzadoReciente = await prisma.shiftHandover.findFirst({
            where: {
                headquartersId: session.headquartersId,
                outgoingNurseId: session.caregiverId,
                shiftType: shiftTypeDraft,
                isDailyPrologue: false,
                createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
        });
        if (relevoForzadoReciente) {
            return NextResponse.json({
                success: true,
                duplicado: true,
                handoverId: relevoForzadoReciente.id,
                message: 'Este turno ya fue cerrado hace un momento. No se duplicó.',
            });
        }

        const [forcedHandover, forcedSession] = await prisma.$transaction(async (tx) => {
            const handover = await tx.shiftHandover.create({
                data: {
                    headquartersId: session.headquartersId,
                    shiftType: shiftTypeDraft,
                    outgoingNurseId: session.caregiverId,
                    status: 'PENDING',
                    aiSummaryReport: forcedSummary,
                    handoverCompleted: false,
                    colorGroups: [],
                    isDailyPrologue: false,
                    supervisorSignedById: invokerId,
                    supervisorSignedAt: now,
                    supervisorNote: `Cierre forzado — cuidador no disponible. Invocado por ${invokerName}.`,
                },
            });

            const updatedSession = await tx.shiftSession.update({
                where: { id: shiftSessionId },
                data: {
                    actualEndTime: now,
                    aiSummaryReport: forcedSummary,
                    shiftHandoverId: handover.id,
                },
            });

            // Cleanup vitales auto-creadas también en cierre forzado
            await tx.vitalsOrder.updateMany({
                where: {
                    shiftSessionId,
                    status: 'PENDING',
                    autoCreated: true,
                },
                data: { status: 'EXPIRED' },
            });

            // Cleanup overrides activos del cuidador — mismo razonamiento
            // que Flujo 1. Aplica también en cierre forzado para no dejar
            // data sucia.
            const cleanedOverrides = await tx.shiftPatientOverride.updateMany({
                where: {
                    caregiverId: session.caregiverId,
                    isActive: true,
                },
                data: { isActive: false, resolvedAt: now },
            });

            await tx.systemAuditLog.create({
                data: {
                    headquartersId: session.headquartersId,
                    entityName: 'ShiftHandover',
                    entityId: handover.id,
                    action: SystemAuditAction.SYSTEM_ABANDONED,
                    performedById: invokerId,
                    payloadChanges: {
                        kind: 'FORCE_CLOSED_BY_SUPERVISOR',
                        shiftSessionId: session.id,
                        ownerCaregiverId: session.caregiverId,
                        supervisorId: invokerId,
                        supervisorName: invokerName,
                        overridesCleaned: cleanedOverrides.count,
                    },
                },
            });

            return [handover, updatedSession];
        });

        // Nota: NO aplicamos applyScoreEvent aquí. La penalidad de -10 ya la
        // cuenta /api/care/compliance-score automáticamente por
        // handoverCompleted=false (ventana 14 días). Aplicarla aquí causaba
        // doble penalidad (-20) al cuidador cuyo turno fue cerrado.
        return NextResponse.json({ success: true, shiftSession: forcedSession, handover: forcedHandover, forced: true });

    } catch (error) {
        logError('care.shift.end.post', error);
        return NextResponse.json({ success: false, error: "Error de Servidor al Consolidar la Guardia" }, { status: 500 });
    }
}
