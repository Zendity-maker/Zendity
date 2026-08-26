/**
 * Concierge — pedidos de la familia, aprobación y cobro.
 *
 * EL CAMBIO DE FONDO (26-ago-2026): se pasa de prepago a post-pago.
 *
 * Antes había que recargar saldo con una gift card antes de poder comprar. De
 * 33 residentes activos, UNO tenía saldo — $20 — y el producto más barato
 * costaba $32.50. Ni esa persona podía comprar nada: cero pedidos en toda la
 * historia del módulo, no por falta de interés sino porque el escaparate
 * estaba cerrado con llave.
 *
 * Ahora la familia pide, alguien aprueba, y se cobra en la factura del mes.
 * El propio schema ya lo contemplaba: el comentario de InvoiceItem dice
 * literalmente 'Ej. "Cuota Mensual Nivel 1" o "Manicura Concierge"'.
 *
 * SE COBRA AL ENTREGAR, NO AL APROBAR
 *
 * De las dos citas que llegaron a existir, una se canceló sin especialista
 * asignado. Cobrando al aprobar, esa familia habría pagado una barbería que
 * nunca ocurrió — y alguien habría tenido que explicárselo y devolverlo.
 * Facturar al completar significa que la factura solo contiene cosas que de
 * verdad pasaron, y que un cargo disputado deja de ser posible.
 */
import { prisma } from '@/lib/prisma';

/**
 * Tope mensual por residente. Decidido por Andrés: sin prepago desaparece el
 * freno natural, y esto evita que una familia acumule sin darse cuenta.
 *
 * Da para unas dos cajas de Ensure y un servicio, o tres barberías.
 */
export const TOPE_MENSUAL = 150;

/** Quién puede aprobar. Dirección, administración y coordinación de familias. */
export const ROLES_APRUEBAN = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'COORDINATOR'] as const;

function inicioDeMes(): Date {
    // Mes natural en hora de Puerto Rico.
    const pr = new Date(Date.now() - 4 * 3600 * 1000);
    return new Date(Date.UTC(pr.getUTCFullYear(), pr.getUTCMonth(), 1));
}

export interface EstadoTope {
    comprometido: number;
    tope: number;
    disponible: number;
}

/**
 * Cuánto lleva comprometido este residente en el mes.
 *
 * Cuenta lo aprobado y lo entregado, no solo lo cobrado: si esperáramos al
 * cobro, una familia podría acumular diez pedidos aprobados sin que el tope se
 * entere hasta que llega la factura, que es justo lo que el tope evita.
 * Lo rechazado y lo cancelado no cuentan.
 */
export async function topeDelMes(patientId: string): Promise<EstadoTope> {
    const desde = inicioDeMes();

    const [pedidos, citas] = await Promise.all([
        prisma.conciergeOrder.findMany({
            where: {
                patientId,
                createdAt: { gte: desde },
                status: { in: ['APPROVED', 'DELIVERED'] },
            },
            select: { totalPrice: true },
        }),
        prisma.conciergeAppointment.findMany({
            where: {
                patientId,
                createdAt: { gte: desde },
                status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] },
            },
            select: { agreedPrice: true, service: { select: { price: true } } },
        }),
    ]);

    const comprometido =
        pedidos.reduce((a, p) => a + p.totalPrice, 0) +
        citas.reduce((a, c) => a + (c.agreedPrice ?? c.service.price), 0);

    return {
        comprometido: Math.round(comprometido * 100) / 100,
        tope: TOPE_MENSUAL,
        disponible: Math.max(0, Math.round((TOPE_MENSUAL - comprometido) * 100) / 100),
    };
}

/**
 * Añade un cargo a la factura del mes del residente, creándola si no existe.
 *
 * Se llama SOLO al entregar un producto o completar un servicio. Devuelve el
 * id del InvoiceItem, o null si el residente no es facturable.
 */
export async function cobrarEnFacturaDelMes(
    patientId: string,
    descripcion: string,
    precio: number,
): Promise<string | null> {
    const paciente = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true, headquartersId: true },
    });
    if (!paciente) return null;

    const desde = inicioDeMes();

    // La factura del mes en curso, si el cron ya la creó.
    let factura = await prisma.invoice.findFirst({
        where: { patientId, issueDate: { gte: desde }, status: { not: 'CANCELLED' } },
        orderBy: { issueDate: 'desc' },
        select: { id: true },
    });

    if (!factura) {
        // Todavía no hay factura del mes: se crea una para colgar el cargo.
        // El cron mensual la respeta porque busca por residente y periodo.
        const vence = new Date(Date.now() + 30 * 24 * 3600 * 1000);
        factura = await prisma.invoice.create({
            data: {
                headquartersId: paciente.headquartersId,
                patientId,
                invoiceNumber: `CNC-${Date.now().toString(36).toUpperCase()}`,
                dueDate: vence,
                subtotal: 0,
                totalAmount: 0,
                status: 'PENDING',
                notes: 'Incluye servicios y productos de Concierge del mes.',
            },
            select: { id: true },
        });
    }

    const item = await prisma.invoiceItem.create({
        data: {
            invoiceId: factura.id,
            description: descripcion,
            quantity: 1,
            unitPrice: precio,
            totalPrice: precio,
        },
        select: { id: true },
    });

    await prisma.invoice.update({
        where: { id: factura.id },
        data: {
            subtotal: { increment: precio },
            totalAmount: { increment: precio },
        },
    });

    return item.id;
}
