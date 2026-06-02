import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { generateMonthlyInvoicesForHq } from '@/lib/monthly-invoicing';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/corporate/billing/generate-month
 *
 * Botón manual del dashboard de facturación: "Generar facturas del mes
 * actual". Útil cuando:
 *   - El cron falló (verificable por SystemAuditLog)
 *   - Hay residentes nuevos del mismo mes que no estaban activos cuando el
 *     cron corrió el día 1
 *   - El director quiere regenerar el mes anterior por backfill
 *
 * Body opcional:
 *   - month: 0-11 (default: mes en curso)
 *   - year: int (default: año en curso)
 *   - sendEmails: bool (default true)
 *
 * Idempotente vía el lib — los residentes que ya tienen factura del mes
 * indicado se skipean. NO duplica.
 *
 * Auth: DIRECTOR/ADMIN.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const nowPR = new Date(Date.now() - 4 * 3600 * 1000);
        const year = typeof body.year === 'number' ? body.year : nowPR.getUTCFullYear();
        const month = typeof body.month === 'number' ? body.month : nowPR.getUTCMonth();
        const sendEmails = body.sendEmails !== false;

        if (month < 0 || month > 11) {
            return NextResponse.json({ success: false, error: 'month inválido (0-11)' }, { status: 400 });
        }

        const result = await generateMonthlyInvoicesForHq({
            hqId,
            year,
            month,
            dueDay: 5,
            sendEmails,
        });

        return NextResponse.json({
            success: true,
            ...result,
            message: result.created === 0
                ? (result.skippedExisting > 0
                    ? `Sin facturas nuevas — ya existen ${result.skippedExisting} para este mes.`
                    : 'Sin pacientes elegibles (verifica que tengan monthlyFee > 0).')
                : `Generadas ${result.created} facturas. ${result.emailsSent} emails enviados.`,
        });
    } catch (err: any) {
        logError('corporate.billing.generate-month', err);
        return NextResponse.json({ success: false, error: err.message || 'Error generando facturas' }, { status: 500 });
    }
}
