import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(req: Request) {
    try {
        const { ticketId, moduleName } = await req.json();

        if (!ticketId || !moduleName) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        let updatedTicket = null;

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

        return NextResponse.json({ success: true, updatedTicket });

    } catch (e: any) {
        console.error("Triage Resolve Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
