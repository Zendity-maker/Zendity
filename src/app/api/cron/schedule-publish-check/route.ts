import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';
import { logError, logWarn } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/schedule-publish-check
 *
 * Cron lunes 6 AM AST. Para CADA sede activa: busca un Schedule en DRAFT
 * con weekStartDate en la semana actual (lunes recién pasado o el lunes mismo)
 * y al menos 1 shift. Si lo encuentra → notifica DIRECTOR/ADMIN.
 *
 * Defensa de último recurso para evitar que la semana pase con el horario
 * sin publicar. La causa raíz histórica era el modal de publicación que
 * confundía warnings con errores; ese modal ya está rediseñado (Fix B),
 * pero este cron es el cinturón de seguridad.
 *
 * Auth: Bearer CRON_SECRET (mismo patrón que otros crons).
 * Schedule: lunes 6 AM AST → 10 AM UTC.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Lunes 00:00 hora PR (UTC-4) → 04:00 UTC. El cron corre a las 10 UTC
        // (6 AM AST) del lunes, así que la "semana actual" empieza ese mismo
        // lunes (o el más reciente si por alguna razón llega un día tarde).
        const nowPR = new Date(Date.now() - 4 * 3600 * 1000);
        const dayOfWeek = nowPR.getUTCDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayUTC = new Date(nowPR.getTime());
        mondayUTC.setUTCDate(nowPR.getUTCDate() - daysFromMonday);
        mondayUTC.setUTCHours(0, 0, 0, 0);
        const mondayReal = new Date(mondayUTC.getTime() + 4 * 3600 * 1000);
        const sundayReal = new Date(mondayReal.getTime() + 7 * 24 * 3600 * 1000);

        const activeHqs = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const results: { hq: string; drafts: number; notified: number }[] = [];
        let totalNotified = 0;

        for (const hq of activeHqs) {
            const drafts = await prisma.schedule.findMany({
                where: {
                    headquartersId: hq.id,
                    status: 'DRAFT',
                    weekStartDate: { gte: mondayReal, lt: sundayReal },
                },
                select: { id: true, weekStartDate: true, _count: { select: { shifts: true } } },
            });
            const withShifts = drafts.filter(d => d._count.shifts > 0);
            if (withShifts.length === 0) {
                results.push({ hq: hq.name, drafts: 0, notified: 0 });
                continue;
            }

            const totalShifts = withShifts.reduce((acc, d) => acc + d._count.shifts, 0);
            try {
                const n = await notifyRoles(hq.id, ['DIRECTOR', 'ADMIN'], {
                    type: 'SCHEDULE_PUBLISHED', // reusamos el type existente — semánticamente "schedule asunto"
                    title: '⚠ Horario de esta semana sin publicar',
                    message: `Tienes ${totalShifts} turnos armados en BORRADOR para la semana del ${withShifts[0].weekStartDate.toLocaleDateString('es-PR', { month: 'long', day: 'numeric' })}. Publica desde el Constructor de Horarios.`,
                    link: '/hr/schedule',
                });
                totalNotified += n;
                results.push({ hq: hq.name, drafts: withShifts.length, notified: n });
            } catch (e) {
                logWarn('cron.schedule-publish-check.notify', e, { hqId: hq.id });
                results.push({ hq: hq.name, drafts: withShifts.length, notified: 0 });
            }
        }

        return NextResponse.json({
            success: true,
            checked: activeHqs.length,
            totalNotified,
            results,
        });
    } catch (err: any) {
        logError('cron.schedule-publish-check', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
