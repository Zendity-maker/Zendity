/**
 * Helper unificado de redistribución de residentes por ausencia/cobertura.
 *
 * Centraliza el patrón común entre 3 endpoints:
 *   - /api/care/shift/redistribute  (canónico — AUTO por cron + MANUAL)
 *   - /api/care/supervisor/uncovered-colors POST (botón del supervisor por color)
 *   - /api/hr/schedule/absent (marca ausente desde Builder y redistribuye)
 *
 * Reglas:
 *   - Usa computeShiftCoverage como fuente de verdad (excluye pacientes con
 *     override activo → idempotente).
 *   - Si se pasa `color`, sólo procesa pacientes de ese color sin cobertura.
 *   - Round-robin sobre cuidadoras activas con color base (mantiene su color
 *     y recibe residentes extra vía override — NO crea ShiftColorAssignment).
 *   - Check de duplicado per-paciente como red de seguridad (concurrency).
 *   - VitalsOrders se crean si el receptor está dentro de su ventana 4h.
 *   - Notificaciones a receptores + supervisor (best-effort, no rompen el flujo).
 *
 * El audit log queda en manos del caller (cada endpoint tiene su propio
 * payload de auditoría con metadata distinta).
 */

import { prisma } from './prisma';
import { computeShiftCoverage, type ShiftT } from './shift-coverage';
import { todayStartAST } from './dates';
import { notifyUser, notifyRoles } from './notifications';
import { logWarn } from './logger';
import { floorLabel } from './floor';

const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;

export type RedistributionTrigger = 'AUTO' | 'MANUAL' | 'ABSENCE';

export interface RedistributionOverride {
    id: string;
    patientId: string;
    patientName: string;
    originalColor: string;
    caregiverId: string;
    caregiverName: string;
    /**
     * Multi-floor (jun-2026): true si el override es cross-piso (la cuidadora
     * receptora tiene floor distinto al del residente). Usado para auditoría
     * y framing STOPGAP en la notificación del supervisor.
     */
    crossFloor: boolean;
    patientFloor: number | null;
    caregiverFloor: number | null;
}

export interface RedistributionResult {
    overridesCreated: RedistributionOverride[];
    vitalsCreated: number;
    /** Map: caregiverId → ["nombre paciente (grupo XYZ)", ...] para audit/responses */
    notifyByCaregiver: Map<string, string[]>;
    /** Cuántos pacientes ya estaban redistribuidos antes del intento */
    alreadyRedistributedCount: number;
    /**
     * Multi-floor (jun-2026): cuántos de los overrides creados son cross-piso.
     * Cuando > 0, el endpoint debería usar framing STOPGAP en la notificación
     * al supervisor (las cuidadoras receptoras quedan estiradas en 2 pisos).
     */
    crossFloorCount: number;
    /**
     * Multi-floor (jun-2026): cuidadoras que recibieron overrides cross-piso.
     * Para el mensaje del supervisor: "los 7 piso 1 repartidos entre
     * {stretched.join(', ')} — TODAS estiradas, evalúa refuerzo".
     */
    stretchedCaregivers: string[];
    coverage: Awaited<ReturnType<typeof computeShiftCoverage>>;
    /** Error de negocio (no excepción). Caller decide qué status retornar. */
    error?: { status: number; message: string };
}

export async function redistributeUncoveredColors(opts: {
    hqId: string;
    shiftType: ShiftT;
    /** Si se pasa, sólo procesa pacientes de ese color. Si no, todos los uncovered. */
    color?: string;
    /**
     * SPRINT MULTI-FLOOR (jun-2026): acota los target patients a un piso.
     *   - Sin floor → comportamiento legacy HQ-wide.
     *   - Con floor → uncovered patients filtrados a ese piso (Mari1 ausente
     *     piso 1 → solo target patients de piso 1).
     */
    floor?: number;
    /**
     * SPRINT MULTI-FLOOR (jun-2026): cuando true, los CANDIDATES (cuidadoras
     * receptoras) se buscan HQ-wide, no solo en el piso scoped. Permite el
     * patrón #4/#3 de cross-piso supervisado: target patients del piso N,
     * pero recipients de cualquier piso para que la redistribución reparta
     * cross-piso con flag explícito. Cada override marcado con crossFloor.
     *
     * Solo aplica si floor también está especificado (cross-piso sin scope
     * de target no tiene sentido — sería HQ-wide normal).
     *
     * Default: false (same-floor estricto — los candidates de otro piso NO
     * entran). Usado por #7 endpoints SOLO bajo flag supervisor.
     */
    allowCrossFloorCandidates?: boolean;
    trigger: RedistributionTrigger;
    /** Si true (default), crea VitalsOrder de 4h para los residentes nuevos del receptor */
    createVitalsOrders?: boolean;
    /** Si true (default), notifica a receptores y supervisión */
    notify?: boolean;
}): Promise<RedistributionResult> {
    const {
        hqId,
        shiftType,
        color,
        floor,
        allowCrossFloorCandidates = false,
        trigger,
        createVitalsOrders = true,
        notify = true,
    } = opts;

    // ── Dual-coverage cuando aplica cross-piso ─────────────────────────────
    // Target patients SIEMPRE scoped al piso pedido (si hay). Candidates
    // (active caregivers con color) expanden HQ-wide solo si:
    //   1. floor está especificado (sino "cross-piso" no tiene sentido), Y
    //   2. allowCrossFloorCandidates=true (el endpoint pidió expandir).
    //
    // Esto da el patrón "target piso 1, candidates HQ-wide" sin contaminar
    // el cómputo de target patients (siguen siendo solo del piso target).
    const coverage = await computeShiftCoverage({ hqId, shiftType, floor });
    const useCrossFloorCandidates =
        floor !== undefined && allowCrossFloorCandidates === true;
    const recipientCoverage = useCrossFloorCandidates
        ? await computeShiftCoverage({ hqId, shiftType }) // HQ-wide para candidates
        : coverage;

    // Pacientes objetivo (siempre scoped al piso si floor está especificado).
    const targetPatients = color
        ? coverage.uncoveredPatients.filter(p => p.colorGroup === color)
        : coverage.uncoveredPatients;

    const alreadyRedistributedCount = color
        ? coverage.activeOverrides.filter(o => o.originalColor === color).length
        : coverage.activeOverrides.length;

    if (targetPatients.length === 0) {
        return {
            overridesCreated: [],
            vitalsCreated: 0,
            notifyByCaregiver: new Map(),
            alreadyRedistributedCount,
            crossFloorCount: 0,
            stretchedCaregivers: [],
            coverage,
        };
    }

    // Recipients: del `recipientCoverage` (que es coverage scoped si default,
    // o coverage HQ-wide si allowCrossFloorCandidates).
    const recipients = recipientCoverage.activeCaregivers.filter(c => c.color);
    if (recipients.length === 0) {
        return {
            overridesCreated: [],
            vitalsCreated: 0,
            notifyByCaregiver: new Map(),
            alreadyRedistributedCount,
            crossFloorCount: 0,
            stretchedCaregivers: [],
            coverage,
            error: {
                status: 400,
                // El caller (cron #2 o endpoint #3) interpreta este mensaje
                // como "no candidates en este piso". Cron #2 lo convierte en
                // notificación URGENTE al supervisor para acción humana
                // (break-glass). Endpoint #3 lo retorna como 422 "requiere
                // allowCrossFloorCandidates=true".
                message: useCrossFloorCandidates
                    ? 'No hay cuidadores activos con color en ninguna sede — imposible redistribuir'
                    : 'No hay cuidadores en piso con color asignado — imposible redistribuir',
            },
        };
    }

    const now = new Date();
    const shiftDate = todayStartAST();
    const dayEnd = new Date(shiftDate.getTime() + 24 * 3600000);

    const overridesCreated: RedistributionOverride[] = [];
    let vitalsCreated = 0;
    const notifyByCaregiver = new Map<string, string[]>();

    const reasonValue = trigger === 'MANUAL' ? 'MANUAL' : 'ABSENCE_REDISTRIB';
    const autoAssignedFlag = trigger === 'AUTO';

    for (let i = 0; i < targetPatients.length; i++) {
        const patient = targetPatients[i];
        const recipient = recipients[i % recipients.length];

        // Idempotencia: por si concurrencia entre el computeShiftCoverage y este insert.
        const existing = await prisma.shiftPatientOverride.findFirst({
            where: {
                patientId: patient.patientId,
                shiftDate: { gte: shiftDate, lt: dayEnd },
                shiftType,
                isActive: true,
            },
            select: { id: true },
        });
        if (existing) continue;

        const override = await prisma.shiftPatientOverride.create({
            data: {
                headquartersId: hqId,
                patientId: patient.patientId,
                originalColor: patient.colorGroup,
                assignedColor: recipient.color || patient.colorGroup,
                caregiverId: recipient.userId,
                shiftDate,
                shiftType,
                reason: reasonValue,
                autoAssigned: autoAssignedFlag,
                isActive: true,
            },
        });

        // Multi-floor (jun-2026): marcar si este override es cross-piso.
        // Si patient.floor o recipient.floor son null (data anomaly o manager),
        // crossFloor=false (no podemos afirmar cross con data incierta — la
        // anomalía se surfacea via groupByFloor 'unassigned' del wall).
        const isCrossFloor =
            patient.floor !== null &&
            recipient.floor !== null &&
            patient.floor !== recipient.floor;
        overridesCreated.push({
            id: override.id,
            patientId: patient.patientId,
            patientName: patient.name,
            originalColor: patient.colorGroup,
            caregiverId: recipient.userId,
            caregiverName: recipient.name,
            crossFloor: isCrossFloor,
            patientFloor: patient.floor,
            caregiverFloor: recipient.floor,
        });

        if (createVitalsOrders) {
            const vitalsExpiresAt = new Date(recipient.startTime.getTime() + VITALS_WINDOW_MS);
            if (vitalsExpiresAt > now) {
                const existingVital = await prisma.vitalsOrder.findFirst({
                    where: {
                        patientId: patient.patientId,
                        shiftSessionId: recipient.shiftSessionId,
                        status: 'PENDING',
                    },
                    select: { id: true },
                });
                if (!existingVital) {
                    await prisma.vitalsOrder.create({
                        data: {
                            headquartersId: hqId,
                            patientId: patient.patientId,
                            orderedById: recipient.userId,
                            caregiverId: recipient.userId,
                            reason: 'Vitales de entrada — redistribución por ausencia',
                            orderedAt: now,
                            expiresAt: vitalsExpiresAt,
                            status: 'PENDING',
                            autoCreated: true,
                            shiftSessionId: recipient.shiftSessionId,
                            penaltyApplied: false,
                        },
                    });
                    vitalsCreated++;
                }
            }
        }

        if (!notifyByCaregiver.has(recipient.userId)) notifyByCaregiver.set(recipient.userId, []);
        notifyByCaregiver.get(recipient.userId)!.push(`${patient.name} (grupo ${patient.colorGroup})`);
    }

    if (notify && overridesCreated.length > 0) {
        // Notificar receptores (best-effort).
        // link='/care' → cuidadoras van a su tablet donde ven los residentes nuevos.
        for (const [caregiverId, patientLines] of notifyByCaregiver.entries()) {
            try {
                await notifyUser(caregiverId, {
                    type: 'EMAR_ALERT',
                    title: `Residentes redistribuidos (${patientLines.length})`,
                    message: `Recibes ${patientLines.length === 1 ? 'a' : 'a los siguientes residentes'} por ausencia del cuidador asignado: ${patientLines.join(', ')}. Revisa sus tarjetas en el tablet.`,
                    link: '/care',
                });
            } catch (e) {
                logWarn('shift_redistribute.notify_user', e, { caregiverId, count: patientLines.length });
            }
        }

        // Notificar supervisión (agregado).
        // link='/care/supervisor' → panel de supervisión donde ven la cobertura.
        //
        // Multi-floor (jun-2026): si hay overrides cross-piso (crossFloorCount > 0)
        // el mensaje cambia a framing STOPGAP — transmite que las receptoras
        // están ESTIRADAS en dos pisos, NO que "todo está cubierto". El
        // supervisor debe saber que es parche, no resolución, y considerar
        // refuerzo. Match con la decisión de política C (consumer #6) y la
        // calibración del recon #7: cross-piso siempre se framea como STOPGAP
        // urgente; same-floor permanece informativo.
        try {
            const colorsSummary = Array.from(new Set(overridesCreated.map(o => o.originalColor))).join(', ');
            const crossFloorOverrides = overridesCreated.filter(o => o.crossFloor);
            const crossFloorCount = crossFloorOverrides.length;
            const stretchedSet = new Set(crossFloorOverrides.map(o => o.caregiverName));

            if (crossFloorCount > 0 && floor !== undefined) {
                // STOPGAP framing — al menos parte de la redistribución cruzó piso.
                await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                    type: 'EMAR_ALERT',
                    title: `🚨 BREAK-GLASS — ${crossFloorCount} residentes ${floorLabel(floor)} cubiertos cross-piso`,
                    message: `${crossFloorCount} de los ${overridesCreated.length} residentes redistribuidos quedaron cross-piso, ` +
                        `repartidos entre ${stretchedSet.size} cuidadora(s) de otros pisos: ${[...stretchedSet].join(', ')}. ` +
                        `TODAS están ahora ESTIRADAS en dos pisos. La cobertura cruzada es STOPGAP, no resolución — ` +
                        `evalúa mandar refuerzo a ${floorLabel(floor)} o redistribuir la carga.`,
                    link: '/care/supervisor',
                });
            } else {
                // Framing legacy — same-floor, informativo.
                const floorTag = floor !== undefined ? ` (${floorLabel(floor)})` : '';
                await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                    type: 'EMAR_ALERT',
                    title: `Redistribución (${trigger})${floorTag}`,
                    message: `${overridesCreated.length} residentes de ${colorsSummary} distribuidos entre ${notifyByCaregiver.size} cuidadores${floorTag}.`,
                    link: '/care/supervisor',
                });
            }
        } catch (e) {
            logWarn('shift_redistribute.notify_supervision', e, { hqId, count: overridesCreated.length });
        }
    }

    // Multi-floor (jun-2026): retornar conteo cross-piso + cuidadoras estiradas
    // para que el endpoint pueda usar en su audit log + response.
    const crossFloorList = overridesCreated.filter(o => o.crossFloor);
    return {
        overridesCreated,
        vitalsCreated,
        notifyByCaregiver,
        alreadyRedistributedCount,
        crossFloorCount: crossFloorList.length,
        stretchedCaregivers: [...new Set(crossFloorList.map(o => o.caregiverName))],
        coverage,
    };
}
