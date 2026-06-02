import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/billing-overdue
 *
 * Cron diario 7 AM AST (11 UTC). Para cada sede:
 *   1. Encuentra Invoice status=PENDING con dueDate < now → cambia a OVERDUE
 *   2. Cuenta el total vencido del HQ
 *   3. Si hay nuevos vencidos o ya hay un balance vencido > 0, notifica
 *      a DIRECTOR/ADMIN
 *
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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

            // 3. Notificar si hubo cambios HOY o si hay backlog
            if (updated.count > 0 || overdue.length > 0) {
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
