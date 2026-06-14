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

const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;

export type RedistributionTrigger = 'AUTO' | 'MANUAL' | 'ABSENCE';

export interface RedistributionOverride {
    id: string;
    patientId: string;
    patientName: string;
    originalColor: string;
    caregiverId: string;
    caregiverName: string;
}

export interface RedistributionResult {
    overridesCreated: RedistributionOverride[];
    vitalsCreated: number;
    /** Map: caregiverId → ["nombre paciente (grupo XYZ)", ...] para audit/responses */
    notifyByCaregiver: Map<string, string[]>;
    /** Cuántos pacientes ya estaban redistribuidos antes del intento */
    alreadyRedistributedCount: number;
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
     * SPRINT MULTI-FLOOR (jun-2026): acota el cómputo a un piso. Sin floor →
     * comportamiento legacy HQ-wide preservado para callers que aún no fueron
     * refactoreados (consumer #7 redistribute + uncovered-colors). Caller
     * claim-coverage (consumer #6) lo pasa scoped al piso de la cuidadora →
     * orphans se reparten DENTRO de ese piso, sin fuga cross-piso.
     */
    floor?: number;
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
        trigger,
        createVitalsOrders = true,
        notify = true,
    } = opts;

    // computeShiftCoverage acepta floor opcional (consumer #0 core). Cuando se
    // pasa, todas las queries internas (active sessions, overrides, uncovered
    // patients, recipients) quedan piso-scoped por construcción.
    const coverage = await computeShiftCoverage({ hqId, shiftType, floor });

    // Pacientes objetivo
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
            coverage,
        };
    }

    const recipients = coverage.activeCaregivers.filter(c => c.color);
    if (recipients.length === 0) {
        return {
            overridesCreated: [],
            vitalsCreated: 0,
            notifyByCaregiver: new Map(),
            alreadyRedistributedCount,
            coverage,
            error: {
                status: 400,
                message: 'No hay cuidadores en piso con color asignado — imposible redistribuir',
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

        overridesCreated.push({
            id: override.id,
            patientId: patient.patientId,
            patientName: patient.name,
            originalColor: patient.colorGroup,
            caregiverId: recipient.userId,
            caregiverName: recipient.name,
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
        try {
            const colorsSummary = Array.from(new Set(overridesCreated.map(o => o.originalColor))).join(', ');
            await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'EMAR_ALERT',
                title: `Redistribución (${trigger})`,
                message: `${overridesCreated.length} residentes de ${colorsSummary} distribuidos entre ${notifyByCaregiver.size} cuidadores.`,
                link: '/care/supervisor',
            });
        } catch (e) {
            logWarn('shift_redistribute.notify_supervision', e, { hqId, count: overridesCreated.length });
        }
    }

    return {
        overridesCreated,
        vitalsCreated,
        notifyByCaregiver,
        alreadyRedistributedCount,
        coverage,
    };
}
