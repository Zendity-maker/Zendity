import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // hqId resuelto desde la sesión: roles limitados → su sede (ignora ?hqId);
    // DIRECTOR/ADMIN validados contra DB. Antes: ?hqId del cliente sin validar.
    const hqId = await resolveEffectiveHqId(session, new URL(req.url).searchParams.get('hqId'));

    const todayStart = todayStartAST();

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
