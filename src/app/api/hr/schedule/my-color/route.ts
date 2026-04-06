import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const hqId = searchParams.get('hqId');

        if (!userId || !hqId) {
            return NextResponse.json({ success: false, color: null });
        }

        const today = new Date();

        // Buscar asignacion directa en ShiftColorAssignment
        const colorAssignment = await prisma.shiftColorAssignment.findFirst({
            where: {
                userId,
                headquartersId: hqId,
                assignedAt: { gte: startOfDay(today), lte: endOfDay(today) }
            },
            orderBy: { assignedAt: 'desc' }
        });

        if (colorAssignment) {
            return NextResponse.json({ success: true, color: colorAssignment.color, source: 'assignment' });
        }

        // Fallback: buscar en el roster del Schedule publicado para hoy
        const todayShift = await prisma.scheduledShift.findFirst({
            where: {
                userId,
                date: { gte: startOfDay(today), lte: endOfDay(today) },
                isAbsent: false,
                schedule: {
                    headquartersId: hqId,
                    status: 'PUBLISHED'
                }
            },
            orderBy: { date: 'desc' }
        });

        if (todayShift) {
            return NextResponse.json({ success: true, color: todayShift.colorGroup, source: 'roster' });
        }

        return NextResponse.json({ success: true, color: null, source: 'none' });

    } catch (error) {
        console.error('my-color error:', error);
        return NextResponse.json({ success: false, color: null });
    }
}
