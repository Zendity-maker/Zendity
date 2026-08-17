import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';
import { logError } from '@/lib/logger';
import { requireCronSecret } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/billing-overdue
 *
 * Cron diario 7 AM AST (11 UTC). Para cada sede:
 *   1. Encuentra Invoice status=PENDING con dueDate < now → cambia a OVERDUE
 *   2. Cuenta el total vencido del HQ
 *   3. Notifica a DIRECTOR/ADMIN solo si algo venció HOY (el backlog
 *      permanente vive en los KPIs de /corporate/billing, no en la campana)
 *
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        const now = new Date();
        const hqs = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const results = [];
        for (const hq of hqs) {
            // 1. Pasar PENDING vencidas a OVERDUE
            const updated = await prisma.invoice.updateMany({
                where: { headquartersId: hq.id, status: 'PENDING', dueDate: { lt: now } },
                data: { status: 'OVERDUE' },
            });

            // 2. Total vencido actual (todas las OVERDUE no pagadas del HQ)
            const overdue = await prisma.invoice.findMany({
                where: { headquartersId: hq.id, status: 'OVERDUE' },
                select: { totalAmount: true, amountPaid: true },
            });
            const totalOverdue = overdue.reduce((sum, i) => sum + (i.totalAmount - i.amountPaid), 0);

            // 3. Notificar SOLO si algo venció HOY. Antes el `|| overdue.length`
            // repetía la misma campana diaria con el mismo backlog (las mismas
            // 26 facturas, 90 notifs/mes al Director) — recordatorio que ya no
            // informa nada. El backlog permanente vive en los KPIs de
            // /corporate/billing (vencidoTotal), que es su lugar.
            if (updated.count > 0) {
                try {
                    await notifyRoles(hq.id, ['DIRECTOR', 'ADMIN'], {
                        type: 'EMAR_ALERT',
                        title: `📋 ${overdue.length} factura${overdue.length !== 1 ? 's' : ''} vencida${overdue.length !== 1 ? 's' : ''}`,
                        message: `Balance vencido total: $${totalOverdue.toFixed(2)}${updated.count > 0 ? ` · ${updated.count} marcadas como vencidas hoy.` : ''}`,
                        link: '/corporate/billing',
                    });
                } catch { /* best-effort */ }
            }

            results.push({
                hq: hq.name,
                newlyOverdue: updated.count,
                totalOverdueCount: overdue.length,
                totalOverdueAmount: totalOverdue,
            });
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        logError('cron.billing-overdue', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
