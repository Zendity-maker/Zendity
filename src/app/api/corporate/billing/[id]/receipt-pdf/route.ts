import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { generateReceiptPDF } from '@/lib/receipt-pdf';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/billing/[id]/receipt-pdf
 *
 * PDF del recibo de una factura PAID. El admin lo descarga desde la UI
 * del director. La familia tiene un endpoint paralelo en /api/family/billing.
 *
 * Auth: DIRECTOR/ADMIN.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const inv = await prisma.invoice.findFirst({
            where: { id, headquartersId: hqId },
            include: {
                items: true,
                patient: { select: { name: true, roomNumber: true, primaryFamilyMember: { select: { name: true } } } },
                headquarters: { select: { name: true, phone: true } },
            },
        });
        if (!inv) return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
        if (inv.status !== 'PAID' || !inv.paidAt) {
            return NextResponse.json({ success: false, error: 'Solo facturas pagadas tienen recibo' }, { status: 409 });
        }

        const pdfBuffer = generateReceiptPDF({
            hqName: inv.headquarters?.name || 'Sede',
            hqPhone: inv.headquarters?.phone || null,
            invoiceNumber: inv.invoiceNumber,
            issueDate: inv.issueDate,
            paidAt: inv.paidAt,
            paymentMethod: inv.paymentMethod || 'OTHER',
            referenceNumber: inv.referenceNumber,
            patientName: inv.patient?.name || 'Residente',
            patientRoom: inv.patient?.roomNumber || null,
            familyName: inv.patient?.primaryFamilyMember?.name || null,
            items: inv.items.map(i => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.totalPrice,
            })),
            subtotal: inv.subtotal,
            totalAmount: inv.totalAmount,
            notes: inv.notes,
        });

        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Recibo_${inv.invoiceNumber}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        logError('corporate.billing.receipt-pdf', err);
        return NextResponse.json({ success: false, error: 'Error generando PDF' }, { status: 500 });
    }
}
