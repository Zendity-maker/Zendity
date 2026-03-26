import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function PATCH(req: Request) {
    try {
        const { ticketId, moduleName, actionTaken, authorId, patientId, ticketTitle, familyMessage } = await req.json();

        if (!ticketId || !moduleName) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        let updatedTicket: any = null;

        switch (moduleName) {
            case 'COMPLAINT':
                updatedTicket = await prisma.complaint.update({
                    where: { id: ticketId },
                    data: { status: 'RESOLVED' }
                });
                break;
            case 'INCIDENT':
                updatedTicket = await prisma.headquartersEvent.update({
                    where: { id: ticketId },
                    data: { status: 'RESOLVED' }
                });
                break;
            case 'CLINICAL_ALERT':
                updatedTicket = await prisma.dailyLog.update({
                    where: { id: ticketId },
                    data: { isResolved: true } // FASE 33 FLAG
                });
                break;
            default:
                return NextResponse.json({ success: false, error: 'Invalid moduleName' }, { status: 400 });
        }

        // FASE 66: Crear ClinicalNote (Reporte Triage) en el perfil
        if (actionTaken && patientId && authorId) {
            await prisma.clinicalNote.create({
                data: {
                    patientId,
                    authorId,
                    title: `Resolución de Ticket: ${ticketTitle || moduleName}`,
                    content: actionTaken,
                    type: "TRIAGE_RESOLUTION"
                }
            });
        }

        // FASE 66: Crear Mensaje Familiar Opcional Propuesto por Zendi
        if (familyMessage && patientId && authorId) {
            await prisma.familyMessage.create({
                data: {
                    patientId,
                    senderType: 'STAFF',
                    senderId: authorId,
                    content: familyMessage,
                    isRead: false
                }
            });
        }

        return NextResponse.json({ success: true, updatedTicket });

    } catch (e: any) {
        console.error("Triage Resolve Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
