import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { scheduledShiftId, targetUserId, color, hqId, assignedById, isAutoAssigned } = await req.json();

        if (!scheduledShiftId || !targetUserId || !color || !hqId) {
            return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
        }

        // Crear la asignacion de color al nuevo cuidador
        const assignment = await prisma.shiftColorAssignment.create({
            data: {
                headquartersId: hqId,
                scheduledShiftId,
                color,
                userId: targetUserId,
                assignedBy: assignedById || null,
                isAutoAssigned: isAutoAssigned || false,
                assignedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, assignment });

    } catch (error) {
        console.error('Redistribute API error:', error);
        return NextResponse.json({ success: false, error: 'Error redistribuyendo' }, { status: 500 });
    }
}
