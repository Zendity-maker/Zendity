import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/invoices/[id]/pay — marca factura como PAID.
 */
export async function PATCH(_req: Request, context: any) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { id } = await context.params;
        if (!id) return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });

        const invoice = await prisma.saaSInvoice.update({
            where: { id },
            data: { status: 'PAID', paidAt: new Date() },
        });

        return NextResponse.json({ success: true, invoice });
    } catch (e: any) {
        if (e.code === 'P2025') {
            return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
        }
        console.error('[/api/admin/invoices/[id]/pay]', e);
        return NextResponse.json({ success: false, error: 'Error marcando factura' }, { status: 500 });
    }
}
