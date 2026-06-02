import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/billing/stats?month=YYYY-MM
 *
 * KPIs del dashboard de facturación. Mes por defecto: en curso.
 *
 * Devuelve:
 *   - totalFacturadoMes   (sum totalAmount de las invoices con issueDate en el mes)
 *   - cobradoMes          (sum amountPaid de las del mes)
 *   - pendienteMes        (totalFacturadoMes - cobradoMes)
 *   - vencidoTotal        (sum totalAmount-amountPaid de OVERDUE, sin filtro de mes)
 *   - countPending / Paid / Overdue
 *   - tasaCobranza (% cobrado / facturado)
 *
 * Auth: DIRECTOR/ADMIN.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { searchParams } = new URL(req.url);
        const monthParam = searchParams.get('month');
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth();
        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            const [y, m] = monthParam.split('-').map(Number);
            year = y; month = m - 1;
        }
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 1);

        const invoicesMes = await prisma.invoice.findMany({
            where: { headquartersId: hqId, issueDate: { gte: from, lt: to } },
            select: { totalAmount: true, amountPaid: true, status: true },
        });
        const totalFacturadoMes = invoicesMes.reduce((s, i) => s + i.totalAmount, 0);
        const cobradoMes = invoicesMes.reduce((s, i) => s + i.amountPaid, 0);
        const pendienteMes = totalFacturadoMes - cobradoMes;

        const countPending = invoicesMes.filter(i => i.status === 'PENDING').length;
        const countPaid = invoicesMes.filter(i => i.status === 'PAID').length;
        const countOverdue = invoicesMes.filter(i => i.status === 'OVERDUE').length;

        const overdueAll = await prisma.invoice.findMany({
            where: { headquartersId: hqId, status: 'OVERDUE' },
            select: { totalAmount: true, amountPaid: true },
        });
        const vencidoTotal = overdueAll.reduce((s, i) => s + (i.totalAmount - i.amountPaid), 0);

        const tasaCobranza = totalFacturadoMes > 0
            ? Math.round((cobradoMes / totalFacturadoMes) * 100)
            : null;

        return NextResponse.json({
            success: true,
            period: { from: from.toISOString(), to: to.toISOString(), year, month },
            totalFacturadoMes,
            cobradoMes,
            pendienteMes,
            vencidoTotal,
            countPending,
            countPaid,
            countOverdue,
            tasaCobranza,
        });
    } catch (err: any) {
        logError('corporate.billing.stats', err);
        return NextResponse.json({ success: false, error: 'Error stats' }, { status: 500 });
    }
}
