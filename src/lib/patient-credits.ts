import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Saldos a favor de residentes.
 *
 * Principio que impone este módulo: **la factura siempre se emite por el monto
 * completo de la cuota; un adelanto es un pago, nunca un descuento.**
 *
 * Nació del caso Velez Grau (agosto 2026): un familiar adelantó la cuota del
 * mes siguiente y, sin este modelo, la "solución" fue editar la factura a $0 y
 * registrar $1 de pago para poder marcarla PAID. Resultado: $3,000 cobrados de
 * verdad que no existían en ningún reporte, sin recibo emitible y sin forma de
 * defender el cobro ante un reclamo.
 */

/** Crédito con su disponible ya calculado. */
export interface AvailableCredit {
    id: string;
    amount: number;
    appliedAmount: number;
    available: number;
    receivedAt: Date;
    reason: string | null;
}

/**
 * Créditos con saldo disponible de un residente, más antiguos primero (FIFO):
 * un adelanto de julio se consume antes que uno de septiembre.
 */
export async function getAvailableCredits(patientId: string): Promise<AvailableCredit[]> {
    const credits = await prisma.patientCredit.findMany({
        where: { patientId },
        orderBy: { receivedAt: 'asc' },
        select: { id: true, amount: true, appliedAmount: true, receivedAt: true, reason: true },
    });
    return credits
        .map(c => ({ ...c, available: round2(c.amount - c.appliedAmount) }))
        .filter(c => c.available > 0);
}

export interface CreditApplicationResult {
    applied: number;
    /** Saldo que quedó pendiente de cobro tras aplicar créditos. */
    remaining: number;
    creditIds: string[];
}

/**
 * Aplica los créditos disponibles de un residente a una factura recién emitida.
 *
 * Consume FIFO y de forma parcial: un crédito de $3,000 contra una factura de
 * $2,200 deja $800 disponibles para el mes siguiente. Si los créditos cubren el
 * total, la factura queda PAID; si cubren una parte, queda PENDING con
 * `amountPaid` parcial — el saldo real que hay que cobrarle a la familia.
 *
 * Todo dentro de una transacción: si algo falla, ni se consume el crédito ni se
 * marca la factura como pagada. Un crédito consumido sin pago registrado sería
 * dinero desaparecido.
 */
export async function applyCreditsToInvoice(opts: {
    invoiceId: string;
    patientId: string;
    totalAmount: number;
    /** Fecha a registrar en el InvoicePayment. Default: ahora. */
    appliedAt?: Date;
}): Promise<CreditApplicationResult> {
    const { invoiceId, patientId, totalAmount, appliedAt = new Date() } = opts;

    const credits = await getAvailableCredits(patientId);
    if (credits.length === 0 || totalAmount <= 0) {
        return { applied: 0, remaining: totalAmount, creditIds: [] };
    }

    return prisma.$transaction(async (tx) => {
        let pending = totalAmount;
        let applied = 0;
        const creditIds: string[] = [];

        for (const credit of credits) {
            if (pending <= 0) break;
            const take = round2(Math.min(credit.available, pending));
            if (take <= 0) continue;

            await tx.invoicePayment.create({
                data: {
                    invoiceId,
                    amount: take,
                    source: 'PRIVATE',
                    date: appliedAt,
                    patientCreditId: credit.id,
                    notes: `Aplicación de saldo a favor recibido el ${credit.receivedAt.toISOString().slice(0, 10)}${credit.reason ? ` — ${credit.reason}` : ''}`,
                },
            });
            await tx.patientCredit.update({
                where: { id: credit.id },
                data: { appliedAmount: { increment: take } },
            });

            applied = round2(applied + take);
            pending = round2(pending - take);
            creditIds.push(credit.id);
        }

        if (applied > 0) {
            const fullyCovered = pending <= 0;
            await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    amountPaid: applied,
                    // Solo PAID si el crédito cubre el total. Un crédito parcial
                    // deja la factura PENDING con el saldo real por cobrar — no
                    // se da por saldada una factura a medio pagar.
                    ...(fullyCovered
                        ? { status: 'PAID' as const, paidAt: appliedAt, paymentMethod: 'CREDIT' }
                        : {}),
                },
            });
        }

        return { applied, remaining: pending, creditIds };
    });
}

/**
 * Registra un nuevo saldo a favor. `receivedAt` es la fecha REAL en que entró el
 * dinero, no la del registro: es lo que permite reconstruir a qué mes
 * correspondía el adelanto meses después.
 */
export async function createPatientCredit(opts: {
    headquartersId: string;
    patientId: string;
    amount: number;
    receivedAt: Date;
    source?: 'ADVANCE_PAYMENT' | 'OVERPAYMENT' | 'ADJUSTMENT';
    reason?: string;
    createdById?: string;
}) {
    const { headquartersId, patientId, amount, receivedAt, source = 'ADVANCE_PAYMENT', reason, createdById } = opts;
    if (!(amount > 0)) throw new Error('El monto del saldo a favor debe ser mayor que cero');

    return prisma.patientCredit.create({
        data: {
            headquartersId,
            patientId,
            amount: round2(amount),
            receivedAt,
            source,
            reason: reason ?? null,
            createdById: createdById ?? null,
        },
    });
}

/** Saldo total disponible de un residente. */
export async function getCreditBalance(patientId: string): Promise<number> {
    const credits = await getAvailableCredits(patientId);
    return round2(credits.reduce((s, c) => s + c.available, 0));
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export type { Prisma };
