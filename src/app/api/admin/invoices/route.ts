import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/invoices — lista facturas SaaS de todas las sedes.
 * Orden: dueDate ASC (las más urgentes primero).
 */
export async function GET(req: Request) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status'); // opcional: filtrar por estado
        const hqId = searchParams.get('hqId');

        const where: any = {};
        if (status) where.status = status;
        if (hqId) where.headquartersId = hqId;

        const invoices = await prisma.saaSInvoice.findMany({
            where,
            include: {
                headquarters: { select: { id: true, name: true, logoUrl: true } },
                items: true,
            },
            orderBy: { dueDate: 'asc' },
        });

        return NextResponse.json({ success: true, invoices });
    } catch (e: any) {
        console.error('[/api/admin/invoices]', e);
        return NextResponse.json({ success: false, error: 'Error cargando facturas' }, { status: 500 });
    }
}

/**
 * POST /api/admin/invoices — emitir factura SaaS manual.
 */
export async function POST(req: Request) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { headquartersId, dueDate, items, notes, taxRate } = await req.json();
        if (!headquartersId || !dueDate || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, error: 'headquartersId, dueDate e items son obligatorios' }, { status: 400 });
        }

        const shortId = randomUUID().split('-')[0].toUpperCase();
        const mm = String(new Date().getMonth() + 1).padStart(2, '0');
        const yy = String(new Date().getFullYear()).slice(-2);
        const invoiceNumber = `ZEN-${yy}${mm}-${shortId}`;

        const subtotal = items.reduce((acc: number, it: any) => acc + (Number(it.quantity) * Number(it.unitPrice)), 0);
        const taxVal = taxRate ? subtotal * (Number(taxRate) / 100) : 0;
        const totalAmount = subtotal + taxVal;

        const invoice = await prisma.saaSInvoice.create({
            data: {
                headquartersId,
                invoiceNumber,
                dueDate: new Date(dueDate),
                subtotal,
                taxRate: taxRate ? Number(taxRate) : 0,
                totalAmount,
                notes: notes || null,
                items: {
                    create: items.map((it: any) => ({
                        description: it.description,
                        quantity: Number(it.quantity),
                        unitPrice: Number(it.unitPrice),
                        totalPrice: Number(it.quantity) * Number(it.unitPrice),
                    })),
                },
            },
            include: { items: true, headquarters: { select: { name: true } } },
        });

        return NextResponse.json({ success: true, invoice });
    } catch (e: any) {
        console.error('[/api/admin/invoices POST]', e);
        return NextResponse.json({ success: false, error: 'Error creando factura' }, { status: 500 });
    }
}
