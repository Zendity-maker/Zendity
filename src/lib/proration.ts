import { PatientStatus } from '@prisma/client';

/**
 * Prorrateo de la cuota del primer mes.
 *
 * Regla de negocio (definida 17-ago-2026):
 *   - Al INGRESAR se cobra proporcional a los días que el residente vivió en el
 *     hogar ese mes, sobre los días reales del mes (28/29/30/31) — no base 30
 *     fija. Base 30 produce en febrero montos que no se le pueden explicar a
 *     una familia.
 *   - El mes de EGRESO se cobra completo. El prorrateo aplica solo a la
 *     entrada. Decisión explícita del dueño del producto.
 *   - TEMPORARY_LEAVE nunca prorratea: el hospitalizado paga cuota completa
 *     porque la cama sigue reservada. Ver `billable-residents.ts`.
 *
 * Ejemplo: cuota $3,100, ingreso el 24 de agosto (31 días) →
 *   días facturables = 31 - 24 + 1 = 8
 *   monto = 3100 × 8/31 = $800.00
 */

export interface ProrationResult {
    /** Monto a facturar, redondeado a centavos. */
    amount: number;
    /** true si hubo prorrateo; false si se cobra el mes completo. */
    isProrated: boolean;
    /** Días facturados / días del mes. Solo significativo si isProrated. */
    billableDays: number;
    daysInMonth: number;
    /** Texto para el InvoiceItem — la factura tiene que defenderse sola. */
    description: string;
}

/** Días reales del mes (maneja bisiestos vía Date.UTC día 0 del mes siguiente). */
export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Calcula el monto de la cuota mensual para un residente en un mes dado.
 *
 * `admissionDate` es la fecha real de ingreso. Si es null, el caller debe pasar
 * su mejor aproximación (createdAt); en ese caso el prorrateo solo se activa si
 * esa fecha cae dentro del mes facturado, así que un residente legacy con
 * createdAt viejo siempre recibe cuota completa —que es lo correcto.
 */
export function calculateMonthlyCharge(opts: {
    monthlyFee: number;
    year: number;
    month: number; // 0-11
    admissionDate: Date | null;
    status: PatientStatus;
    monthLabel: string;
}): ProrationResult {
    const { monthlyFee, year, month, admissionDate, status, monthLabel } = opts;
    const totalDays = daysInMonth(year, month);
    const fullMonth: ProrationResult = {
        amount: round2(monthlyFee),
        isProrated: false,
        billableDays: totalDays,
        daysInMonth: totalDays,
        description: `Cuota mensual ${monthLabel} ${year}`,
    };

    // Un residente en leave paga completo aunque su ingreso caiga en este mes:
    // el prorrateo mide días de estadía, y la cama estuvo reservada igual.
    if (status === 'TEMPORARY_LEAVE') return fullMonth;
    if (!admissionDate) return fullMonth;

    // Solo prorratea si el ingreso ocurre DENTRO del mes que se factura.
    const admYear = admissionDate.getUTCFullYear();
    const admMonth = admissionDate.getUTCMonth();
    if (admYear !== year || admMonth !== month) return fullMonth;

    const admDay = admissionDate.getUTCDate();
    // Ingreso el día 1 = mes completo, sin ruido de "prorrateo 31/31".
    if (admDay <= 1) return fullMonth;

    const billableDays = totalDays - admDay + 1;
    const amount = round2((monthlyFee * billableDays) / totalDays);

    return {
        amount,
        isProrated: true,
        billableDays,
        daysInMonth: totalDays,
        description: `Cuota mensual ${monthLabel} ${year} — prorrateo ${billableDays}/${totalDays} días desde el ${admDay} de ${monthLabel}`,
    };
}

/** Redondeo a centavos. Evita que 2200*8/31 arrastre binarios en la factura. */
function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
