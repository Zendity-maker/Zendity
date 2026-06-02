import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateMonthlyInvoicesForHq } from '@/lib/monthly-invoicing';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/monthly-invoicing
 *
 * Cron del día 1 de cada mes a las 6 AM AST (10 UTC). Para cada sede activa,
 * genera Invoice PENDING por cada paciente ACTIVE con monthlyFee>0. Envía
 * email automático a familiar primario.
 *
 * Idempotente: si por alguna razón corre dos veces el mismo día, los pacientes
 * que ya tienen factura del mes se skipean (verificación por rango issueDate
 * del mes actual).
 *
 * dueDate = día 5 del mismo mes (configurado en el lib).
 *
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Mes del cobro = el mes en curso al momento del cron (PR timezone).
        const nowPR = new Date(Date.now() - 4 * 3600 * 1000);
        const year = nowPR.getUTCFullYear();
        const month = nowPR.getUTCMonth();

        const hqs = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const results = [];
        for (const hq of hqs) {
            try {
                const r = await generateMonthlyInvoicesForHq({
                    hqId: hq.id,
                    year,
                    month,
                    dueDay: 5,
                    sendEmails: true,
                });
                results.push({ hq: hq.name, ...r });
            } catch (e: any) {
                logError('cron.monthly-invoicing.hq', e, { hqId: hq.id });
                results.push({ hq: hq.name, error: e.message });
            }
        }

        return NextResponse.json({ success: true, month, year, results });
    } catch (err: any) {
        logError('cron.monthly-invoicing', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
