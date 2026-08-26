import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { ROLES_APRUEBAN, cobrarEnFacturaDelMes } from '@/lib/concierge';

/**
 * POST /api/corporate/concierge/decidir
 *
 * Aprobar, rechazar, entregar o completar un pedido de Concierge.
 *
 * Body: { tipo: 'producto'|'servicio', id, accion, especialistaId?, motivo? }
 *
 * EL COBRO OCURRE AQUI, y solo en 'entregar' / 'completar'. Aprobar no cobra
 * nada: de las dos citas que llegaron a existir, una se cancelo sin
 * especialista asignado, y cobrando al aprobar esa familia habria pagado una
 * barberia que nunca ocurrio.
 */
const ACCIONES = ['aprobar', 'rechazar', 'entregar', 'completar', 'cancelar'] as const;

export async function POST(req: Request) {
    try {
        const auth = await requireRole([...ROLES_APRUEBAN]);
        if (auth instanceof NextResponse) return auth;

        const { tipo, id, accion, especialistaId, motivo } = await req.json();
        if (!tipo || !id || !ACCIONES.includes(accion)) {
            return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
        }
        if (accion === 'rechazar' && !(motivo || '').trim()) {
            return NextResponse.json(
                { success: false, error: 'Di por qué se rechaza. La familia va a leerlo.' },
                { status: 400 },
            );
        }

        // ───────────────────────── PRODUCTOS ─────────────────────────
        if (tipo === 'producto') {
            const pedido = await prisma.conciergeOrder.findFirst({
                where: { id, patient: { headquartersId: auth.headquartersId } },
                select: {
                    id: true, status: true, totalPrice: true, patientId: true, productId: true,
                    product: { select: { name: true, stock: true } },
                },
            });
            if (!pedido) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });

            if (accion === 'aprobar') {
                if (pedido.status !== 'PENDING') {
                    return NextResponse.json({ success: false, error: 'Este pedido ya fue decidido.' }, { status: 400 });
                }
                if (pedido.product.stock <= 0) {
                    return NextResponse.json({ success: false, error: 'Sin stock. Rechaza el pedido o repone antes.' }, { status: 400 });
                }
                await prisma.conciergeOrder.update({
                    where: { id },
                    data: { status: 'APPROVED', approvedById: auth.id, approvedAt: new Date() },
                });
                return NextResponse.json({ success: true, estado: 'APPROVED' });
            }

            if (accion === 'rechazar' || accion === 'cancelar') {
                await prisma.conciergeOrder.update({
                    where: { id },
                    data: {
                        status: accion === 'rechazar' ? 'REJECTED' : 'CANCELLED',
                        rejectedReason: (motivo || '').trim() || null,
                    },
                });
                return NextResponse.json({ success: true, estado: accion === 'rechazar' ? 'REJECTED' : 'CANCELLED' });
            }

            if (accion === 'entregar') {
                if (pedido.status !== 'APPROVED') {
                    return NextResponse.json({ success: false, error: 'Hay que aprobarlo antes de entregarlo.' }, { status: 400 });
                }
                // El stock se descuenta AL ENTREGAR, no al pedir: reservar por
                // algo que puede rechazarse deja producto bloqueado sin motivo.
                const itemId = await cobrarEnFacturaDelMes(
                    pedido.patientId,
                    `Concierge: ${pedido.product.name}`,
                    pedido.totalPrice,
                );
                await prisma.$transaction([
                    prisma.conciergeOrder.update({
                        where: { id },
                        data: { status: 'DELIVERED', invoicedAt: new Date(), invoiceItemId: itemId },
                    }),
                    prisma.conciergeProduct.update({
                        where: { id: pedido.productId },
                        data: { stock: { decrement: 1 } },
                    }),
                ]);
                return NextResponse.json({ success: true, estado: 'DELIVERED', cobrado: pedido.totalPrice });
            }
        }

        // ───────────────────────── SERVICIOS ─────────────────────────
        if (tipo === 'servicio') {
            const cita = await prisma.conciergeAppointment.findFirst({
                where: { id, patient: { headquartersId: auth.headquartersId } },
                select: {
                    id: true, status: true, patientId: true, agreedPrice: true,
                    service: { select: { name: true, price: true } },
                },
            });
            if (!cita) return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });

            const precio = cita.agreedPrice ?? cita.service.price;

            if (accion === 'aprobar') {
                if (cita.status !== 'PENDING_APPROVAL') {
                    return NextResponse.json({ success: false, error: 'Esta cita ya fue decidida.' }, { status: 400 });
                }
                // Aprobar SIN especialista es como se perdio la unica cita que
                // llegaron a pedir: quedo sin asignar y acabo cancelada.
                if (!especialistaId) {
                    return NextResponse.json(
                        { success: false, error: 'Asigna un especialista al aprobar. Una cita sin especialista termina cancelándose.' },
                        { status: 400 },
                    );
                }
                const esp = await prisma.user.findFirst({
                    where: { id: especialistaId, headquartersId: auth.headquartersId, isActive: true },
                    select: { id: true },
                });
                if (!esp) return NextResponse.json({ success: false, error: 'Especialista no válido' }, { status: 400 });

                await prisma.conciergeAppointment.update({
                    where: { id },
                    data: {
                        status: 'SCHEDULED',
                        specialistId: especialistaId,
                        approvedById: auth.id,
                        approvedAt: new Date(),
                    },
                });
                return NextResponse.json({ success: true, estado: 'SCHEDULED' });
            }

            if (accion === 'rechazar' || accion === 'cancelar') {
                await prisma.conciergeAppointment.update({
                    where: { id },
                    data: {
                        status: accion === 'rechazar' ? 'REJECTED' : 'CANCELLED',
                        rejectedReason: (motivo || '').trim() || null,
                    },
                });
                return NextResponse.json({ success: true, estado: accion === 'rechazar' ? 'REJECTED' : 'CANCELLED' });
            }

            if (accion === 'completar') {
                if (!['SCHEDULED', 'IN_PROGRESS'].includes(cita.status)) {
                    return NextResponse.json({ success: false, error: 'Solo se completa una cita aprobada.' }, { status: 400 });
                }
                const itemId = await cobrarEnFacturaDelMes(
                    cita.patientId,
                    `Concierge: ${cita.service.name}`,
                    precio,
                );
                await prisma.conciergeAppointment.update({
                    where: { id },
                    data: { status: 'COMPLETED', invoicedAt: new Date(), invoiceItemId: itemId },
                });
                return NextResponse.json({ success: true, estado: 'COMPLETED', cobrado: precio });
            }
        }

        return NextResponse.json({ success: false, error: 'Acción no aplicable a este tipo.' }, { status: 400 });
    } catch (e: any) {
        console.error('[concierge/decidir] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
