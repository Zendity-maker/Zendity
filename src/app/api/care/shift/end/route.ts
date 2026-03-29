import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SystemAuditAction, NursingHandoverStatus, FlagReason } from '@prisma/client';

export async function POST(req: Request) {
    try {
        const { shiftSessionId, handoverData, signature, forceEnd } = await req.json();

        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: "shiftSessionId requerido" }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: { caregiver: true }
        });

        if (!session) {
            return NextResponse.json({ success: false, error: "Turno no encontrado" }, { status: 404 });
        }

        if (session.actualEndTime && !forceEnd) {
            return NextResponse.json({ success: false, error: "Este turno ya fue finalizado" }, { status: 400 });
        }

        // Determinar el ShiftType lógicamente
        const now = new Date();
        const hours = now.getHours();
        let shiftTypeDraft: "MORNING" | "EVENING" | "NIGHT" = "NIGHT";

        if (hours >= 6 && hours < 14) {
            shiftTypeDraft = "MORNING";
        } else if (hours >= 14 && hours < 22) {
            shiftTypeDraft = "EVENING";
        }

        // Si se nos envía data de confirmación clínica, integramos la respuesta del Wizard
        if (handoverData && signature) {
            // Transaction atómica para proteger la continuidad de Floor
            const [handover, closedSession] = await prisma.$transaction(async (tx) => {
                
                // 1. Crear o Actualizar el Documento Legal de Handover
                // Nota: Usamos upsert por la restricción global @@unique([headquartersId, shiftDate, shiftType])
                const startOfDay = new Date();
                startOfDay.setHours(0,0,0,0);

                // Insertar el Handover
                const shiftHandover = await tx.nursingHandover.upsert({
                    where: {
                        headquartersId_shiftDate_shiftType_nurseOutId: {
                            headquartersId: session.headquartersId,
                            shiftDate: startOfDay,
                            shiftType: shiftTypeDraft,
                            nurseOutId: session.caregiverId
                        }
                    },
                    update: {
                        nurseOutId: session.caregiverId,
                        status: NursingHandoverStatus.SUBMITTED,
                        signatureOutBase64: signature,
                        signedOutAt: now,
                    },
                    create: {
                        headquartersId: session.headquartersId,
                        shiftDate: startOfDay,
                        shiftType: shiftTypeDraft,
                        nurseOutId: session.caregiverId,
                        status: NursingHandoverStatus.SUBMITTED,
                        signatureOutBase64: signature,
                        signedOutAt: now,
                    }
                });

                // Insertar las Notas Clínicas Rápidas (Novedades ROJAS/AMARILLAS)
                if (handoverData.selectedPatients && Object.keys(handoverData.selectedPatients).length > 0) {
                    const notesToInsert = Object.entries(handoverData.selectedPatients).map(([patientId, noteStr]) => ({
                        nursingHandoverId: shiftHandover.id,
                        patientId,
                        flagReason: FlagReason.BEHAVIOR, // Ajuste mock rápido, idealmente inferido por Zendi
                        nursingNote: noteStr as string
                    }));
                    
                    // Cleanup preventivo si Upsert recicló un handover existente
                    await tx.handoverPatientNote.deleteMany({
                         where: { nursingHandoverId: shiftHandover.id }
                    });

                    await tx.handoverPatientNote.createMany({
                        data: notesToInsert
                    });
                }

                // ESTRATEGIA ZENDI:
                // Guardamos el borrador ya validado por el enfermero síncronamente en el ShiftSession
                // para inmediatez.
                const updatedSession = await tx.shiftSession.update({
                    where: { id: shiftSessionId },
                    data: {
                        actualEndTime: now,
                        handoverCompleted: true,
                        aiSummaryReport: handoverData.zendiSummary || "Relevo estándar generado.",
                    }
                });

                // Auditoría Strict
                await tx.systemAuditLog.create({
                    data: {
                        headquartersId: session.headquartersId,
                        entityName: 'ShiftSession-HandoverUnion',
                        entityId: session.id,
                        action: SystemAuditAction.SIGNED_OUT,
                        performedById: session.caregiverId,
                        payloadChanges: { 
                            handoverId: shiftHandover.id, 
                            tasksExempted: handoverData.justifications, 
                            zendiApproved: true 
                        }
                    }
                });

                return [shiftHandover, updatedSession];
            });

            // Disparar procesamiento Background de IA SI FUERA NECESARIO (Simulación)
            // fetch('https://webhook.zendi.com/analyze-shift...', { method: 'POST' }).catch(() => {});

            return NextResponse.json({ success: true, shiftSession: closedSession, handover });
        }

        // Fallback: Finalizar turno administrativo genérico si por alguna razón salta el Wizard
        // (Modo Override / Abandono del empleado)
        const closedSession = await prisma.shiftSession.update({
            where: { id: shiftSessionId },
            data: {
                actualEndTime: now,
                aiSummaryReport: "Shift Closed Without Clinical Handover (Override)"
            }
        });

        // Trackear abandono
        await prisma.systemAuditLog.create({
            data: {
                headquartersId: session.headquartersId,
                entityName: 'ShiftSession',
                entityId: session.id,
                action: SystemAuditAction.SYSTEM_ABANDONED,
                performedById: session.caregiverId
            }
        });

        return NextResponse.json({ success: true, shiftSession: closedSession });

    } catch (error) {
        console.error("Shift End/Handover Union Error:", error);
        return NextResponse.json({ success: false, error: "Error de Servidor al Consolidar la Guardia" }, { status: 500 });
    }
}
