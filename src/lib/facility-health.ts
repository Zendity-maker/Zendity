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
 *
 * SEDE SIN RESIDENTES MATRICULADOS = NO SE MIDE (19-sep-2026)
 * -----------------------------------------------------------
 * Medido ese día contra producción: Mayagüez, que abre en octubre y tiene
 * CERO residentes, sacaba 100 EXCELENTE. Cupey —32 matriculados, 5 UPP
 * activas, 4 caídas severas— sacaba 70 ALERTA. Un socio que compare las dos
 * concluye que la sede vacía es la sana.
 *
 * No era mala suerte: con cero pacientes, 100 era el ÚNICO resultado
 * alcanzable. Tres de las cinco penalizaciones (UPP, caídas, meds) cuelgan de
 * `patient.headquartersId` y sin pacientes valen 0; las quejas exigen
 * patientId; el compliance de meds caía al default de "no penalizar"; y el
 * bonus de +5 por cero incidentes entraba siempre. Es el olor que describe
 * CLAUDE.md: una métrica que sale redonda siempre no es buena, es una que no
 * puede moverse.
 *
 * Por eso, con cero matriculados la función NO devuelve puntuación:
 * `score: null`, `grade: null`, `medible: false`. El desglose sí se devuelve
 * —los ceros de Mayagüez son ciertos— para que la pantalla pueda enseñar
 * "0 UPP, 0 caídas" sin inventarse una nota.
 *
 * El umbral es la MATRÍCULA (ACTIVE + TEMPORARY_LEAVE), no "algún expediente
 * alguna vez". Contando expedientes de cualquier estado, una sede que se
 * vaciara —todos sus residentes de alta o fallecidos— volvería a sacar 100
 * EXCELENTE a los 30 días, que es exactamente el bug que esto viene a matar.
 * Cupey al 19-sep tiene 32 matriculados de 48 expedientes (9 fallecidos,
 * 7 de alta): con cualquiera de los dos criterios es medible y su nota no se
 * mueve, pero solo uno sigue siendo cierto el día que la sede se vacíe.
 */

import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { enrolledResidentsWhere } from '@/lib/billable-residents';
import { eMARdeHoy } from '@/lib/emar-dia';

export interface FacilityHealthBreakdown {
    /** Residentes matriculados (ACTIVE + TEMPORARY_LEAVE). 0 = no hay nada que medir. */
    residentesMatriculados: number;
    activeUPPs: number;
    uppPenalty: number;
    severeFalls: number;
    fallPenalty: number;
    pendingComplaints: number;
    complaintPenalty: number;
    missingHandovers: number;
    handoverPenalty: number;
    /**
     * null = no se registró ninguna dosis hoy, así que no hay porcentaje que
     * dar. Antes devolvía 100 en ese caso, que se lee igual que "cumplimiento
     * perfecto". Penaliza igual (cero) pero ya no afirma lo que no midió.
     */
    medCompliancePct: number | null;
    medPenalty: number;
    incidentsLast7d: number;
    incidentBonus: number;
    totalDeduction: number;
}

export type FacilityHealthGrade = 'EXCELENTE' | 'BUENO' | 'ALERTA' | 'CRITICO';

export interface FacilityHealthResult {
    /** null cuando la sede no es medible (ver `medible`). Nunca un default inventado. */
    score: number | null;
    grade: FacilityHealthGrade | null;
    /** false = no hay residentes matriculados. La sede no está sana ni enferma: está vacía. */
    medible: boolean;
    /** Texto corto y listo para pantalla del por qué no se mide. null si sí se mide. */
    motivoNoMedible: string | null;
    breakdown: FacilityHealthBreakdown;
}

/*
 * POR QUÉ null Y NO UN GRADE NUEVO TIPO 'SIN_DATOS':
 * `grade` lo pinta `corporate/investors/page.tsx` (el ternario `gradeColor`)
 * con una cadena sin rama por defecto: lo que no sea EXCELENTE / BUENO /
 * ALERTA cae en `text-rose-400`, que es el color de CRÍTICO. (Se cita por
 * nombre y no por número de línea: la pantalla se está reescribiendo en
 * paralelo y el número ya se movió una vez.) Meter un quinto valor
 * en el union pintaría la sede vacía de rojo de crisis — cambiar una mentira
 * por otra. Con null, en cambio, la pantalla ya tiene el patrón hecho: en ese
 * mismo bloque de KPIs `tasaCobranza` se pinta `—` cuando es null. Y es la
 * convención de la casa: `/api/corporate/route.ts` ya devuelve empScore,
 * famSatisfaction y medsCompliance como `number | null` con el comentario
 * "nunca un default inventado".
 */

function gradeFromScore(score: number): FacilityHealthGrade {
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
        residentesMatriculados,
        activeUPPs,
        severeFalls,
        pendingComplaints,
        incidentsLast7d,
        todayHandoverAuthors,
        medsAdministeredToday,
        meds_total_today,
    ] = await Promise.all([
        // ¿Hay alguien a quien cuidar en esta sede HOY? El FHS mide el estado
        // actual, así que el umbral es la matrícula —el hospitalizado sigue
        // matriculado, el de alta y el fallecido no— y se toma del único sitio
        // donde se decide ese criterio: `enrolledResidentsWhere`. No se escribe
        // el `status` a mano aquí; si mañana aparece un quinto PatientStatus,
        // esta consulta lo hereda. (19-sep-2026: Cupey 32, Mayagüez 0.)
        prisma.patient.count({ where: enrolledResidentsWhere(hqId) }),
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
                // Por la FECHA DE LA DOSIS, no por la de escritura. Ver src/lib/emar-dia.ts.
                ...eMARdeHoy(),
            },
        }),
        // Total de meds registrados hoy (administrados + omitidos)
        prisma.medicationAdministration.count({
            where: {
                patientMedication: { patient: { headquartersId: hqId } },
                status: { in: ['ADMINISTERED', 'OMITTED'] },
                // Por la FECHA DE LA DOSIS, no por la de escritura. Ver src/lib/emar-dia.ts.
                ...eMARdeHoy(),
            },
        }),
    ]);

    // Handovers faltantes hoy — DEUDA VIEJA, no es una decisión: está clavado
    // a 0, así que esta penalización (hasta −15) nunca se aplica en ninguna
    // sede. Antes se leía ShiftSchedule (modelo legacy, sin datos en prod) y
    // siempre daba 0; falta migrarla a ScheduledShift para saber cuántos
    // turnos debieron entregar. Mientras tanto la consulta de abajo se hace y
    // se tira: `todayHandoverAuthors` trae los que SÍ firmaron hoy, pero sin
    // los turnos esperados no hay resta que hacer.
    // Se deja como está a propósito: arreglarlo mueve la nota de Cupey y eso
    // es un cambio de medición aparte, no parte de "sede vacía no se puntúa".
    void todayHandoverAuthors;
    const missingHandovers = 0;

    // Compliance de meds del día (0–100%). null si hoy no se registró ninguna
    // dosis: sin denominador no hay porcentaje. No penaliza —igual que antes—
    // pero ya no dice "100%" donde no midió nada.
    const medCompliancePct: number | null = meds_total_today > 0
        ? (medsAdministeredToday / meds_total_today) * 100
        : null;

    // ── Cálculo de penalidades ─────────────────────────────────────
    const uppPenalty       = Math.min(activeUPPs * 3, 20);
    const fallPenalty      = Math.min(severeFalls * 5, 20);
    const complaintPenalty = Math.min(pendingComplaints * 2, 15);
    const handoverPenalty  = Math.min(missingHandovers * 5, 15);
    const medPenalty       = medCompliancePct !== null && medCompliancePct < 80
        ? Math.min((80 - medCompliancePct) * 0.5, 10)
        : 0;

    const totalDeduction = uppPenalty + fallPenalty + complaintPenalty + handoverPenalty + medPenalty;

    // ── Bonificación ───────────────────────────────────────────────
    const incidentBonus = incidentsLast7d === 0 ? 5 : 0;

    const raw = 100 - totalDeduction + incidentBonus;
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    const breakdown: FacilityHealthBreakdown = {
        residentesMatriculados,
        activeUPPs,
        uppPenalty:       Math.round(uppPenalty),
        severeFalls,
        fallPenalty,
        pendingComplaints,
        complaintPenalty,
        missingHandovers,
        handoverPenalty,
        medCompliancePct: medCompliancePct !== null ? Math.round(medCompliancePct) : null,
        medPenalty:       Math.round(medPenalty),
        incidentsLast7d,
        incidentBonus,
        totalDeduction:   Math.round(totalDeduction),
    };

    // Sin nadie matriculado no hay nada que puntuar. Se devuelve el desglose
    // igual —sus ceros son ciertos, y si quedara alguna UPP abierta de un
    // residente ya dado de alta, ahí sigue visible— pero sin nota ni grado:
    // la sede no está sana, está vacía. Es el único umbral; "pocas camas" o
    // "sede nueva" son decisiones de producto y no se inventan aquí.
    if (residentesMatriculados === 0) {
        return {
            score: null,
            grade: null,
            medible: false,
            // Sin "todavía": eso afirmaría que la sede es nueva, y este mismo
            // camino lo toma una sede que se vacía. El texto dice solo lo que
            // el dato sostiene. Se encadena detrás de "Salud operativa sin
            // medir:" (pantalla) y de "no se mide todavía —" (resumen de kpis).
            motivoNoMedible: 'sin residentes matriculados, no hay actividad clínica que medir',
            // El bonus de +5 por "cero incidentes en 7 días" se anula: en un
            // edificio sin residentes no es un mérito, es aritmética. Los
            // conteos medidos (incidentsLast7d, UPP, caídas) se quedan tal cual.
            breakdown: { ...breakdown, incidentBonus: 0 },
        };
    }

    return {
        score,
        grade: gradeFromScore(score),
        medible: true,
        motivoNoMedible: null,
        breakdown,
    };
}
