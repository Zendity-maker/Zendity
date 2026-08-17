import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getBillableResidents } from '@/lib/billable-residents';
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
        // UTC, no hora local. `monthly-invoicing.ts` escribe issueDate con
        // Date.UTC(year, month, 1) → exactamente 00:00Z. Si el lector construye
        // el rango en hora local, en cualquier runtime con TZ != UTC (AST, por
        // ejemplo) el `from` queda 4h por delante y TODAS las facturas del mes
        // caen fuera del filtro: el dashboard reporta $0 facturado. En Vercel
        // funcionaba solo porque su runtime corre en UTC.
        const from = new Date(Date.UTC(year, month, 1));
        const to = new Date(Date.UTC(year, month + 1, 1));

        const invoicesMes = await prisma.invoice.findMany({
            where: { headquartersId: hqId, issueDate: { gte: from, lt: to } },
            select: { totalAmount: true, amountPaid: true, status: true, patientId: true },
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

        // COBERTURA DE FACTURACIÓN — el KPI que faltaba.
        //
        // El cron del día 1 es una foto puntual: quien se vuelve elegible después
        // (alta a mitad de mes, cuota cargada tarde, cambio de estado) no se
        // factura y nadie se entera. En agosto 2026 eso dejó 7 residentes sin
        // factura y $23,798 sin emitir, detectado solo porque el Director contó
        // el censo a mano.
        //
        // Excluimos a quien ingresó DESPUÉS del mes consultado: no se le puede
        // reclamar una factura de un mes en que no vivía aquí. admissionDate es
        // la fuente correcta; createdAt es el fallback mientras se puebla.
        const facturables = await getBillableResidents(hqId);
        const conFactura = new Set(invoicesMes.map(i => i.patientId));
        const esperados = facturables.filter(p => {
            if (p.monthlyFee <= 0) return false;
            const ingreso = p.admissionDate ?? p.createdAt;
            return ingreso < to;
        });
        const sinFactura = esperados.filter(p => !conFactura.has(p.id));
        const montoNoFacturado = sinFactura.reduce((s, p) => s + p.monthlyFee, 0);

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
            cobertura: {
                residentesEsperados: esperados.length,
                residentesFacturados: esperados.length - sinFactura.length,
                residentesSinFactura: sinFactura.length,
                montoNoFacturado,
                // Lista accionable: con esto el Director aprieta "Generar facturas
                // del mes" sabiendo exactamente a quién le falta.
                detalle: sinFactura.map(p => ({
                    id: p.id,
                    name: p.name.trim(),
                    status: p.status,
                    monthlyFee: p.monthlyFee,
                    ingreso: (p.admissionDate ?? p.createdAt).toISOString(),
                })),
            },
        });
    } catch (err: any) {
        logError('corporate.billing.stats', err);
        return NextResponse.json({ success: false, error: 'Error stats' }, { status: 500 });
    }
}
