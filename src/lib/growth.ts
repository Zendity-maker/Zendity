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
    /** De dónde salió el dato de ESTE mes. `MANUAL+CRM` = se combinaron por máximo. */
    source: 'CRM' | 'MANUAL' | 'MANUAL+CRM' | 'NONE';
}

/** Etapa del CRM → campo del embudo. */
const STAGE_TO_FIELD: Record<string, GrowthKey> = {
    PROSPECT: 'prospects',
    TOUR: 'tours',
    EVALUATION: 'evaluations',
    CONTRACT: 'contracts',
    ADMISSION: 'admissions',
};

export interface GrowthFunnel {
    serie: GrowthMonth[];
    /** Meses que salieron del CRM automáticamente. */
    mesesDesdeCRM: number;
    /** Meses que dependen de carga manual. */
    mesesManuales: number;
    totales: Record<GrowthKey, number>;
    mesesConDatos: number;
    /**
     * % de prospectos que terminaron admitidos. null si no hay prospectos o si
     * el resultado no es interpretable — ver `tasaEmbudo`.
     */
    conversionPct: number | null;
    /**
     * % de prospectos que llegaron a tour — mide calidad del lead. null cuando
     * hay más tours que prospectos, que es el caso de Cupey al 19-sep-2026
     * (36 tours contra 31 prospectos) — ver `tasaEmbudo`.
     */
    tourRatePct: number | null;
    /**
     * Admisiones por mes sobre los MESES CERRADOS con datos — el mes en curso
     * no entra. null si todavía no hay ningún mes cerrado con datos; el
     * consumidor (`investors/kpis`) ya cae entonces a las altas desde el ancla.
     * Ver `promedioSobreMesesCerrados`.
     */
    admisionesMensualPromedio: number | null;
}

/**
 * Tasa de un paso del embudo, o null cuando el número no significa nada.
 *
 * POR QUE EXISTE ESTO — medido el 19-sep-2026 en Cupey, ventana jul→sep:
 * prospectos 31, tours 36. `tourRatePct` daba **116%**. Un embudo no puede
 * convertir por encima del 100%: al socio le estábamos enseñando que de cada
 * 100 personas que preguntan, 116 vienen a visitar.
 *
 * No es un error de conteo, los dos números son correctos. Es que los
 * snapshots manuales NO son una cohorte: el Director cuenta ACTOS DEL MES
 * —"este mes hice 14 tours"— y un tour de septiembre puede venir de un
 * prospecto de agosto. Dividir dos conteos de meses distintos no da una tasa
 * de conversión, da un número sin significado. En junio la distancia es aún
 * más clara: 8 prospectos contra 22 tours (275%).
 *
 * Por eso NO se acota con Math.min(100): un 100% clavado tampoco significa
 * nada y además esconde que el dato no da para esta pregunta. Cuando el
 * numerador supera al denominador devolvemos null, y la pantalla omite el
 * dato en vez de mentir. Las dos consumidoras ya lo hacen
 * (`corporate/investors/page.tsx` y el texto narrativo de `investors/kpis`,
 * ambas con `!== null`).
 *
 * Lo que SÍ sigue siendo verdad y se sigue enseñando son los conteos crudos
 * —31 prospectos, 36 tours, 13 admisiones—: esos son actos ocurridos, no
 * ratios entre cohortes que no se cruzan.
 */
function tasaEmbudo(numerador: number, denominador: number): number | null {
    if (denominador <= 0) return null;
    if (numerador > denominador) return null;
    return Math.round((numerador / denominador) * 100);
}

/** 'YYYY-MM' de hoy en UTC — misma clave con la que se arma la serie. */
function mesEnCursoUTC(): string {
    const hoy = new Date();
    return `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Admisiones por mes, contando SOLO meses cerrados.
 *
 * POR QUE NO ENTRA EL MES EN CURSO — medido el 19-sep-2026 en Cupey:
 * el promedio salía 13 admisiones / 3 meses = 4,3, y ese 3 metía septiembre
 * —día 19, 2 admisiones— como si fuera un mes entero. Sobre meses cerrados
 * son 11 / 2 = 5,5.
 *
 * El sesgo va SIEMPRE en la misma dirección: un mes a medio andar aporta
 * medio mes de admisiones y un mes entero al divisor, así que el promedio
 * baja todos los meses hasta que el mes cierra. Y este número alimenta
 * `ritmoMensual` en `investors/kpis`, que es lo que calcula
 * `mesesAFullOcupacion`: con 18 camas libres, la pantalla le prometía al
 * socio ~5 meses a llenar cuando su ritmo cerrado da ~4. Le decía que tarda
 * más de lo que tarda, y el día 1 de cada mes era cuando peor mentía.
 *
 * Mismo criterio que `partirPorCierre` en profitability.ts: lo que se mide
 * para decidir se mide sobre meses cerrados, y el mes en curso se enseña
 * aparte (aquí, en `serie`, que sí lo trae marcado con su `source`).
 *
 * Si no hay ni un mes cerrado con datos devuelve null —no medio mes
 * disfrazado de mes— y `investors/kpis` cae a las altas desde el ancla.
 */
function promedioSobreMesesCerrados(withData: GrowthMonth[]): number | null {
    const mesEnCurso = mesEnCursoUTC();
    const cerrados = withData.filter(s => s.mes !== mesEnCurso);
    if (cerrados.length === 0) return null;
    const admisiones = cerrados.reduce((s, r) => s + r.admissions, 0);
    return Math.round((admisiones / cerrados.length) * 10) / 10;
}

/**
 * Serie del embudo entre `from` (inclusive) y `to` (exclusivo), ambos UTC
 * anclados al día 1.
 *
 * Fuente por mes, en este orden:
 *   1. CRM (CRMLeadStageEvent) — automático, si hubo movimiento ese mes.
 *   2. MonthlyGrowthSnapshot — carga manual, respaldo para meses previos al
 *      CRM o si se deja de usar.
 *
 * La decisión es POR MES, no global: un mes puede venir del CRM y el anterior
 * de carga manual sin conflicto.
 *
 * Los meses sin ninguna fuente aparecen en cero con hasData=false — un mes sin
 * datos no es un mes sin prospectos, y la diferencia importa para no reportar
 * una caída comercial que en realidad es un olvido de carga.
 */
export async function getGrowthFunnel(opts: {
    hqId: string;
    from: Date;
    to: Date;
}): Promise<GrowthFunnel> {
    const [rows, events] = await Promise.all([
        prisma.monthlyGrowthSnapshot.findMany({
            where: { headquartersId: opts.hqId, periodMonth: { gte: opts.from, lt: opts.to } },
            orderBy: { periodMonth: 'asc' },
        }),
        prisma.cRMLeadStageEvent.findMany({
            where: { headquartersId: opts.hqId, occurredAt: { gte: opts.from, lt: opts.to } },
            select: { leadId: true, stage: true, occurredAt: true },
        }),
    ]);
    const byMonth = new Map(rows.map(r => [r.periodMonth.toISOString().slice(0, 7), r]));

    // Agregación del CRM: se cuenta cada (lead, etapa) UNA vez por mes. Si una
    // tarjeta va y vuelve en el kanban dentro del mismo mes, no infla el
    // embudo que ve un inversionista.
    const crmByMonth = new Map<string, Map<GrowthKey, Set<string>>>();
    for (const ev of events) {
        const field = STAGE_TO_FIELD[ev.stage];
        if (!field) continue;
        const key = ev.occurredAt.toISOString().slice(0, 7);
        if (!crmByMonth.has(key)) crmByMonth.set(key, new Map());
        const monthMap = crmByMonth.get(key)!;
        if (!monthMap.has(field)) monthMap.set(field, new Set());
        monthMap.get(field)!.add(ev.leadId);
    }

    const serie: GrowthMonth[] = [];
    for (let y = opts.from.getUTCFullYear(), m = opts.from.getUTCMonth();
        y < opts.to.getUTCFullYear() || (y === opts.to.getUTCFullYear() && m < opts.to.getUTCMonth());) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const crm = crmByMonth.get(key);
        const row = byMonth.get(key);

        /**
         * SE COMBINAN, NO SE REEMPLAZAN — Y ESTE ERA EL FALLO.
         *
         * Antes bastaba `if (crm)` para descartar lo cargado a mano. Medido el
         * 16-sep-2026: en septiembre habia UN SOLO evento de CRM —un tour— y la
         * carga manual de Andres decia 10 prospectos, 8 tours, 2 evaluaciones,
         * 1 contrato y 1 admision. La pantalla enseñaba tours=1 y el resto en
         * cero. Una tarjeta suelta en el kanban borraba el mes entero, y por eso
         * "no actualiza lo que voy agregando en el mes corriente".
         *
         * Se toma el MAXIMO campo por campo, no la suma: el CRM ve un
         * subconjunto de lo que el Director cuenta —el mismo tour esta en los
         * dos— asi que sumar lo contaria dos veces. El maximo respeta el dato
         * mas completo sin inventar ninguno.
         */
        const delCrm = {
            prospects: crm?.get('prospects')?.size ?? 0,
            tours: crm?.get('tours')?.size ?? 0,
            evaluations: crm?.get('evaluations')?.size ?? 0,
            contracts: crm?.get('contracts')?.size ?? 0,
            admissions: crm?.get('admissions')?.size ?? 0,
        };
        const aMano = {
            prospects: row?.prospects ?? 0,
            tours: row?.tours ?? 0,
            evaluations: row?.evaluations ?? 0,
            contracts: row?.contracts ?? 0,
            admissions: row?.admissions ?? 0,
        };
        const hayCrm = !!crm;
        const hayMano = !!row;

        serie.push({
            mes: key,
            prospects: Math.max(delCrm.prospects, aMano.prospects),
            tours: Math.max(delCrm.tours, aMano.tours),
            evaluations: Math.max(delCrm.evaluations, aMano.evaluations),
            contracts: Math.max(delCrm.contracts, aMano.contracts),
            admissions: Math.max(delCrm.admissions, aMano.admissions),
            hasData: hayCrm || hayMano,
            source: hayMano && hayCrm ? 'MANUAL+CRM' : hayMano ? 'MANUAL' : hayCrm ? 'CRM' : 'NONE',
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
        mesesDesdeCRM: serie.filter(s => s.source === 'CRM' || s.source === 'MANUAL+CRM').length,
        mesesManuales: serie.filter(s => s.source === 'MANUAL' || s.source === 'MANUAL+CRM').length,
        // Mismo tratamiento para los dos: ambos mezclan meses igual. Hoy en
        // Cupey conversión da 13/31 = 42% (pasa la guarda, admisiones <
        // prospectos) y tours 36/31 se va a null. Si un mes llega a cerrar más
        // admisiones que prospectos nuevos —agosto solo ya fue 7 de 9— la
        // conversión se calla por la misma razón, sin tocar nada más.
        conversionPct: tasaEmbudo(totales.admissions, totales.prospects),
        tourRatePct: tasaEmbudo(totales.tours, totales.prospects),
        admisionesMensualPromedio: promedioSobreMesesCerrados(withData),
    };
}
