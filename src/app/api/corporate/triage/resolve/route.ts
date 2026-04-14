import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH — Actualizar estado, asignar, o resolver un TriageTicket
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { ticketId, status, assignedToId, resolutionNote, resolvedById } = body;

        if (!ticketId) {
            return NextResponse.json({ success: false, error: 'ticketId requerido' }, { status: 400 });
        }

        const updateData: any = {};

        if (status) {
            updateData.status = status;
            if (status === 'RESOLVED') {
                updateData.resolvedAt = new Date();
                if (resolvedById) updateData.resolvedById = resolvedById;
                if (resolutionNote) updateData.resolutionNote = resolutionNote;
            }
        }

        if (assignedToId !== undefined) {
            updateData.assignedToId = assignedToId || null;
            // Auto-mover a IN_PROGRESS al asignar (si estaba OPEN)
            if (assignedToId && !status) {
                const current = await prisma.triageTicket.findUnique({ where: { id: ticketId }, select: { status: true } });
                if (current?.status === 'OPEN') {
                    updateData.status = 'IN_PROGRESS';
                }
            }
        }

        const ticket = await prisma.triageTicket.update({
            where: { id: ticketId },
            data: updateData,
            include: {
                patient: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            }
        });

        return NextResponse.json({ success: true, ticket });

    } catch (e: any) {
        console.error("Triage Resolve Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
