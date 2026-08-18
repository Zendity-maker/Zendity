import { prisma } from '@/lib/prisma';

/**
 * Embudo comercial mensual — carga manual (MonthlyGrowthSnapshot).
 *
 * Complementa a CRMLead: el CRM es el ESTADO del pipeline vivo hoy; esto es
 * el FLUJO del mes. Ambos alimentan la sección de Crecimiento del dashboard
 * de socios desde ángulos distintos.
 */

export const GROWTH_FIELDS = [
    { key: 'prospects', label: 'Prospectos', hint: 'Contactos nuevos del mes' },
    { key: 'tours', label: 'Tours', hint: 'Visitas a la facilidad' },
    { key: 'evaluations', label: 'Evaluaciones', hint: 'Evaluación clínica o financiera' },
    { key: 'contracts', label: 'Contratos', hint: 'Contratos firmados' },
    { key: 'admissions', label: 'Admisiones', hint: 'Ingresos efectivos' },
] as const;

export type GrowthKey = typeof GROWTH_FIELDS[number]['key'];

export interface GrowthMonth {
    mes: string;
    prospects: number;
    tours: number;
    evaluations: number;
    contracts: number;
    admissions: number;
    hasData: boolean;
}

export interface GrowthFunnel {
    serie: GrowthMonth[];
    totales: Record<GrowthKey, number>;
    mesesConDatos: number;
    /** % de prospectos que terminaron admitidos. null sin datos suficientes. */
    conversionPct: number | null;
    /** % de prospectos que llegaron a tour — mide calidad del lead. */
    tourRatePct: number | null;
    /** Admisiones por mes según lo cargado a mano. */
    admisionesMensualPromedio: number | null;
}

/**
 * Serie del embudo entre `from` (inclusive) y `to` (exclusivo), ambos UTC
 * anclados al día 1. Los meses sin carga aparecen en cero con hasData=false —
 * un mes sin datos no es un mes sin prospectos, y la diferencia importa para
 * no reportar una caída comercial que en realidad es un olvido de carga.
 */
export async function getGrowthFunnel(opts: {
    hqId: string;
    from: Date;
    to: Date;
}): Promise<GrowthFunnel> {
    const rows = await prisma.monthlyGrowthSnapshot.findMany({
        where: { headquartersId: opts.hqId, periodMonth: { gte: opts.from, lt: opts.to } },
        orderBy: { periodMonth: 'asc' },
    });
    const byMonth = new Map(rows.map(r => [r.periodMonth.toISOString().slice(0, 7), r]));

    const serie: GrowthMonth[] = [];
    for (let y = opts.from.getUTCFullYear(), m = opts.from.getUTCMonth();
        y < opts.to.getUTCFullYear() || (y === opts.to.getUTCFullYear() && m < opts.to.getUTCMonth());) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const row = byMonth.get(key);
        serie.push({
            mes: key,
            prospects: row?.prospects ?? 0,
            tours: row?.tours ?? 0,
            evaluations: row?.evaluations ?? 0,
            contracts: row?.contracts ?? 0,
            admissions: row?.admissions ?? 0,
            hasData: !!row,
        });
        m++; if (m > 11) { m = 0; y++; }
    }

    const withData = serie.filter(s => s.hasData);
    const totales = {
        prospects: withData.reduce((s, r) => s + r.prospects, 0),
        tours: withData.reduce((s, r) => s + r.tours, 0),
        evaluations: withData.reduce((s, r) => s + r.evaluations, 0),
        contracts: withData.reduce((s, r) => s + r.contracts, 0),
        admissions: withData.reduce((s, r) => s + r.admissions, 0),
    };

    return {
        serie,
        totales,
        mesesConDatos: withData.length,
        conversionPct: totales.prospects > 0 ? Math.round((totales.admissions / totales.prospects) * 100) : null,
        tourRatePct: totales.prospects > 0 ? Math.round((totales.tours / totales.prospects) * 100) : null,
        admisionesMensualPromedio: withData.length > 0
            ? Math.round((totales.admissions / withData.length) * 10) / 10
            : null,
    };
}
