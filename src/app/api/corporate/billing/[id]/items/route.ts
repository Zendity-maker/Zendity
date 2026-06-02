import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/corporate/billing/[id]/items
 *
 * Agrega una línea (InvoiceItem) a una factura PENDING. Casos típicos:
 * "Visita podólogo $80", "Pañales extra $35", etc. Solo permite si la
 * factura está en PENDING — una vez PAID, los items quedan congelados.
 *
 * Body: { description, quantity, unitPrice }
 *
 * Recalcula totalAmount de la factura tras la inserción.
 *
 * Auth: DIRECTOR/ADMIN.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: invoiceId } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const description = (body.description || '').toString().trim();
        const quantity = Math.max(1, parseInt(body.quantity, 10) || 1);
        const unitPrice = parseFloat(body.unitPrice);

        if (!description || !Number.isFinite(unitPrice) || unitPrice < 0) {
            return NextResponse.json({ success: false, error: 'description y unitPrice requeridos' }, { status: 400 });
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, headquartersId: hqId },
            select: { id: true, status: true, taxRate: true },
        });
        if (!invoice) return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
        if (invoice.status !== 'PENDING' && invoice.status !== 'OVERDUE') {
            return NextResponse.json({ success: false, error: 'Solo se pueden agregar líneas a facturas PENDING/OVERDUE' }, { status: 409 });
        }

        const totalPrice = quantity * unitPrice;
        await prisma.invoiceItem.create({
            data: { invoiceId, description, quantity, unitPrice, totalPrice },
        });

        // Recalcular subtotal/totalAmount con todos los items
        const allItems = await prisma.invoiceItem.findMany({
            where: { invoiceId },
            select: { totalPrice: true },
        });
        const subtotal = allItems.reduce((sum, i) => sum + i.totalPrice, 0);
        const totalAmount = subtotal + subtotal * (invoice.taxRate || 0);

        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { subtotal, totalAmount },
            include: { items: true, patient: { select: { name: true } } },
        });

        return NextResponse.json({ success: true, invoice: updated });
    } catch (err: any) {
        logError('corporate.billing.items.post', err);
        return NextResponse.json({ success: false, error: 'Error agregando línea' }, { status: 500 });
    }
}
