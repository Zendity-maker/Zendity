import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SystemAuditAction } from '@prisma/client';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }
        const invokerId = (authSession.user as any).id;
        const invokerRole = (authSession.user as any).role;
        const invokerHqId = (authSession.user as any).headquartersId;

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

        // Autorización: (1) el propio cuidador puede cerrar su turno, o
        // (2) SUPERVISOR/DIRECTOR/ADMIN de la misma sede puede cerrarlo.
        const isOwner = session.caregiverId === invokerId;
        const isSupervisor = SUPERVISOR_ROLES.includes(invokerRole) && session.headquartersId === invokerHqId;
        if (!isOwner && !isSupervisor) {
            return NextResponse.json({ success: false, error: "No tienes permiso para cerrar este turno" }, { status: 403 });
        }

        if (session.actualEndTime && !forceEnd) {
            return NextResponse.json({ success: false, error: "Este turno ya fue finalizado" }, { status: 400 });
        }

        // Determinar el ShiftType lógicamente (AST, pero el cron de prólogo se
        // encarga del anclaje 6am; aquí usamos hora local del servidor para shift).
        const now = new Date();
        const hours = now.getHours();
        let shiftTypeDraft: "MORNING" | "EVENING" | "NIGHT" = "NIGHT";
        if (hours >= 6 && hours < 14) shiftTypeDraft = "MORNING";
        else if (hours >= 14 && hours < 22) shiftTypeDraft = "EVENING";

        // Flujo 1 — Cierre con Wizard: firma + justificaciones + zendi summary
        if (handoverData && signature) {
            const [handover, closedSession] = await prisma.$transaction(async (tx) => {
                // 1. Crear ShiftHandover canónico
                const shiftHandover = await tx.shiftHandover.create({
                    data: {
                        headquartersId: session.headquartersId,
                        shiftType: shiftTypeDraft,
                        outgoingNurseId: session.caregiverId,
                        status: 'PENDING',
                        aiSummaryReport: handoverData.zendiSummary || "Relevo estándar generado.",
                        signature,
                        signedOutAt: now,
                        justifications: handoverData.justifications ?? {},
                        handoverCompleted: true,
                    }
                });

                // 2. Notas clínicas del wizard (si vinieron selectedPatients)
                if (handoverData.selectedPatients && Object.keys(handoverData.selectedPatients).length > 0) {
                    const notesToInsert = Object.entries(handoverData.selectedPatients).map(
                        ([patientId, noteStr]) => ({
                            shiftHandoverId: shiftHandover.id,
                            patientId,
                            clinicalNotes: noteStr as string,
                            isCritical: false,
                        })
                    );
                    await tx.handoverNote.createMany({ data: notesToInsert });
                }

                // 3. Cerrar la sesión de turno
                const updatedSession = await tx.shiftSession.update({
                    where: { id: shiftSessionId },
                    data: {
                        actualEndTime: now,
                        handoverCompleted: true,
                        aiSummaryReport: handoverData.zendiSummary || "Relevo estándar generado.",
                        shiftHandoverId: shiftHandover.id,
                    }
                });

                // 4. Auditoría
                await tx.systemAuditLog.create({
                    data: {
                        headquartersId: session.headquartersId,
                        entityName: 'ShiftHandover',
                        entityId: shiftHandover.id,
                        action: SystemAuditAction.SIGNED_OUT,
                        performedById: invokerId,
                        payloadChanges: {
                            shiftSessionId: session.id,
                            tasksExempted: handoverData.justifications ?? {},
                            zendiApproved: true,
                            closedBySupervisor: !isOwner,
                            ownerCaregiverId: session.caregiverId,
                        }
                    }
                });

                return [shiftHandover, updatedSession];
            });

            return NextResponse.json({ success: true, shiftSession: closedSession, handover });
        }

        // Flujo 2 — Cierre sin Wizard (override / abandono): solo cerrar sesión
        const closedSession = await prisma.shiftSession.update({
            where: { id: shiftSessionId },
            data: {
                actualEndTime: now,
                aiSummaryReport: "Shift Closed Without Clinical Handover (Override)"
            }
        });

        await prisma.systemAuditLog.create({
            data: {
                headquartersId: session.headquartersId,
                entityName: 'ShiftSession',
                entityId: session.id,
                action: SystemAuditAction.SYSTEM_ABANDONED,
                performedById: invokerId,
                payloadChanges: {
                    closedBySupervisor: !isOwner,
                    ownerCaregiverId: session.caregiverId,
                }
            }
        });

        return NextResponse.json({ success: true, shiftSession: closedSession });

    } catch (error) {
        console.error("Shift End Error:", error);
        return NextResponse.json({ success: false, error: "Error de Servidor al Consolidar la Guardia" }, { status: 500 });
    }
}
