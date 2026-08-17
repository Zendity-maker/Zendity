import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateMonthlyInvoicesForHq } from '@/lib/monthly-invoicing';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/logger';
import { requireCronSecret } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/monthly-invoicing
 *
 * Corre DIARIO a las 6 AM AST (10 UTC). Para cada sede activa, genera Invoice
 * PENDING por cada residente facturable con monthlyFee>0 que aún no tenga
 * factura del mes en curso. Envía email al familiar primario.
 *
 * Por qué diario y no el día 1 (cambiado 17-ago-2026): el cron mensual era una
 * foto puntual del día 1. Quien se volvía elegible un minuto después no se
 * facturaba nunca —y nadie se enteraba. En agosto 2026 eso dejó 7 residentes
 * sin factura y $23,798 sin emitir, por tres causas distintas: altas después
 * del día 1, residentes en TEMPORARY_LEAVE ese día, y cuotas cargadas tarde.
 * Correrlo a diario cubre las tres sin lógica adicional.
 *
 * Es seguro porque el lib es idempotente: los residentes que ya tienen factura
 * del mes se saltan por rango de issueDate. Las 364 corridas restantes del mes
 * no crean nada y solo escriben su SystemAuditLog.
 *
 * dueDate = día 5 del mes; si ya pasó al momento de emitir, plazo mínimo de
 * 5 días para que la factura no nazca vencida (ver lib).
 *
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

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

                // Trazabilidad de la corrida. Antes, el resultado solo viajaba en
                // el response HTTP del cron y se perdía: no había forma de saber
                // si corrió, cuántas facturas creó, ni a quién salteó. Reconstruir
                // la corrida de agosto 2026 hubo que hacerlo por arqueología de
                // createdAt.
                //
                // Solo se registra cuando efectivamente creó facturas: al correr
                // a diario, loguear las corridas vacías serían ~360 filas de ruido
                // por sede al año que enterrarían las corridas que sí importan.
                if (r.created > 0) {
                    await logAudit({
                        headquartersId: hq.id,
                        action: 'CREATED',
                        entityName: 'MonthlyInvoicingRun',
                        entityId: `${year}-${String(month + 1).padStart(2, '0')}`,
                        resourceName: `Facturación mensual ${String(month + 1).padStart(2, '0')}/${year} — ${hq.name}`,
                        payloadChanges: {
                            eligiblePatients: r.eligiblePatients,
                            created: r.created,
                            prorated: r.proratedCount,
                            skippedExisting: r.skippedExisting,
                            skippedNoFee: r.skippedNoFee,
                            emailsSent: r.emailsSent,
                        },
                    });
                }
            } catch (e: any) {
                logError('cron.monthly-invoicing.hq', e, { hqId: hq.id });
                results.push({ hq: hq.name, error: e.message });

                await logAudit({
                    headquartersId: hq.id,
                    action: 'CREATED',
                    entityName: 'MonthlyInvoicingRun',
                    entityId: `${year}-${String(month + 1).padStart(2, '0')}`,
                    resourceName: `Facturación mensual ${String(month + 1).padStart(2, '0')}/${year} — ${hq.name} (FALLÓ)`,
                    payloadChanges: { error: e.message },
                });
            }
        }

        return NextResponse.json({ success: true, month, year, results });
    } catch (err: any) {
        logError('cron.monthly-invoicing', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
