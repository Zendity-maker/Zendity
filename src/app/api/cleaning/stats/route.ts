import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, eachDayOfInterval, format } from 'date-fns';

const ALLOWED_ROLES = ['CLEANING', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId') || (session.user as any).headquartersId;
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'hqId requerido' }, { status: 400 });
        }

        const dateFrom = from ? new Date(from) : new Date();
        const dateTo = to ? new Date(to) : new Date();
        const rangeStart = startOfDay(dateFrom);
        const rangeEnd = endOfDay(dateTo);

        // Total areas for this HQ
        const totalAreas = await prisma.cleaningArea.count({
            where: { headquartersId: hqId, isActive: true },
        });

        // All logs in range
        const logs = await prisma.cleaningLog.findMany({
            where: {
                headquartersId: hqId,
                cleanedAt: { gte: rangeStart, lte: rangeEnd },
            },
            include: {
                area: { select: { id: true, name: true } },
                cleanedBy: { select: { id: true, name: true } },
            },
            orderBy: { cleanedAt: 'asc' },
        });

        // 1. % completado por dia
        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
        const completionByDay = days.map(day => {
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);
            const dayLogs = logs.filter(l => l.cleanedAt >= dayStart && l.cleanedAt <= dayEnd);
            const completed = dayLogs.filter(l => l.status === 'COMPLETED').length;
            const skipped = dayLogs.filter(l => l.status === 'SKIPPED').length;
            return {
                date: format(day, 'yyyy-MM-dd'),
                total: dayLogs.length,
                completed,
                skipped,
                percentage: totalAreas > 0 ? Math.round((completed / totalAreas) * 100) : 0,
            };
        });

        // 2. Areas mas frecuentemente omitidas
        const skippedLogs = logs.filter(l => l.status === 'SKIPPED');
        const skipCounts: Record<string, { name: string; count: number }> = {};
        for (const log of skippedLogs) {
            const key = log.area.id;
            if (!skipCounts[key]) skipCounts[key] = { name: log.area.name, count: 0 };
            skipCounts[key].count++;
        }
        const mostSkipped = Object.values(skipCounts).sort((a, b) => b.count - a.count).slice(0, 5);

        // 3. Empleado con mejor cumplimiento
        const employeeLogs: Record<string, { name: string; completed: number; total: number }> = {};
        for (const log of logs) {
            const key = log.cleanedBy.id;
            if (!employeeLogs[key]) employeeLogs[key] = { name: log.cleanedBy.name, completed: 0, total: 0 };
            employeeLogs[key].total++;
            if (log.status === 'COMPLETED') employeeLogs[key].completed++;
        }
        const topEmployees = Object.values(employeeLogs)
            .map(e => ({ ...e, rate: e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0 }))
            .sort((a, b) => b.rate - a.rate || b.completed - a.completed)
            .slice(0, 5);

        // 4. Fotos tomadas vs solicitadas
        const photosRequested = logs.filter(l => l.photoRequested).length;
        const photosTaken = logs.filter(l => l.photoRequested && l.photoUrl).length;

        return NextResponse.json({
            success: true,
            totalAreas,
            completionByDay,
            mostSkipped,
            topEmployees,
            photoCompliance: {
                requested: photosRequested,
                taken: photosTaken,
                rate: photosRequested > 0 ? Math.round((photosTaken / photosRequested) * 100) : 100,
            },
        });
    } catch (error) {
        console.error('Cleaning Stats GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando estadísticas' }, { status: 500 });
    }
}
