import { ExpenseCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { round2 } from '@/lib/payment-math';

/**
 * Rentabilidad operativa por sede — Fase 3 del dashboard de socios.
 *
 * Une los dos lados del negocio que hasta ahora vivían separados: ingresos
 * (Invoice, automático) y gastos (MonthlyExpense, carga manual del Director).
 *
 * Principio de honestidad del dato: un mes SIN gastos cargados no reporta
 * margen del 100% — reporta `hasExpenseData: false`. Mostrarle a un socio un
 * margen inflado porque nadie cargó la nómina es peor que no mostrar nada.
 */

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
    PAYROLL: 'Nómina',
    RENT: 'Renta',
    FOOD: 'Alimentos',
    UTILITIES: 'Utilidades',
    SUPPLIES: 'Insumos',
    INSURANCE: 'Seguros',
    MAINTENANCE: 'Mantenimiento',
    PROFESSIONAL_FEES: 'Servicios profesionales',
    OTHER: 'Otros',
};

/** Orden de presentación: de mayor peso típico a menor. */
export const EXPENSE_ORDER: ExpenseCategory[] = [
    'PAYROLL', 'RENT', 'FOOD', 'UTILITIES', 'SUPPLIES',
    'INSURANCE', 'MAINTENANCE', 'PROFESSIONAL_FEES', 'OTHER',
];

export interface MonthProfitability {
    /** "2026-08" */
    mes: string;
    ingresos: number;
    gastos: number;
    margen: number;
    /** % de margen sobre ingresos. null si no hay ingresos o no hay data. */
    margenPct: number | null;
    /** false → nadie cargó gastos de este mes; NO interpretar margen. */
    hasExpenseData: boolean;
    porCategoria: { category: ExpenseCategory; label: string; amount: number }[];
}

/**
 * Serie de rentabilidad mensual desde `from` (inclusive) hasta `to`
 * (exclusivo), ambos en UTC y anclados al día 1.
 *
 * Ingresos = totalAmount facturado (devengado), no cobrado: el margen mide el
 * desempeño del período, no la velocidad de cobranza — esa vive en su propio
 * KPI (tasaCobranza).
 */
export async function getProfitabilitySeries(opts: {
    hqId: string;
    from: Date;
    to: Date;
}): Promise<MonthProfitability[]> {
    const { hqId, from, to } = opts;

    const [invoices, expenses] = await Promise.all([
        prisma.invoice.findMany({
            where: { headquartersId: hqId, issueDate: { gte: from, lt: to } },
            select: { issueDate: true, totalAmount: true },
        }),
        prisma.monthlyExpense.findMany({
            where: { headquartersId: hqId, periodMonth: { gte: from, lt: to } },
            select: { periodMonth: true, category: true, amount: true },
        }),
    ]);

    // Esqueleto de meses — un mes sin datos debe aparecer en cero, no faltar.
    const series: MonthProfitability[] = [];
    const index = new Map<string, number>();
    for (let y = from.getUTCFullYear(), m = from.getUTCMonth();
        y < to.getUTCFullYear() || (y === to.getUTCFullYear() && m < to.getUTCMonth());) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        index.set(key, series.length);
        series.push({
            mes: key, ingresos: 0, gastos: 0, margen: 0,
            margenPct: null, hasExpenseData: false, porCategoria: [],
        });
        m++; if (m > 11) { m = 0; y++; }
    }

    for (const inv of invoices) {
        const idx = index.get(inv.issueDate.toISOString().slice(0, 7));
        if (idx === undefined) continue;
        series[idx].ingresos = round2(series[idx].ingresos + inv.totalAmount);
    }

    const catBuckets = new Map<number, Map<ExpenseCategory, number>>();
    for (const exp of expenses) {
        const idx = index.get(exp.periodMonth.toISOString().slice(0, 7));
        if (idx === undefined) continue;
        series[idx].gastos = round2(series[idx].gastos + exp.amount);
        series[idx].hasExpenseData = true;
        if (!catBuckets.has(idx)) catBuckets.set(idx, new Map());
        const bucket = catBuckets.get(idx)!;
        bucket.set(exp.category, round2((bucket.get(exp.category) ?? 0) + exp.amount));
    }

    for (const [idx, bucket] of catBuckets) {
        series[idx].porCategoria = EXPENSE_ORDER
            .filter(c => bucket.has(c))
            .map(c => ({ category: c, label: EXPENSE_LABELS[c], amount: bucket.get(c)! }));
    }

    for (const row of series) {
        row.margen = round2(row.ingresos - row.gastos);
        // Sin gastos cargados el margen no significa nada: se deja en null en
        // vez de reportar 100%.
        row.margenPct = row.hasExpenseData && row.ingresos > 0
            ? Math.round((row.margen / row.ingresos) * 100)
            : null;
    }

    return series;
}

/** Resumen del período completo — para las tarjetas hero del dashboard. */
export function summarizeProfitability(series: MonthProfitability[]) {
    const withData = series.filter(s => s.hasExpenseData);
    const ingresos = round2(withData.reduce((s, r) => s + r.ingresos, 0));
    const gastos = round2(withData.reduce((s, r) => s + r.gastos, 0));
    const margen = round2(ingresos - gastos);
    return {
        mesesConDatos: withData.length,
        mesesSinDatos: series.length - withData.length,
        ingresos,
        gastos,
        margen,
        margenPct: withData.length > 0 && ingresos > 0 ? Math.round((margen / ingresos) * 100) : null,
        /** Costo operativo mensual promedio — base para proyecciones. */
        gastoMensualPromedio: withData.length > 0 ? round2(gastos / withData.length) : null,
    };
}

/**
 * Punto de equilibrio: cuántas camas ocupadas se necesitan para cubrir el
 * costo operativo mensual, al ARPU actual.
 *
 * Es la métrica que un socio pregunta primero ("¿a partir de cuántos
 * residentes ganamos dinero?") y que ningún dashboard de ingresos puede
 * responder solo.
 */
export function calculateBreakEven(opts: {
    gastoMensualPromedio: number | null;
    arpu: number;
    ocupadas: number;
    capacity: number;
}): {
    camasNecesarias: number;
    camasSobreEquilibrio: number;
    ocupacionEquilibrioPct: number;
    alcanzable: boolean;
} | null {
    const { gastoMensualPromedio, arpu, ocupadas, capacity } = opts;
    if (!gastoMensualPromedio || arpu <= 0) return null;

    const camasNecesarias = Math.ceil(gastoMensualPromedio / arpu);
    return {
        camasNecesarias,
        camasSobreEquilibrio: ocupadas - camasNecesarias,
        ocupacionEquilibrioPct: capacity > 0 ? Math.round((camasNecesarias / capacity) * 100) : 0,
        // Si el equilibrio exige más camas de las que existen, el modelo de
        // negocio no cierra a este ARPU — dato crítico, no lo escondemos.
        alcanzable: camasNecesarias <= capacity,
    };
}
