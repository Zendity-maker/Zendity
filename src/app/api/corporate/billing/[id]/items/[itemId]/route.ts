import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/corporate/billing/[id]/items/[itemId]
 *
 * Borra una línea de factura PENDING/OVERDUE. Recalcula totalAmount.
 * Bloqueado si la factura ya está PAID o CANCELLED.
 *
 * Auth: DIRECTOR/ADMIN.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
    try {
        const { id: invoiceId, itemId } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, headquartersId: hqId },
            select: { id: true, status: true, taxRate: true },
        });
        if (!invoice) return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
        if (invoice.status !== 'PENDING' && invoice.status !== 'OVERDUE') {
            return NextResponse.json({ success: false, error: 'No se pueden modificar facturas pagadas/canceladas' }, { status: 409 });
        }

        const item = await prisma.invoiceItem.findFirst({
            where: { id: itemId, invoiceId },
        });
        if (!item) return NextResponse.json({ success: false, error: 'Línea no encontrada' }, { status: 404 });

        await prisma.invoiceItem.delete({ where: { id: itemId } });

        const remaining = await prisma.invoiceItem.findMany({ where: { invoiceId }, select: { totalPrice: true } });
        const subtotal = remaining.reduce((sum, i) => sum + i.totalPrice, 0);
        const totalAmount = subtotal + subtotal * (invoice.taxRate || 0);
        await prisma.invoice.update({ where: { id: invoiceId }, data: { subtotal, totalAmount } });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        logError('corporate.billing.items.delete', err);
        return NextResponse.json({ success: false, error: 'Error eliminando línea' }, { status: 500 });
    }
}
