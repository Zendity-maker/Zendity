import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { calculateFacilityHealthScore } from '@/lib/facility-health';
import { billableResidentsWhere } from '@/lib/billable-residents';
import { round2 } from '@/lib/payment-math';
import { getProfitabilitySeries, summarizeProfitability, calculateBreakEven } from '@/lib/profitability';
import { getGrowthFunnel } from '@/lib/growth';
import { logError } from '@/lib/logger';

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

export async function GET(_req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

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
                        ...(auth.headquartersId ? [{ id: auth.headquartersId }] : []),
                        ...(auth.id ? [{ ownerId: auth.id }] : []),
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
            const avgCompliance = clinicalStaff.length > 0
                ? Math.round(clinicalStaff.reduce((s, e) => s + (e.complianceScore || 0), 0) / clinicalStaff.length)
                : 0;
            const ratioStaffResidente = billable.length > 0 ? round2(staffAll / billable.length) : 0;

            // ── Rentabilidad (Fase 3) ────────────────────────────────────
            // Gastos de carga manual; un mes sin cargar NO reporta margen del
            // 100% (hasExpenseData=false). Ver profitability.ts.
            const profitSeries = await getProfitabilitySeries({ hqId: hq.id, from: seriesStart, to: monthEnd });
            const profitSummary = summarizeProfitability(profitSeries);
            const breakEven = calculateBreakEven({
                gastoMensualPromedio: profitSummary.gastoMensualPromedio,
                arpu,
                ocupadas: billable.length,
                capacity,
            });

            // ── Resumen ejecutivo — bullets deterministas desde los datos ──
            const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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
                `Salud operativa: ${fhs.score}/100 (${fhs.grade}) — compliance clínico promedio ${avgCompliance}/100.`,
            ];

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
            } else {
                resumen.push('Rentabilidad: sin datos — falta cargar los gastos operativos mensuales para calcular margen.');
            }

            kpisByHq.push({
                hqId: hq.id,
                name: hq.name,
                logoUrl: (hq as any).logoUrl ?? null,
                isOpen: (hq as any).isActive ?? true,
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
                    facilityHealthScore: fhs.score,
                    facilityHealthGrade: fhs.grade,
                    facilityHealthBreakdown: fhs.breakdown,
                    clinicalComplianceRate: avgCompliance,
                },
                equipo: {
                    staffCount: staffAll,
                    clinicalCount: clinicalStaff.length,
                    ratioStaffResidente,
                },
                rentabilidad: {
                    ...profitSummary,
                    serie: profitSeries,
                    breakEven,
                },
            });
        }

        return NextResponse.json({ success: true, targets: kpisByHq });
    } catch (error) {
        logError('corporate.investors.kpis', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
