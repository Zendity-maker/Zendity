import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { generateBillingMonthPDF, type BillingMonthRow } from '@/lib/billing-month-pdf';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MONTHS_ES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

/**
 * GET /api/corporate/billing/export-pdf?month=YYYY-MM
 *
 * PDF mensual con todas las facturas del mes (issueDate dentro del rango).
 * Para contabilidad, auditoría, archivo físico. Mes default: en curso.
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

        const hq = await prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true } });

        const invoices = await prisma.invoice.findMany({
            where: { headquartersId: hqId, issueDate: { gte: from, lt: to } },
            include: { patient: { select: { name: true, roomNumber: true } } },
            orderBy: [{ patient: { name: 'asc' } }, { issueDate: 'asc' }],
        });

        const rows: BillingMonthRow[] = invoices.map(i => ({
            invoiceNumber: i.invoiceNumber,
            patientName: i.patient?.name || 'Residente',
            roomNumber: i.patient?.roomNumber || null,
            issueDate: i.issueDate,
            dueDate: i.dueDate,
            totalAmount: i.totalAmount,
            amountPaid: i.amountPaid,
            status: i.status,
            paidAt: i.paidAt,
            paymentMethod: i.paymentMethod,
            referenceNumber: i.referenceNumber,
        }));
        const totalFacturado = rows.reduce((s, r) => s + r.totalAmount, 0);
        const cobrado = rows.reduce((s, r) => s + r.amountPaid, 0);
        const pendiente = totalFacturado - cobrado;
        const monthLabel = `${MONTHS_ES[month]} ${year}`;

        const pdf = generateBillingMonthPDF({
            hqName: hq?.name || 'Sede',
            monthLabel,
            rows,
            totalFacturado,
            cobrado,
            pendiente,
        });

        return new NextResponse(pdf as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Facturacion_${monthLabel.replace(/ /g, '_')}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        logError('corporate.billing.export-pdf', err);
        return NextResponse.json({ success: false, error: 'Error PDF' }, { status: 500 });
    }
}
