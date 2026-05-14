import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { startOfDay, endOfDay } from 'date-fns';

// Cron: snapshot diario de stats de limpieza por sede.
// Resuelve el bug de "% completado" donde el denominador era el conteo
// ACTUAL de áreas activas — ahora cada día queda fotografiado con el
// totalAreas real al cierre del día.
// Schedule: 23:55 cada día (ver vercel.json).
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const today = new Date();
        const dayStart = startOfDay(today);
        const dayEnd = endOfDay(today);

        const headquarters = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true },
        });

        const results: Array<{ hqId: string; totalAreas: number; completedCount: number; skippedCount: number }> = [];

        for (const hq of headquarters) {
            const [totalAreas, logs] = await Promise.all([
                prisma.cleaningArea.count({
                    where: { headquartersId: hq.id, isActive: true },
                }),
                prisma.cleaningLog.findMany({
                    where: {
                        headquartersId: hq.id,
                        cleanedAt: { gte: dayStart, lte: dayEnd },
                    },
                    select: { status: true, areaId: true },
                }),
            ]);

            const completedCount = logs.filter(l => l.status === 'COMPLETED').length;
            const skippedCount = logs.filter(l => l.status === 'SKIPPED').length;
            const uniqueAreasLogged = new Set(logs.map(l => l.areaId)).size;

            await prisma.cleaningDailyStats.upsert({
                where: { headquartersId_date: { headquartersId: hq.id, date: dayStart } },
                update: { totalAreas, completedCount, skippedCount, uniqueAreasLogged },
                create: {
                    headquartersId: hq.id,
                    date: dayStart,
                    totalAreas,
                    completedCount,
                    skippedCount,
                    uniqueAreasLogged,
                },
            });

            results.push({ hqId: hq.id, totalAreas, completedCount, skippedCount });
        }

        return NextResponse.json({
            success: true,
            snapshotDate: dayStart.toISOString(),
            sedes: results.length,
            results,
        });
    } catch (error) {
        console.error('[CRON snapshot-cleaning-stats] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error generando snapshot' },
            { status: 500 }
        );
    }
}
