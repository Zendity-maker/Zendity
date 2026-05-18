/**
 * Facility Health Score (FHS)
 *
 * Métrica independiente por sede que mide la salud operativa y clínica
 * en tiempo real. A diferencia del complianceScore individual (basado en
 * actividad del empleado), el FHS mide OUTCOMES de la facilidad.
 *
 * Base: 100 puntos
 * Penalizaciones:
 *   − UPPs activas             × 3  (cap −20)
 *   − Caídas severas/fatales   × 5  (cap −20, ventana 30 días)
 *   − Quejas PENDING           × 2  (cap −15)
 *   − Handovers faltantes hoy  × 5  (cap −15)
 *   − Med compliance < 80%: (80 − pct) × 0.5 (cap −10)
 * Bonificación:
 *   + 5 si cero incidentes en 7 días
 *
 * Cap final: [0, 100]
 */

import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

export interface FacilityHealthBreakdown {
    activeUPPs: number;
    uppPenalty: number;
    severeFalls: number;
    fallPenalty: number;
    pendingComplaints: number;
    complaintPenalty: number;
    missingHandovers: number;
    handoverPenalty: number;
    medCompliancePct: number;
    medPenalty: number;
    incidentsLast7d: number;
    incidentBonus: number;
    totalDeduction: number;
}

export interface FacilityHealthResult {
    score: number;
    grade: 'EXCELENTE' | 'BUENO' | 'ALERTA' | 'CRITICO';
    breakdown: FacilityHealthBreakdown;
}

function gradeFromScore(score: number): FacilityHealthResult['grade'] {
    if (score >= 90) return 'EXCELENTE';
    if (score >= 75) return 'BUENO';
    if (score >= 55) return 'ALERTA';
    return 'CRITICO';
}

export async function calculateFacilityHealthScore(hqId: string): Promise<FacilityHealthResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);
    const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 3600000);
    const todayStart    = todayStartAST();
    const now           = new Date();

    const [
        activeUPPs,
        severeFalls,
        pendingComplaints,
        incidentsLast7d,
        todayHandoverAuthors,
        medsAdministeredToday,
        meds_total_today,
    ] = await Promise.all([
        // UPPs activas (cualquier grado)
        prisma.pressureUlcer.count({
            where: { status: 'ACTIVE', patient: { headquartersId: hqId } },
        }),
        // Caídas con severidad SEVERE o FATAL últimos 30 días
        prisma.fallIncident.count({
            where: {
                patient: { headquartersId: hqId },
                severity: { in: ['SEVERE', 'FATAL'] },
                incidentDate: { gte: thirtyDaysAgo },
            },
        }),
        // Quejas pendientes de resolución
        prisma.complaint.count({
            where: { headquartersId: hqId, status: 'PENDING' },
        }),
        // Incidentes clínicos reportados últimos 7 días
        prisma.incident.count({
            where: { headquartersId: hqId, reportedAt: { gte: sevenDaysAgo } },
        }),
        // Handovers firmados hoy (para calcular faltantes)
        prisma.shiftHandover.findMany({
            where: {
                headquartersId: hqId,
                createdAt: { gte: todayStart },
                isDailyPrologue: false,
                signature: { not: null },
            },
            select: { outgoingNurseId: true },
        }),
        // Meds administrados hoy
        prisma.medicationAdministration.count({
            where: {
                patientMedication: { patient: { headquartersId: hqId } },
                status: 'ADMINISTERED',
                createdAt: { gte: todayStart },
            },
        }),
        // Total de meds registrados hoy (administrados + omitidos)
        prisma.medicationAdministration.count({
            where: {
                patientMedication: { patient: { headquartersId: hqId } },
                status: { in: ['ADMINISTERED', 'OMITTED'] },
                createdAt: { gte: todayStart },
            },
        }),
    ]);

    // Handovers faltantes hoy — pendiente de migrar a ScheduledShift (Schedule Builder).
    // Antes leíamos ShiftSchedule (legacy, sin datos en prod) y siempre daba 0.
    void todayHandoverAuthors;
    const missingHandovers = 0;

    // Compliance de meds del día (0–100%)
    const medCompliancePct = meds_total_today > 0
        ? (medsAdministeredToday / meds_total_today) * 100
        : 100; // sin meds registrados = no penalizar

    // ── Cálculo de penalidades ─────────────────────────────────────
    const uppPenalty       = Math.min(activeUPPs * 3, 20);
    const fallPenalty      = Math.min(severeFalls * 5, 20);
    const complaintPenalty = Math.min(pendingComplaints * 2, 15);
    const handoverPenalty  = Math.min(missingHandovers * 5, 15);
    const medPenalty       = medCompliancePct < 80
        ? Math.min((80 - medCompliancePct) * 0.5, 10)
        : 0;

    const totalDeduction = uppPenalty + fallPenalty + complaintPenalty + handoverPenalty + medPenalty;

    // ── Bonificación ───────────────────────────────────────────────
    const incidentBonus = incidentsLast7d === 0 ? 5 : 0;

    const raw = 100 - totalDeduction + incidentBonus;
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    return {
        score,
        grade: gradeFromScore(score),
        breakdown: {
            activeUPPs,
            uppPenalty:       Math.round(uppPenalty),
            severeFalls,
            fallPenalty,
            pendingComplaints,
            complaintPenalty,
            missingHandovers,
            handoverPenalty,
            medCompliancePct: Math.round(medCompliancePct),
            medPenalty:       Math.round(medPenalty),
            incidentsLast7d,
            incidentBonus,
            totalDeduction:   Math.round(totalDeduction),
        },
    };
}
