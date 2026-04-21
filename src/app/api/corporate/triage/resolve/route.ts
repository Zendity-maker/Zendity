import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// PATCH — Actualizar estado, asignar, resolver, o agregar nota de seguimiento
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerHqId = (session.user as any).headquartersId;

        const body = await req.json();
        const { ticketId, status, assignedToId, resolutionNote, resolvedById, followUpNote } = body;

        if (!ticketId) {
            return NextResponse.json({ success: false, error: 'ticketId requerido' }, { status: 400 });
        }

        // Tenant check: el ticket debe pertenecer a la sede del invocador
        const ticketCheck = await prisma.triageTicket.findUnique({
            where: { id: ticketId },
            select: { headquartersId: true },
        });
        if (!ticketCheck || ticketCheck.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Ticket fuera de tu sede' }, { status: 403 });
        }

        // Si es una nota de seguimiento, la agregamos al array JSON sin cambiar status
        if (followUpNote) {
            const current = await prisma.triageTicket.findUnique({
                where: { id: ticketId },
                select: { followUpNotes: true }
            });

            const existingNotes = Array.isArray(current?.followUpNotes) ? current.followUpNotes : [];
            const updatedNotes = [
                ...existingNotes,
                {
                    authorId: followUpNote.authorId,
                    authorName: followUpNote.authorName,
                    note: followUpNote.note,
                    createdAt: new Date().toISOString(),
                }
            ];

            const ticket = await prisma.triageTicket.update({
                where: { id: ticketId },
                data: { followUpNotes: updatedNotes },
                include: {
                    patient: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true, role: true } },
                }
            });

            return NextResponse.json({ success: true, ticket });
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
                assignedTo: { select: { id: true, name: true, role: true } },
            }
        });

        return NextResponse.json({ success: true, ticket });

    } catch (e: any) {
        console.error("Triage Resolve Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
