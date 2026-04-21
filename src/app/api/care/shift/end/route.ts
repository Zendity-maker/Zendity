import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }
        const invokerId = (authSession.user as any).id;
        const invokerRole = (authSession.user as any).role;
        const invokerHqId = (authSession.user as any).headquartersId;
        const invokerName = (authSession.user as any).name || 'Supervisor';

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
                });
                zendiSummary = built.summary;
            }

            const [handover, closedSession] = await prisma.$transaction(async (tx) => {
                const shiftHandover = await tx.shiftHandover.create({
                    data: {
                        headquartersId: session.headquartersId,
                        shiftType: shiftTypeDraft,
                        outgoingNurseId: session.caregiverId,
                        status: 'PENDING',
                        aiSummaryReport: zendiSummary,
                        signature,
                        signedOutAt: now,
                        justifications,
                        handoverCompleted: true,
                        colorGroups,
                        isDailyPrologue: false,
                        seniorCaregiverId: session.caregiverId,
                        seniorConfirmedAt: now,
                        seniorNote: 'Cuidador(a) autoconfirmó su reporte individual al cierre de turno.',
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
                        },
                    },
                });

                return [shiftHandover, updatedSession];
            });

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
                    },
                },
            });

            return [handover, updatedSession];
        });

        return NextResponse.json({ success: true, shiftSession: forcedSession, handover: forcedHandover, forced: true });

    } catch (error) {
        console.error("Shift End Error:", error);
        return NextResponse.json({ success: false, error: "Error de Servidor al Consolidar la Guardia" }, { status: 500 });
    }
}
