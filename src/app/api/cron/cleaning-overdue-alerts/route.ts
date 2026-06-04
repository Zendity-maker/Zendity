import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/cron-auth';

// Cron: notifica a SUPERVISOR/DIRECTOR cuando alguna área activa lleva
// más de 24h sin ningún log (ni COMPLETED ni SKIPPED).
// Una sola notificación agregada por sede por corrida (no spam por área).
// Schedule: 09:00 cada día (ver vercel.json) — antes del comienzo del turno.
export async function GET(request: Request) {
    const denied = requireCronSecret(request);
    if (denied) return denied;

    try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const headquarters = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const summary: Array<{ hqId: string; hqName: string; overdueCount: number; notified: number }> = [];

        for (const hq of headquarters) {
            const areas = await prisma.cleaningArea.findMany({
                where: { headquartersId: hq.id, isActive: true },
                select: { id: true, name: true },
            });
            if (areas.length === 0) {
                summary.push({ hqId: hq.id, hqName: hq.name, overdueCount: 0, notified: 0 });
                continue;
            }

            // Último log por área en las últimas 24h
            const recentLogs = await prisma.cleaningLog.findMany({
                where: {
                    headquartersId: hq.id,
                    cleanedAt: { gte: cutoff },
                },
                select: { areaId: true },
                distinct: ['areaId'],
            });
            const recentlyLogged = new Set(recentLogs.map(l => l.areaId));
            const overdueAreas = areas.filter(a => !recentlyLogged.has(a.id));

            if (overdueAreas.length === 0) {
                summary.push({ hqId: hq.id, hqName: hq.name, overdueCount: 0, notified: 0 });
                continue;
            }

            // Notificar a supervisores/directores de la sede
            const recipients = await prisma.user.findMany({
                where: {
                    headquartersId: hq.id,
                    role: { in: ['SUPERVISOR', 'DIRECTOR'] },
                    isActive: true,
                    isDeleted: false,
                },
                select: { id: true },
            });

            const sample = overdueAreas.slice(0, 3).map(a => a.name).join(', ');
            const more = overdueAreas.length > 3 ? ` y ${overdueAreas.length - 3} más` : '';

            if (recipients.length > 0) {
                await prisma.notification.createMany({
                    data: recipients.map(r => ({
                        userId: r.id,
                        type: 'CLEANING_OVERDUE',
                        title: `${overdueAreas.length} área(s) sin limpiar en 24h`,
                        message: `${sample}${more}`,
                        isRead: false,
                    })),
                });
            }

            summary.push({
                hqId: hq.id,
                hqName: hq.name,
                overdueCount: overdueAreas.length,
                notified: recipients.length,
            });
        }

        return NextResponse.json({
            success: true,
            ranAt: new Date().toISOString(),
            summary,
        });
    } catch (error) {
        console.error('[CRON cleaning-overdue-alerts] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error generando alertas' },
            { status: 500 }
        );
    }
}
