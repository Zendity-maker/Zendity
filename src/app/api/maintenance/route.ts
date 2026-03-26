import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ success: false, error: "headquartersId is required" }, { status: 400 });
        }

        const events = await prisma.headquartersEvent.findMany({
            where: {
                headquartersId: hqId,
                type: 'INFRASTRUCTURE',
            },
            include: {
                assignedTo: true,
                patient: true // In case the break is inside a patient room
            },
            orderBy: { createdAt: 'desc' }
        });

        // Split into Kanban Lists
        const pending = events.filter(e => e.status === 'PENDING');
        const inProgress = events.filter(e => e.status === 'IN_PROGRESS');
        const resolved = events.filter(e => e.status === 'RESOLVED').slice(0, 20); // Last 20 resolved

        return NextResponse.json({
            success: true,
            pending,
            inProgress,
            resolved
        });
    } catch (error) {
        console.error("Maintenance Fetch Error:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { eventId, status, mechanicId } = body;

        if (!eventId || !status) {
            return NextResponse.json({ success: false, error: "Missing eventId or status" }, { status: 400 });
        }

        const existingEvent = await prisma.headquartersEvent.findUnique({ where: { id: eventId } });
        if (!existingEvent) return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });

        let resolutionMinutes = existingEvent.resolutionTimeMinutes;

        // Si cambia a RESOLVED, calculamos el SLA (Tiempo desde createdAt hasta hoy)
        if (status === 'RESOLVED' && existingEvent.status !== 'RESOLVED') {
            const diffMs = new Date().getTime() - existingEvent.createdAt.getTime();
            resolutionMinutes = Math.floor(diffMs / 60000); // ms to minutes
        }

        const updatedEvent = await prisma.headquartersEvent.update({
            where: { id: eventId },
            data: {
                status: status,
                assignedToId: mechanicId || existingEvent.assignedToId,
                resolutionTimeMinutes: resolutionMinutes,
            }
        });

        return NextResponse.json({ success: true, event: updatedEvent });
    } catch (error) {
        console.error("Maintenance Update Error:", error);
        return NextResponse.json({ success: false, error: "Error mutando el ticket" }, { status: 500 });
    }
}
