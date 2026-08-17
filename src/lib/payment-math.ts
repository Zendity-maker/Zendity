/**
 * Aritmética de cobro de facturas.
 *
 * Vive fuera del route handler para poder verificarse sin tocar la DB: es la
 * lógica que decide si una factura queda saldada, cuánto queda por cobrar y
 * cuánto sobró. Un error aquí no se ve en pantalla — se ve meses después en
 * una cobranza que no cuadra.
 *
 * Corrige dos defectos del comportamiento anterior:
 *   1. `amountPaid` se SOBRESCRIBÍA en vez de acumular, así que un segundo
 *      abono pisaba el primero (pese a que el modelo dice "abonos parciales").
 *   2. La factura se marcaba PAID SIEMPRE, sin comparar contra el total:
 *      registrar $100 de una cuota de $3,000 la sacaba de pendientes y volvía
 *      invisible el subcobro. Así quedó INV-082026-018 en "$1 pagado / PAID".
 */

/** Tolerancia de un centavo: 2200.00 vs 2199.999… no debe dejar saldo fantasma. */
const CENT_TOLERANCE = 0.01;

export interface PaymentComputation {
    /** Monto de ESTE abono. */
    paymentAmount: number;
    /** Acumulado tras aplicarlo. */
    newAmountPaid: number;
    /** Lo que faltaba antes de este abono. */
    outstandingBefore: number;
    /** Lo que falta después. 0 si quedó saldada. */
    outstandingAfter: number;
    /** true → la factura pasa a PAID. */
    isFullySettled: boolean;
    /** Excedente que debe convertirse en saldo a favor. */
    overpaid: number;
}

export function computePayment(opts: {
    totalAmount: number;
    previouslyPaid: number;
    /** Monto explícito del abono. Si es null/undefined, se salda el pendiente. */
    requestedAmount?: number | null;
}): PaymentComputation {
    const total = round2(opts.totalAmount);
    const previouslyPaid = round2(opts.previouslyPaid || 0);
    const outstandingBefore = round2(Math.max(0, total - previouslyPaid));

    const paymentAmount = opts.requestedAmount == null
        ? outstandingBefore
        : round2(opts.requestedAmount);

    const newAmountPaid = round2(previouslyPaid + paymentAmount);
    const isFullySettled = newAmountPaid >= total - CENT_TOLERANCE;
    const outstandingAfter = round2(Math.max(0, total - newAmountPaid));
    const overpaid = round2(Math.max(0, newAmountPaid - total));

    return { paymentAmount, newAmountPaid, outstandingBefore, outstandingAfter, isFullySettled, overpaid };
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
