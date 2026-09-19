import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { calculateFacilityHealthScore } from '@/lib/facility-health';
import { billableResidentsWhere } from '@/lib/billable-residents';
import { round2 } from '@/lib/payment-math';
import { getProfitabilitySeries, summarizeProfitability, calculateBreakEven, partirPorCierre, estructuraDeCostos } from '@/lib/profitability';
import { getGrowthFunnel } from '@/lib/growth';
import { logError } from '@/lib/logger';
import { Z_SCORE_VISIBLE } from '@/lib/z-score-visible';
import { puedeVerInversion } from '@/lib/acceso-inversion';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { PhiAccessAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/investors/kpis
 *
 * Agregador del Partners & Investor Dashboard (v2 — 17-ago-2026).
 *
 * Rediseño sobre la FASE 12 original, que mostraba una foto puntual con un
 * defecto serio: "Ingresos MTD" sumaba solo facturas PAID — eso es COBRADO,
 * no facturado, y el día 3 del mes hacía parecer que el negocio se desplomó.
 *
 * Secciones: ocupación, finanzas (devengado vs caja + serie mensual),
 * crecimiento (pipeline CRM agregado), calidad, equipo y resumen ejecutivo.
 *
 * REGLA DE PRIVACIDAD (no negociable): este endpoint sirve a inversionistas,
 * que NO son workforce clínico. Ningún payload puede incluir nombres de
 * residentes, diagnósticos, datos de familias, facturas individuales ni
 * scores de staff con nombre. Solo agregados. HIPAA minimum necessary aplica
 * a dashboards igual que a emails.
 *
 * INVESTOR/ADMIN/SUPER_ADMIN → todas las sedes activas. DIRECTOR → su sede.
 *
 * QUIÉN ENTRA (16-sep-2026): la lista de roles de abajo ya NO decide. Es solo
 * la primera puerta —la que trae `requireRole` y con él el corte por
 * facturación suspendida—; la segunda es `puedeVerInversion`, que exige
 * propiedad o vínculo. Hasta hoy bastaba el rol y por ahí pasaba la Directora
 * de Cupey, que no posee nada: veía margen, punto de equilibrio y proyección.
 *
 * ESTA ES LA GUARDA QUE DE VERDAD PROTEGE. El chequeo de la pantalla es
 * cosmético —evita el destello del panel— y se puede saltar escribiendo la URL.
 */

/**
 * Primera puerta. Sigue habiendo lista porque `requireRole` es el único sitio
 * por donde entra `billingBlock` (declarado sin export en api-auth.ts): una
 * guarda que lo saltara perdería el 402 por facturación suspendida.
 *
 * Deja pasar DIRECTOR a propósito: el dueño de Cupey y Mayagüez es DIRECTOR.
 * Quien no posea nada cae en la segunda puerta. Y `requireRole` acepta también
 * rol SECUNDARIO (api-auth.ts:126-127) — hoy nadie entra por esa vía, pero el
 * predicado la cierra sola sin tener que acordarse de ella.
 */
const ALLOWED_ROLES = ['INVESTOR', 'ADMIN', 'DIRECTOR', 'SUPER_ADMIN'];

// Piso global de la serie: la facturación sistemática arrancó en julio 2026
// (junio tiene $21 de ruido de pruebas de concierge). Cada sede ancla en el
// MÁXIMO entre este piso y su propia fecha de apertura — sin eso, una sede
// nueva (Mayagüez) arrastraría meses vacíos desde julio-2026 y su ritmo de
// admisiones saldría diluido entre meses en que ni existía, inflando la
// proyección de "meses a plena ocupación".
const SERIES_FLOOR = { year: 2026, month: 6 }; // month 0-11 → julio

const LEAD_STAGES = ['PROSPECT', 'TOUR', 'EVALUATION', 'CONTRACT', 'ADMISSION'] as const;

/**
 * Auditoría: hasta hoy NO SE PODÍA SABER si alguien entró aquí. No es PHI
 * —el payload es agregado a propósito—, pero `PhiAccessLog` es el único rastro
 * append-only que existe en el sistema, y de una pantalla con el margen y la
 * proyección del negocio conviene saber quién la abrió y cuándo.
 */
export const GET = withPhiAccessLog(getKpisHandler, {
    resourceType: 'InvestorKPIs',
    action: PhiAccessAction.READ,
});

/** Lo que cada sede aporta a la suma. Interno: no sale en el payload. */
interface AporteSede {
    hqId: string;
    name: string;
    capacity: number;
    ocupadas: number;
    fisicos: number;
    enHospital: number;
    camasLibres: number;
    mrr: number;
    facturadoMes: number;
    cobradoMes: number;
    vencidoTotal: number;
    brechaFacturacion: number;
    mesesCerradosConDatos: number;
    ingresosCerrados: number;
    gastosCerrados: number;
    mesesDeLaVentana: string[];
    gastoMesEnCurso: number;
    gastoPrevioALaSerie: number;
    esPreApertura: boolean;
}

/**
 * LA VISTA CONSOLIDADA — pedida por el dueño el 19-sep-2026: "una vista
 * consolidada de ambas me gusta."
 *
 * Es dueño de Cupey y de Mayagüez, y el número de su negocio es la suma. Hasta
 * hoy el payload era un array por sede y el total no existía en ninguna parte:
 * había que sacarlo a mano de dos pestañas, que es justo donde se cometen los
 * errores que siguen.
 *
 * ── LOS PORCENTAJES SE RECALCULAN, NO SE PROMEDIAN ────────────────────────
 * El margen consolidado es (ingresos totales − gastos totales) / ingresos
 * totales. NUNCA el promedio de los márgenes de cada sede. Con estos datos la
 * diferencia todavía no muerde porque solo una sede aporta, pero en cuanto
 * Mayagüez facture, promediar un 30% de una sede que factura 139.048 con un 5%
 * de otra que factura 4.000 daría 17,5% cuando el negocio va al 29%. Lo mismo
 * vale para la ocupación: camas ocupadas sobre camas totales, no la media de
 * dos porcentajes calculados sobre denominadores distintos.
 *
 * ── QUÉ HACE UNA SEDE SIN MESES CERRADOS ──────────────────────────────────
 * NO entra en el margen consolidado, y su gasto TAMPOCO. No es un trato
 * especial para Mayagüez: es la misma regla que ya rige por sede —el margen se
 * mide sobre meses CERRADOS— aplicada a la suma. El septiembre de Cupey
 * (88.417 facturados contra 22.041 de gasto a día 19) está fuera por la misma
 * razón que el de Mayagüez.
 *
 * Si se metiera el gasto de Mayagüez sin su ingreso, el margen consolidado
 * pasaría de 42.012,91 sobre 139.048 (30%) a 25.346,25 sobre 139.048 (18%): un
 * derrumbe de doce puntos que no ocurrió, producido por sumar un costo de
 * septiembre a unos ingresos de julio y agosto. Sería la misma aritmética que
 * el mes en curso ya tiene prohibida.
 *
 * Pero ese gasto NO se esconde, que es la otra forma de mentir: viaja en
 * `gastoDeSedesSinCerrar`, con su propio nombre y contado aparte, para que se
 * vea que existe sin que contamine un margen.
 *
 * ── UNA SOLA SEDE ─────────────────────────────────────────────────────────
 * Devuelve null. Un "consolidado" de una sede es la misma sede dos veces, y
 * repetir un número en otra tarjeta lo hace parecer una segunda confirmación.
 *
 * ── PRIVACIDAD ────────────────────────────────────────────────────────────
 * Solo agregados y nombres de SEDE. Ni residentes, ni facturas, ni staff.
 * Aplica la regla de la cabecera de esta ruta.
 */
function consolidar(aportes: AporteSede[]) {
    if (aportes.length < 2) return null;

    const suma = (f: (a: AporteSede) => number) => round2(aportes.reduce((s, a) => s + f(a), 0));

    const aportanMargen = aportes.filter(a => a.mesesCerradosConDatos > 0);
    const sinCerrar = aportes.filter(a => a.mesesCerradosConDatos === 0);

    const ingresos = round2(aportanMargen.reduce((s, a) => s + a.ingresosCerrados, 0));
    const gastos = round2(aportanMargen.reduce((s, a) => s + a.gastosCerrados, 0));
    const margen = round2(ingresos - gastos);

    // Los meses que de verdad entraron en la suma. Si dos sedes tuvieran
    // ventanas distintas —cada una mira SUS tres últimos cerrados— esto lo
    // enseña en vez de dejar creer que es el mismo trimestre para las dos.
    const meses = [...new Set(aportanMargen.flatMap(a => a.mesesDeLaVentana))].sort();

    const capacity = aportes.reduce((s, a) => s + a.capacity, 0);
    const ocupadas = aportes.reduce((s, a) => s + a.ocupadas, 0);

    return {
        sedes: aportes.length,
        nombres: aportes.map(a => a.name),

        rentabilidad: {
            /** Meses cerrados (con gastos cargados) que entran en la suma. */
            meses,
            desde: meses[0] ?? null,
            hasta: meses[meses.length - 1] ?? null,
            ingresos,
            gastos,
            margen,
            // Recalculado sobre los totales. Nunca el promedio de los márgenes.
            margenPct: ingresos > 0 ? Math.round((margen / ingresos) * 100) : null,
            sedesQueAportan: aportanMargen.length,
            sedesSinMesesCerrados: sinCerrar.length,
            /**
             * Gasto REAL de las sedes que no aportan al margen, dentro de su
             * propia ventana. Hoy: los 16.666,66 de renta de Mayagüez en
             * septiembre. Está fuera del margen a propósito —no tiene ingreso
             * contra el cual medirse— y se enseña aparte para que nadie lo dé
             * por perdido ni lo sume por su cuenta al 42.012,91 de arriba.
             */
            gastoDeSedesSinCerrar: round2(sinCerrar.reduce((s, a) => s + a.gastoMesEnCurso, 0)),
            /**
             * Gasto acumulado por sedes en pre-apertura ANTES de que empezara su
             * serie: 168.333,21 de Mayagüez en once meses (oct-2025 → ago-2026),
             * todo renta, contra cero facturado.
             *
             * Es inversión previa a la apertura, no una pérdida operativa, y por
             * eso no toca ningún margen. La base NO guarda quién pagó esa renta:
             * el acuerdo de que sale de fondos de Cupey y Mayagüez se la devuelve
             * es una decisión del dueño del 19-sep-2026, no un dato del sistema.
             * La pantalla puede llamarlo "invertido antes de abrir"; no puede
             * llamarlo "deuda entre sedes" sin que alguien lo confirme fuera.
             */
            gastoPreAperturaAcumulado: round2(aportes.reduce((s, a) => s + a.gastoPrevioALaSerie, 0)),
        },

        ocupacion: {
            capacity,
            ocupadas,
            camasLibres: aportes.reduce((s, a) => s + a.camasLibres, 0),
            // Sobre las camas totales de las dos sedes, no la media de dos %.
            occupancyRate: capacity > 0 ? Math.round((ocupadas / capacity) * 100) : 0,
            /**
             * Camas que están en el denominador pero en una sede que todavía no
             * abrió. Hoy son 50 de 100, y por eso la ocupación consolidada sale
             * 32% mientras Cupey sola va al 64%. El 32% es aritméticamente
             * correcto —el dueño paga por las dos plantas— pero sin este número
             * al lado se lee como que el negocio está medio vacío, cuando lo que
             * está vacío es un edificio que abre en octubre. Va aparte para que
             * la pantalla pueda decir las dos cosas sin recalcular nada.
             */
            camasEnPreApertura: aportes.filter(a => a.esPreApertura).reduce((s, a) => s + a.capacity, 0),
            /** La misma ocupación contando solo sedes abiertas. Hoy: 64%. */
            occupancyRateAbiertas: (() => {
                const abiertas = aportes.filter(a => !a.esPreApertura);
                const cap = abiertas.reduce((s, a) => s + a.capacity, 0);
                const ocu = abiertas.reduce((s, a) => s + a.ocupadas, 0);
                return cap > 0 ? Math.round((ocu / cap) * 100) : null;
            })(),
        },

        residentes: {
            total: ocupadas,
            fisicos: aportes.reduce((s, a) => s + a.fisicos, 0),
            enHospital: aportes.reduce((s, a) => s + a.enHospital, 0),
        },

        /**
         * El mes en curso consolidado va SIN margen, a propósito. Sumar el
         * facturado de las dos sedes es legítimo —son dólares del mismo mes— pero
         * un margen del mes en curso ya está prohibido por sede (la facturación
         * sale el día 1 y los gastos llegan goteando), y consolidarlo lo empeora:
         * hoy mezclaría los 88.417 de Cupey con los 16.666 de renta de una sede
         * que todavía no factura.
         */
        mesEnCurso: {
            facturado: suma(a => a.facturadoMes),
            cobrado: suma(a => a.cobradoMes),
            vencidoTotal: suma(a => a.vencidoTotal),
            brechaFacturacion: suma(a => a.brechaFacturacion),
        },

        /** Ingreso recurrente de las dos sedes juntas. */
        mrr: suma(a => a.mrr),
    };
}

async function getKpisHandler(_req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        // Segunda puerta: posee una sede, está vinculado, o es Zendity.
        // El 403 es el mismo texto que da requireRole — desde fuera no se
        // distingue "no tienes el rol" de "no eres dueño", y no hace falta.
        if (!(await puedeVerInversion(auth))) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        // ── QUE SEDES ENTRAN EN ESTOS NUMEROS ────────────────────────────
        // Antes: un DIRECTOR veia solo la suya —por eso Andres, dueño de Cupey y
        // Mayaguez, no veia Mayaguez— y CUALQUIER OTRO ROL veia TODAS las sedes
        // activas. Eso incluye INVESTOR: un inversionista de un hogar habria
        // visto los ingresos, la ocupacion y el censo de cualquier otro cliente
        // que entrara. Es la misma fuga que se cerro en /corporate/headquarters.
        //
        // Regla: SUPER_ADMIN ve todas —maneja Zendity como empresa—; el resto ve
        // su sede mas las que le pertenezcan por ownerId.
        const esSuperAdmin = auth.role === 'SUPER_ADMIN';
        const targetHqs = esSuperAdmin
            ? await prisma.headquarters.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
            : await prisma.headquarters.findMany({
                where: {
                    isActive: true,
                    OR: [
                        // Su propia sede.
                        ...(auth.headquartersId ? [{ id: auth.headquartersId }] : []),
                        // Las que le pertenecen como dueño.
                        ...(auth.id ? [{ ownerId: auth.id }] : []),
                        // Y aquellas a las que está vinculado sin pertenecer: un
                        // inversionista puede tener participación en varias sedes
                        // sin ser dueño de ninguna. Ver SedeVinculo.
                        ...(auth.id ? [{ vinculos: { some: { userId: auth.id } } }] : []),
                    ],
                },
                orderBy: { name: 'asc' },
            });

        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        // Rangos en UTC — el cron escribe issueDate a las 00:00Z; construir el
        // rango en hora local (AST) dejaba fuera TODAS las facturas del mes.
        const monthStart = new Date(Date.UTC(y, m, 1));
        const monthEnd = new Date(Date.UTC(y, m + 1, 1));
        const seriesFloor = new Date(Date.UTC(SERIES_FLOOR.year, SERIES_FLOOR.month, 1));

        const kpisByHq = [];
        const aportes: AporteSede[] = [];

        for (const hq of targetHqs) {
            // Ancla POR SEDE: el mayor entre el piso global y el mes de
            // apertura de la sede.
            const hqCreated = (hq as any).createdAt as Date | undefined;
            const hqOpenMonth = hqCreated
                ? new Date(Date.UTC(hqCreated.getUTCFullYear(), hqCreated.getUTCMonth(), 1))
                : seriesFloor;
            const seriesStart = hqOpenMonth > seriesFloor ? hqOpenMonth : seriesFloor;

            // Meses transcurridos desde que la sede opera, para el ritmo de
            // admisiones. Una ventana móvil de 90 días capturaba la carga
            // inicial del sistema (26 residentes legacy creados en bloque el
            // 21-may) e inflaba el ritmo a ~10/mes → "full en 2 meses".
            const mesesDesdeAncla = Math.max(
                (now.getTime() - seriesStart.getTime()) / (30.44 * 24 * 3600 * 1000),
                0.5
            );
            const [
                billable,
                monthInvoices,
                seriesInvoices,
                overdueAll,
                bajasMes,
                altasDesdeAncla,
                leadsByStage,
                staffAll,
                clinicalStaff,
                fhs,
                facturasHistoricas,
            ] = await Promise.all([
                // Censo facturable — cama reservada = cama que factura
                prisma.patient.findMany({
                    where: billableResidentsWhere(hq.id),
                    select: { id: true, status: true, monthlyFee: true, admissionDate: true, createdAt: true },
                }),
                prisma.invoice.findMany({
                    where: { headquartersId: hq.id, issueDate: { gte: monthStart, lt: monthEnd } },
                    select: { patientId: true, totalAmount: true, amountPaid: true },
                }),
                prisma.invoice.findMany({
                    where: { headquartersId: hq.id, issueDate: { gte: seriesStart, lt: monthEnd } },
                    select: { issueDate: true, totalAmount: true, amountPaid: true },
                }),
                prisma.invoice.findMany({
                    where: { headquartersId: hq.id, status: 'OVERDUE' },
                    select: { totalAmount: true, amountPaid: true },
                }),
                prisma.patient.count({
                    where: {
                        headquartersId: hq.id,
                        status: { in: ['DISCHARGED', 'DECEASED'] },
                        dischargeDate: { gte: monthStart, lt: monthEnd },
                    },
                }),
                // Admisiones desde el ancla de datos reales (julio-2026), para
                // proyectar meses a plena ocupación sin contaminar con el bulk
                // de residentes legacy.
                prisma.patient.count({
                    where: { ...billableResidentsWhere(hq.id), createdAt: { gte: seriesStart } },
                }),
                prisma.cRMLead.groupBy({
                    by: ['stage'],
                    where: { headquartersId: hq.id },
                    _count: { _all: true },
                }),
                prisma.user.count({
                    where: { headquartersId: hq.id, isActive: true, isDeleted: false, role: { notIn: ['INVESTOR', 'SUPER_ADMIN'] as any[] } },
                }),
                prisma.user.findMany({
                    where: {
                        headquartersId: hq.id,
                        role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] as any[] },
                        isDeleted: false, isActive: true,
                    },
                    select: { complianceScore: true },
                }),
                calculateFacilityHealthScore(hq.id),
                // SIN ventana de fechas A PROPÓSITO: la pregunta no es "¿cuánto
                // facturó este mes?" sino "¿esta sede ha facturado ALGUNA VEZ?".
                // Es lo que separa una sede que todavía no abrió de una que abrió
                // y tuvo un mes flojo. Mayagüez: 0 facturas desde que existe
                // (medido 19-sep-2026). Cupey: 95.
                prisma.invoice.count({ where: { headquartersId: hq.id } }),
            ]);

            // ── Ocupación ────────────────────────────────────────────────
            const capacity = (hq as any).capacity ?? 0;
            const fisicos = billable.filter(p => p.status === 'ACTIVE').length;
            const enHospital = billable.length - fisicos;
            const occupancyRate = capacity > 0 ? Math.round((billable.length / capacity) * 100) : 0;
            const altasMes = billable.filter(p => {
                const ingreso = p.admissionDate ?? p.createdAt;
                return ingreso >= monthStart && ingreso < monthEnd;
            }).length;

            // ── Finanzas ─────────────────────────────────────────────────
            const facturadoMes = round2(monthInvoices.reduce((s, i) => s + i.totalAmount, 0));
            const cobradoMes = round2(monthInvoices.reduce((s, i) => s + i.amountPaid, 0));
            const tasaCobranza = facturadoMes > 0 ? Math.round((cobradoMes / facturadoMes) * 100) : null;
            const vencidoTotal = round2(overdueAll.reduce((s, i) => s + (i.totalAmount - i.amountPaid), 0));

            const conCuota = billable.filter(p => p.monthlyFee > 0);
            const mrr = round2(conCuota.reduce((s, p) => s + p.monthlyFee, 0));
            const arpu = conCuota.length > 0 ? round2(mrr / conCuota.length) : 0;
            const potencialMensual = round2(capacity * arpu);

            // Brecha de facturación: residentes facturables sin factura del mes.
            // Se expone como MONTO agregado — control interno visible, sin lista.
            const facturados = new Set(monthInvoices.map(i => i.patientId));
            const brechaFacturacion = round2(
                conCuota
                    .filter(p => (p.admissionDate ?? p.createdAt) < monthEnd && !facturados.has(p.id))
                    .reduce((s, p) => s + p.monthlyFee, 0)
            );

            // Serie mensual desde la apertura de ESTA sede (agrupación en JS,
            // un solo query). Una sede nueva no arrastra meses vacíos previos.
            const serie: { mes: string; facturado: number; cobrado: number }[] = [];
            for (let yy = seriesStart.getUTCFullYear(), mm = seriesStart.getUTCMonth(); yy < y || (yy === y && mm <= m);) {
                serie.push({ mes: `${yy}-${String(mm + 1).padStart(2, '0')}`, facturado: 0, cobrado: 0 });
                mm++; if (mm > 11) { mm = 0; yy++; }
            }
            const serieIdx = new Map(serie.map((s, i) => [s.mes, i]));
            for (const inv of seriesInvoices) {
                const key = inv.issueDate.toISOString().slice(0, 7);
                const idx = serieIdx.get(key);
                if (idx === undefined) continue;
                serie[idx].facturado = round2(serie[idx].facturado + inv.totalAmount);
                serie[idx].cobrado = round2(serie[idx].cobrado + inv.amountPaid);
            }

            // ── Crecimiento ──────────────────────────────────────────────
            // Embudo comercial de carga manual — la tendencia que el CRM no
            // captura porque nadie llena fichas individuales.
            const funnel = await getGrowthFunnel({ hqId: hq.id, from: seriesStart, to: monthEnd });
            const pipeline: Record<string, number> = Object.fromEntries(LEAD_STAGES.map(s => [s, 0]));
            for (const row of leadsByStage) pipeline[row.stage] = row._count._all;
            const leadsActivos = LEAD_STAGES.filter(s => s !== 'ADMISSION').reduce((s, k) => s + pipeline[k], 0);
            const camasLibres = Math.max(0, capacity - billable.length);
            // Ritmo de admisiones: si el Director carga el embudo a mano, ESE
            // es el dato del negocio (incluye admisiones que el sistema no vio).
            // Si no, se deriva de los residentes creados desde la apertura.
            const ritmoMensual = funnel.admisionesMensualPromedio ?? (altasDesdeAncla / mesesDesdeAncla);
            const mesesAFullOcupacion = ritmoMensual > 0 && camasLibres > 0
                ? Math.ceil(camasLibres / ritmoMensual)
                : null;

            // ── Calidad + Equipo ─────────────────────────────────────────
            // A un socio no se le manda un promedio de un numero que sabemos
            // invertido. Va null y la pantalla omite la tarjeta.
            const avgCompliance = Z_SCORE_VISIBLE && clinicalStaff.length > 0
                ? Math.round(clinicalStaff.reduce((s, e) => s + (e.complianceScore || 0), 0) / clinicalStaff.length)
                : null;
            const ratioStaffResidente = billable.length > 0 ? round2(staffAll / billable.length) : 0;

            // ── Rentabilidad (Fase 3) ────────────────────────────────────
            // Gastos de carga manual; un mes sin cargar NO reporta margen del
            // 100% (hasExpenseData=false). Ver profitability.ts.
            const profitSeries = await getProfitabilitySeries({ hqId: hq.id, from: seriesStart, to: monthEnd });

            /**
             * LA SALUD SE MIDE SOBRE MESES CERRADOS.
             *
             * El mes en curso factura completo el día 1 y acumula gastos poco a
             * poco, así que su margen sale inflado hasta el último día. Medido el
             * 16-sep: septiembre llevaba $23.708 de gastos contra los $34.963 de
             * agosto — mezclarlos da un número que no sirve para decidir.
             *
             * Los tres últimos meses CERRADOS mandan; el mes en curso viaja
             * aparte y marcado, para verlo sin que contamine.
             */
            const mesEnCursoKey = `${y}-${String(m + 1).padStart(2, '0')}`;
            const { cerrados, ultimosTresCerrados, enCurso } = partirPorCierre(profitSeries, mesEnCursoKey);
            const profitSummary = summarizeProfitability(ultimosTresCerrados);

            /**
             * DOS CAUSAS DISTINTAS QUE HASTA HOY DECÍAN LA MISMA FRASE.
             *
             * `profitSummary.mesesConDatos === 0` se leía siempre como "falta
             * cargar los gastos". Para Mayagüez eso era FALSO y además le echaba
             * la culpa al dueño: sus gastos SÍ están cargados —16.666,66 de renta
             * en septiembre, cargados el 16-sep a las 12:03— y aun así el bullet
             * le pedía que los cargara. Lo que no tiene es un mes CERRADO: entró
             * al sistema el 02-sep y abre en octubre, así que su serie empieza en
             * septiembre y septiembre todavía no termina. `cerrados` sale vacío,
             * `summarizeProfitability([])` devuelve mesesConDatos 0 Y
             * mesesSinDatos 0 —no hay meses de los que faltar nada— y las dos
             * situaciones caían en el mismo `else`.
             *
             * Se separan:
             *   SIN_MESES_CERRADOS  → no se le pide nada. Se le dice lo que es.
             *   SIN_GASTOS_CARGADOS → hay meses cerrados y nadie cargó gastos.
             */
            const motivoSinRentabilidad: 'SIN_MESES_CERRADOS' | 'SIN_GASTOS_CARGADOS' | null =
                profitSummary.mesesConDatos > 0
                    ? null
                    : cerrados.length === 0
                        ? 'SIN_MESES_CERRADOS'
                        : 'SIN_GASTOS_CARGADOS';

            const ventanaRentabilidad = {
                /** Primer mes de la serie de ESTA sede (el ancla, no el piso global). */
                desde: profitSeries[0]?.mes ?? mesEnCursoKey,
                /** Último mes CERRADO. null cuando la sede no ha cerrado ninguno. */
                hasta: cerrados.length > 0 ? cerrados[cerrados.length - 1].mes : null,
                mesEnCurso: mesEnCursoKey,
                /** Meses cerrados que EXISTEN en la serie de la sede. */
                mesesCerrados: cerrados.length,
                /** De esos, los que entran en el margen (los tres últimos). */
                mesesEnResumen: ultimosTresCerrados.length,
                motivoSinRentabilidad,
            };

            /**
             * ¿ESTA SEDE ABRIÓ YA?
             *
             * `isOpen` del payload NO contesta esto y por eso no se reutiliza:
             * sale de `hq.isActive`, y `targetHqs` ya filtra `isActive: true`, así
             * que hoy `isOpen` es true para TODAS las sedes que llegan aquí —
             * incluida Mayagüez, que abre en octubre. `isActive` significa "la
             * sede está dada de alta en el sistema", que es otra pregunta.
             *
             * Pre-apertura = CENSO VACÍO, nunca emitió una factura, y ningún mes
             * cerrado. Se piden las TRES:
             *
             *  · sin facturas pero con meses cerrados → una sede abierta que no
             *    está cobrando. Eso es una alarma, no una obra en curso.
             *  · con facturas pero sin meses cerrados → una sede que abrió este
             *    mismo mes.
             *  · con residentes pero sin facturas todavía → una sede que YA
             *    ABRIÓ y cuya primera facturación aún no salió. Sin esta tercera
             *    condición, Mayagüez en octubre —primeros ingresos el día 3, el
             *    cron de facturas corre el día 1 del mes siguiente— seguiría
             *    marcada como pre-apertura, y el bullet de abajo afirmaría "no
             *    recibe residentes" en la misma lista donde el primer bullet ya
             *    dice "Ocupación 6% — 3 de 50 camas". Un rótulo no puede afirmar
             *    un estado que el censo de dos líneas más arriba desmiente.
             *
             * Hoy (19-sep-2026) las tres valen para Mayagüez: 0 residentes
             * facturables, 0 facturas en toda su vida, 0 meses cerrados.
             */
            const esPreApertura = billable.length === 0 && facturasHistoricas === 0 && cerrados.length === 0;

            /**
             * GASTO CARGADO ANTES DE QUE EMPEZARA LA SERIE.
             *
             * Solo se calcula para una sede en pre-apertura, y no por ahorro: para
             * Cupey este número sería 47.405,72 —el junio que el SERIES_FLOOR deja
             * fuera a propósito— y eso NO es inversión previa a la apertura, es un
             * mes operativo excluido. El mismo número significa cosas opuestas
             * según la sede, así que solo se expone donde significa una.
             *
             * En Mayagüez son 168.333,21 en once meses (oct-2025 → ago-2026), todo
             * de categoría RENT, contra cero facturado. Es renta pagada de un
             * edificio que todavía no recibe a nadie.
             *
             * LO QUE ESTE NÚMERO NO DICE: quién puso el dinero. El dueño decidió
             * el 19-sep-2026 que la renta de Mayagüez la pagan fondos de Cupey y
             * se contabiliza en Mayagüez, que se la devolverá. Eso es un acuerdo
             * entre socios, no una columna de la base: `MonthlyExpense` no guarda
             * quién pagó. Por eso el campo se llama gasto, no deuda, y la pantalla
             * no debe llamarlo "lo que Mayagüez le debe a Cupey" sin que alguien
             * lo confirme fuera del sistema.
             */
            let gastoPrevioALaSerie: number | null = null;
            let mesesDeGastoPrevio = 0;
            let primerMesConGasto: string | null = null;
            if (esPreApertura) {
                const previos = await prisma.monthlyExpense.findMany({
                    where: { headquartersId: hq.id, periodMonth: { lt: seriesStart } },
                    select: { periodMonth: true, amount: true },
                    orderBy: { periodMonth: 'asc' },
                });
                if (previos.length > 0) {
                    gastoPrevioALaSerie = round2(previos.reduce((s, e) => s + e.amount, 0));
                    mesesDeGastoPrevio = new Set(previos.map(e => e.periodMonth.toISOString().slice(0, 7))).size;
                    primerMesConGasto = previos[0].periodMonth.toISOString().slice(0, 7);
                }
            }

            const apertura = {
                /** Mes en que la sede entró al sistema (Headquarters.createdAt). */
                mesAlta: `${(hqCreated ?? now).getUTCFullYear()}-${String((hqCreated ?? now).getUTCMonth() + 1).padStart(2, '0')}`,
                /** true = la sede no ha emitido una sola factura en toda su vida. */
                sinFacturacionHistorica: facturasHistoricas === 0,
                esPreApertura,
                gastoPrevioALaSerie,
                mesesDeGastoPrevio,
                primerMesConGasto,
            };
            // La estructura de costos suma la ventana entera: con un solo mes
            // desaparecen las categorías que ese mes no llevaba cargadas.
            const estructura = estructuraDeCostos(ultimosTresCerrados);
            const breakEven = calculateBreakEven({
                gastoMensualPromedio: profitSummary.gastoMensualPromedio,
                arpu,
                ocupadas: billable.length,
                capacity,
            });

            // ── Resumen ejecutivo — bullets deterministas desde los datos ──
            const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

            /**
             * EL BULLET QUE IMPRIMÍA LA PALABRA "null".
             *
             * Decía, tal cual, lo que veía un socio al abrir la pantalla:
             *   Cupey:    "Salud operativa: 70/100 (ALERTA) — compliance clínico
             *              promedio null/100."
             *   Mayagüez: "Salud operativa: null/100 (null) — compliance clínico
             *              promedio null/100."
             *
             * `avgCompliance` es null desde el 09-sep porque Z_SCORE_VISIBLE está
             * en false, y `${null}` dentro de un template string no desaparece:
             * escribe las cuatro letras. El comentario de arriba prometía que "la
             * pantalla omite la tarjeta" y esa guarda nunca se escribió.
             *
             * La guarda va sobre el VALOR, no sobre el flag. Si se escribiera
             * `if (Z_SCORE_VISIBLE)` el bug sobreviviría a su propio arreglo: el
             * día que se encienda el flag, Mayagüez —cero empleados clínicos—
             * seguiría dando null y volvería a imprimir "null". Un null se
             * comprueba donde está, no donde creemos que se originó.
             *
             * Lo mismo con `fhs.score`, que desde el 19-sep puede ser null cuando
             * la sede no tiene expedientes que medir (ver facility-health.ts).
             */
            const bulletSalud = fhs.score !== null
                ? `Salud operativa: ${fhs.score}/100 (${fhs.grade})` +
                  (avgCompliance !== null ? ` — compliance clínico promedio ${avgCompliance}/100.` : '.')
                : `Salud operativa: no se mide todavía — ${fhs.motivoNoMedible ?? 'sin datos clínicos'}.`;

            const resumen: string[] = [
                `Ocupación ${occupancyRate}% — ${billable.length} de ${capacity} camas${enHospital > 0 ? ` (${enHospital} en hospital con cama reservada)` : ''}${altasMes > 0 ? `, +${altasMes} admisión${altasMes > 1 ? 'es' : ''} este mes` : ''}${bajasMes > 0 ? `, −${bajasMes} egreso${bajasMes > 1 ? 's' : ''}` : ''}.`,
                `Mes en curso: ${fmt(facturadoMes)} facturado, ${fmt(cobradoMes)} cobrado${tasaCobranza !== null ? ` (${tasaCobranza}% cobranza)` : ''}${vencidoTotal > 0 ? ` — ${fmt(vencidoTotal)} vencido acumulado` : ''}.`,
                `Ingreso recurrente: ${fmt(mrr)}/mes con cuota promedio de ${fmt(arpu)}. Potencial a plena ocupación: ${fmt(potencialMensual)}/mes.`,
                // Crecimiento: se prefiere el embudo cargado a mano (refleja el
                // negocio real) sobre el pipeline del CRM, que hoy nadie llena.
                funnel.mesesConDatos > 0
                    ? `Crecimiento: ${funnel.totales.prospects} prospecto${funnel.totales.prospects !== 1 ? 's' : ''} y ${funnel.totales.tours} tour${funnel.totales.tours !== 1 ? 's' : ''} en ${funnel.mesesConDatos} mes${funnel.mesesConDatos !== 1 ? 'es' : ''}, ${funnel.totales.admissions} admisión${funnel.totales.admissions !== 1 ? 'es' : ''}${funnel.conversionPct !== null ? ` (${funnel.conversionPct}% de conversión)` : ''}` +
                      (mesesAFullOcupacion !== null ? `; al ritmo actual, plena ocupación en ~${mesesAFullOcupacion} meses.` : '.')
                    : mesesAFullOcupacion !== null
                        ? `Crecimiento: ${leadsActivos} prospecto${leadsActivos !== 1 ? 's' : ''} en pipeline; al ritmo actual, plena ocupación en ~${mesesAFullOcupacion} meses.`
                        : `Crecimiento: ${leadsActivos} prospecto${leadsActivos !== 1 ? 's' : ''} en pipeline activo.`,
                bulletSalud,
            ];

            /**
             * Una sede que todavía no abrió encabeza su propio resumen diciéndolo.
             * Sin esto, los bullets de arriba —0% de ocupación, $0 facturado, 0
             * prospectos— se leen como una sede que se está hundiendo, cuando son
             * exactamente los números que debe tener un edificio que abre el mes
             * que viene. El cero es la verdad; lo que faltaba era el contexto.
             */
            if (esPreApertura) {
                resumen.unshift(
                    `Pre-apertura: esta sede todavía no recibe residentes, así que sus ceros son reales y no un fallo de carga.` +
                    (gastoPrevioALaSerie !== null
                        ? ` Lleva ${fmt(gastoPrevioALaSerie)} de gasto acumulado en ${mesesDeGastoPrevio} mes${mesesDeGastoPrevio !== 1 ? 'es' : ''} desde ${primerMesConGasto}, antes de facturar un solo dólar.`
                        : '')
                );
            }

            // Rentabilidad: solo se afirma con datos cargados. Si faltan, el
            // bullet lo dice en vez de callar — un socio debe saber por qué no
            // ve margen.
            if (profitSummary.mesesConDatos > 0) {
                resumen.push(
                    `Rentabilidad (${profitSummary.mesesConDatos} mes${profitSummary.mesesConDatos !== 1 ? 'es' : ''} con gastos cargados): ${fmt(profitSummary.margen)} de margen sobre ${fmt(profitSummary.ingresos)} facturados${profitSummary.margenPct !== null ? ` (${profitSummary.margenPct}%)` : ''}.` +
                    (breakEven
                        ? ` Punto de equilibrio: ${breakEven.camasNecesarias} camas (${breakEven.ocupacionEquilibrioPct}% de ocupación)` +
                          (breakEven.alcanzable
                              ? `; hoy ${breakEven.camasSobreEquilibrio >= 0 ? `${breakEven.camasSobreEquilibrio} por encima` : `${Math.abs(breakEven.camasSobreEquilibrio)} por debajo`}.`
                              : ` — NO alcanzable con ${capacity} camas al ARPU actual.`)
                        : '')
                );
            } else if (motivoSinRentabilidad === 'SIN_MESES_CERRADOS') {
                // NO se le pide nada. Una sede que lleva 17 días dada de alta no
                // tiene un mes cerrado, y eso no es un descuido de nadie. Si
                // además tiene gastos cargados, se dicen: son ciertos y son suyos,
                // solo que no hay ingreso contra el cual medirlos todavía.
                resumen.push(
                    `Rentabilidad: todavía no hay ningún mes cerrado que medir — la serie de esta sede empieza en ${ventanaRentabilidad.desde} y ${mesEnCursoKey} sigue en curso.` +
                    (enCurso?.hasExpenseData
                        ? ` Los gastos del mes SÍ están cargados (${fmt(enCurso.gastos)}); el margen aparecerá cuando cierre el mes.`
                        : '')
                );
            } else {
                // El conteo que va en la frase es el de la VENTANA que se mide
                // (los tres últimos cerrados), no el de todos los meses cerrados
                // de la sede. No es lo mismo: en noviembre Cupey tendrá cuatro
                // cerrados y la ventana mirará tres, así que decir "hay 4 meses
                // cerrados pero nadie cargó los gastos" acusaría de estar vacío a
                // un julio que sí los tiene cargados —solo que ya no se mira—.
                // La frase habla de lo que se midió.
                const n = ventanaRentabilidad.mesesEnResumen;
                resumen.push(
                    `Rentabilidad: sin datos — ${n} mes${n !== 1 ? 'es' : ''} cerrado${n !== 1 ? 's' : ''} en la ventana y ninguno tiene gastos operativos cargados, así que no se puede calcular margen.`
                );
            }

            kpisByHq.push({
                hqId: hq.id,
                name: hq.name,
                logoUrl: (hq as any).logoUrl ?? null,
                // OJO: `isOpen` NO dice si la sede abrió sus puertas. Es
                // `isActive`, o sea "está dada de alta en el sistema", y como
                // `targetHqs` ya filtra por `isActive: true`, aquí siempre vale
                // true. Se deja tal cual para no romper a quien lo consuma; la
                // pregunta de si abrió se contesta en `apertura`, abajo.
                isOpen: (hq as any).isActive ?? true,
                apertura,
                resumen,
                ocupacion: {
                    capacity,
                    ocupadas: billable.length,
                    fisicos,
                    enHospital,
                    occupancyRate,
                    camasLibres,
                    altasMes,
                    bajasMes,
                },
                finanzas: {
                    facturadoMes,
                    cobradoMes,
                    tasaCobranza,
                    vencidoTotal,
                    arpu,
                    mrr,
                    potencialMensual,
                    brechaFacturacion,
                    serie,
                },
                crecimiento: {
                    pipeline,
                    leadsActivos,
                    ritmoMensualAdmisiones: round2(ritmoMensual),
                    mesesAFullOcupacion,
                    funnel,
                },
                calidad: {
                    /** number | null — null = sede sin expedientes, no hay nota. */
                    facilityHealthScore: fhs.score,
                    facilityHealthGrade: fhs.grade,
                    /** false → la pantalla pinta "—", NO un 0 ni un "null". */
                    facilityHealthMedible: fhs.medible,
                    facilityHealthMotivo: fhs.motivoNoMedible,
                    facilityHealthBreakdown: fhs.breakdown,
                    /** number | null — null mientras Z_SCORE_VISIBLE siga en false. */
                    clinicalComplianceRate: avgCompliance,
                },
                equipo: {
                    staffCount: staffAll,
                    clinicalCount: clinicalStaff.length,
                    ratioStaffResidente,
                },
                rentabilidad: {
                    ...profitSummary,
                    /** Los tres cerrados: lo que sostiene el margen y el equilibrio. */
                    serie: ultimosTresCerrados,
                    /** El mes en curso, aparte y marcado. No entra en el margen. */
                    enCurso,
                    /** Estructura de costos de los tres cerrados juntos. */
                    estructura,
                    breakEven,
                    /** Qué meses cubre esto, y por qué no hay margen si no lo hay. */
                    ventana: ventanaRentabilidad,
                },
            });

            // Lo que esta sede aporta al consolidado. Se guarda aparte del payload
            // para no tener que releer el objeto público ni volver a la base.
            aportes.push({
                hqId: hq.id,
                name: hq.name,
                capacity,
                ocupadas: billable.length,
                fisicos,
                enHospital,
                camasLibres,
                mrr,
                facturadoMes,
                cobradoMes,
                vencidoTotal,
                brechaFacturacion,
                // De la ventana CERRADA. profitSummary ya descarta los meses sin
                // gastos cargados, y eso es lo correcto para un margen: un mes
                // aporta sus ingresos Y sus costos, o no aporta ninguno de los dos.
                mesesCerradosConDatos: profitSummary.mesesConDatos,
                ingresosCerrados: profitSummary.ingresos,
                gastosCerrados: profitSummary.gastos,
                mesesDeLaVentana: ultimosTresCerrados.filter(mes => mes.hasExpenseData).map(mes => mes.mes),
                gastoMesEnCurso: enCurso?.gastos ?? 0,
                gastoPrevioALaSerie: gastoPrevioALaSerie ?? 0,
                esPreApertura,
            });
        }

        return NextResponse.json({ success: true, targets: kpisByHq, consolidado: consolidar(aportes) });
    } catch (error) {
        logError('corporate.investors.kpis', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
