import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { calculateFacilityHealthScore } from '@/lib/facility-health';
import { billableResidentsWhere } from '@/lib/billable-residents';
import { round2 } from '@/lib/payment-math';
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

// La facturación mensual sistemática arrancó en julio 2026; junio tiene $21 de
// ruido de pruebas de concierge. Ancla de la serie histórica.
const SERIES_START = { year: 2026, month: 6 }; // month 0-11 → julio

const LEAD_STAGES = ['PROSPECT', 'TOUR', 'EVALUATION', 'CONTRACT', 'ADMISSION'] as const;

export async function GET(_req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const targetHqs = auth.role === 'DIRECTOR'
            ? await prisma.headquarters.findMany({ where: { id: auth.headquartersId } })
            : await prisma.headquarters.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });

        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        // Rangos en UTC — el cron escribe issueDate a las 00:00Z; construir el
        // rango en hora local (AST) dejaba fuera TODAS las facturas del mes.
        const monthStart = new Date(Date.UTC(y, m, 1));
        const monthEnd = new Date(Date.UTC(y, m + 1, 1));
        const seriesStart = new Date(Date.UTC(SERIES_START.year, SERIES_START.month, 1));
        // Meses transcurridos desde el ancla de datos reales, para el ritmo de
        // admisiones. Una ventana móvil de 90 días capturaba la carga inicial
        // del sistema (26 residentes legacy creados en bloque el 21-may) e
        // inflaba el ritmo a ~10/mes → "full ocupación en 2 meses", fantasía.
        const mesesDesdeAncla = Math.max(
            (now.getTime() - seriesStart.getTime()) / (30.44 * 24 * 3600 * 1000),
            0.5
        );

        const kpisByHq = [];

        for (const hq of targetHqs) {
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

            // Serie mensual desde julio-2026 (agrupación en JS, un solo query)
            const serie: { mes: string; facturado: number; cobrado: number }[] = [];
            for (let yy = SERIES_START.year, mm = SERIES_START.month; yy < y || (yy === y && mm <= m);) {
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
            const pipeline: Record<string, number> = Object.fromEntries(LEAD_STAGES.map(s => [s, 0]));
            for (const row of leadsByStage) pipeline[row.stage] = row._count._all;
            const leadsActivos = LEAD_STAGES.filter(s => s !== 'ADMISSION').reduce((s, k) => s + pipeline[k], 0);
            const camasLibres = Math.max(0, capacity - billable.length);
            const ritmoMensual = altasDesdeAncla / mesesDesdeAncla;
            const mesesAFullOcupacion = ritmoMensual > 0 && camasLibres > 0
                ? Math.ceil(camasLibres / ritmoMensual)
                : null;

            // ── Calidad + Equipo ─────────────────────────────────────────
            const avgCompliance = clinicalStaff.length > 0
                ? Math.round(clinicalStaff.reduce((s, e) => s + (e.complianceScore || 0), 0) / clinicalStaff.length)
                : 0;
            const ratioStaffResidente = billable.length > 0 ? round2(staffAll / billable.length) : 0;

            // ── Resumen ejecutivo — bullets deterministas desde los datos ──
            const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
            const resumen: string[] = [
                `Ocupación ${occupancyRate}% — ${billable.length} de ${capacity} camas${enHospital > 0 ? ` (${enHospital} en hospital con cama reservada)` : ''}${altasMes > 0 ? `, +${altasMes} admisión${altasMes > 1 ? 'es' : ''} este mes` : ''}${bajasMes > 0 ? `, −${bajasMes} egreso${bajasMes > 1 ? 's' : ''}` : ''}.`,
                `Mes en curso: ${fmt(facturadoMes)} facturado, ${fmt(cobradoMes)} cobrado${tasaCobranza !== null ? ` (${tasaCobranza}% cobranza)` : ''}${vencidoTotal > 0 ? ` — ${fmt(vencidoTotal)} vencido acumulado` : ''}.`,
                `Ingreso recurrente: ${fmt(mrr)}/mes con cuota promedio de ${fmt(arpu)}. Potencial a plena ocupación: ${fmt(potencialMensual)}/mes.`,
                mesesAFullOcupacion !== null
                    ? `Crecimiento: ${leadsActivos} prospecto${leadsActivos !== 1 ? 's' : ''} en pipeline; al ritmo actual, plena ocupación en ~${mesesAFullOcupacion} meses.`
                    : `Crecimiento: ${leadsActivos} prospecto${leadsActivos !== 1 ? 's' : ''} en pipeline activo.`,
                `Salud operativa: ${fhs.score}/100 (${fhs.grade}) — compliance clínico promedio ${avgCompliance}/100.`,
            ];

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
            });
        }

        return NextResponse.json({ success: true, targets: kpisByHq });
    } catch (error) {
        logError('corporate.investors.kpis', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
