import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hqId = new URL(req.url).searchParams.get('hqId') || session.user.headquartersId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Consultas en paralelo: staff + sesiones activas (ShiftSession.actualEndTime = null)
    const [staff, activeSessions] = await Promise.all([
        prisma.user.findMany({
            where: {
                headquartersId: hqId,
                isActive: true,
                role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] },
            },
            select: { id: true, name: true, role: true },
        }),
        prisma.shiftSession.findMany({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: todayStart },
            },
            select: { caregiverId: true },
        }),
    ]);

    const activeIds = new Set(activeSessions.map(s => s.caregiverId));

    return NextResponse.json({
        onShift: staff.filter(s => activeIds.has(s.id)),
        offShift: staff.filter(s => !activeIds.has(s.id)),
        // Backward compatibility: TaskAssignmentButton also reads .caregivers
        caregivers: staff.map(s => ({ ...s, isOnShift: activeIds.has(s.id) })),
    });
}
