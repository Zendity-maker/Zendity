import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/shift-audit/sessions?userId=X
 *
 * Lista los últimos 30 turnos (ShiftSession) de un empleado para que
 * el supervisor pueda seleccionar cuál auditar.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!['SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Acceso solo para supervisores' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

        // Verificar que el empleado pertenece a esta sede
        const employee = await prisma.user.findFirst({
            where: { id: userId, headquartersId: hqId },
            select: { id: true, name: true, role: true }
        });
        if (!employee) return NextResponse.json({ error: 'Empleado no encontrado en tu sede' }, { status: 404 });

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const sessions = await prisma.shiftSession.findMany({
            where: { caregiverId: userId, startTime: { gte: thirtyDaysAgo } },
            orderBy: { startTime: 'desc' },
            take: 30,
            select: {
                id: true,
                startTime: true,
                actualEndTime: true,
                handoverCompleted: true,
            }
        });

        // Para cada sesión, buscar el handover asociado
        const sessionIds = sessions.map(s => s.id);
        const handovers = await prisma.shiftHandover.findMany({
            where: { outgoingNurseId: userId, createdAt: { gte: thirtyDaysAgo } },
            select: {
                id: true,
                shiftType: true,
                createdAt: true,
                supervisorSignedAt: true,
                supervisorSigned: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });

        const shaped = sessions.map(s => {
            const durationMs = s.actualEndTime
                ? s.actualEndTime.getTime() - s.startTime.getTime()
                : null;
            const durationH = durationMs ? (durationMs / 3600000).toFixed(1) : null;

            // Inferir tipo de turno por hora de inicio (AST = UTC-4)
            const astHour = (s.startTime.getUTCHours() - 4 + 24) % 24;
            const shiftType = astHour >= 6 && astHour < 14 ? 'MORNING'
                : astHour >= 14 && astHour < 22 ? 'EVENING'
                : 'NIGHT';
            const shiftLabel = shiftType === 'MORNING' ? 'Turno Diurno'
                : shiftType === 'EVENING' ? 'Turno Vespertino'
                : 'Guardia Nocturna';

            return {
                id: s.id,
                startTime: s.startTime,
                endTime: s.actualEndTime,
                shiftType,
                shiftLabel,
                durationH,
                handoverCompleted: s.handoverCompleted,
                isOpen: !s.actualEndTime,
            };
        });

        return NextResponse.json({ success: true, employee, sessions: shaped });

    } catch (err: any) {
        console.error('[shift-audit/sessions]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
