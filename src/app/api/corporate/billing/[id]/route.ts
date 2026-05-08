import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/corporate/billing/[id]
 *
 * Edita un recibo PENDING u OVERDUE.
 * Permite cambiar: dueDate, notes, items (se borran y recrean).
 * No permite cambiar paciente ni estado.
 * No editable si status = PAID | CANCELLED.
 */
export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const { id } = params;

        // Verificar que la factura pertenece a esta sede
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: { id: true, headquartersId: true, status: true }
        });

        if (!invoice || invoice.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
        }

        if (['PAID', 'CANCELLED'].includes(invoice.status)) {
            return NextResponse.json(
                { success: false, error: 'No se puede editar una factura pagada o cancelada' },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { dueDate, notes, items } = body;

        if (!items || items.length === 0) {
            return NextResponse.json({ success: false, error: 'Se requiere al menos un concepto' }, { status: 400 });
        }

        // Recalcular totales
        const subtotal = items.reduce(
            (acc: number, item: { quantity: number; unitPrice: number }) =>
                acc + item.quantity * item.unitPrice,
            0
        );
        const taxRate = 0; // misma lógica que en POST
        const totalAmount = subtotal + subtotal * taxRate;

        // Actualizar en transacción: borrar items viejos y crear nuevos
        const updated = await prisma.$transaction(async (tx) => {
            await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

            return tx.invoice.update({
                where: { id },
                data: {
                    dueDate: dueDate ? new Date(dueDate) : undefined,
                    notes: notes ?? undefined,
                    subtotal,
                    taxRate,
                    totalAmount,
                    updatedAt: new Date(),
                    items: {
                        create: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.quantity * item.unitPrice,
                        }))
                    }
                },
                include: { items: true, patient: true }
            });
        });

        return NextResponse.json({ success: true, invoice: updated });

    } catch (err: any) {
        console.error('[billing PATCH]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
