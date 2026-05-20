/**
 * logAudit — Helper para escribir en SystemAuditLog de forma no-fatal.
 *
 * Garantía: si el logging falla, la operación principal del llamador
 * NO se interrumpe. El error se registra en console.error únicamente.
 *
 * Uso:
 *   await logAudit({
 *     headquartersId: hqId,
 *     performedById: session.user.id,
 *     action: 'MEDICATION_ADMINISTERED',
 *     entityName: 'PatientMedication',
 *     entityId: patientMedicationId,
 *     resourceName: 'Metformina 500mg — Carmen Rivera',
 *     payloadChanges: { status: 'ADMINISTERED', notes },
 *     request,
 *   });
 */

import { prisma } from '@/lib/prisma';
import { Prisma, SystemAuditAction } from '@prisma/client';

interface LogAuditParams {
    headquartersId: string;
    performedById?: string;
    action: SystemAuditAction;
    entityName: string;
    entityId: string;
    /** Nombre legible para mostrar en la UI (ej: "Metformina — Carmen Rivera") */
    resourceName?: string;
    /** Diff o contexto relevante del cambio */
    payloadChanges?: Record<string, unknown>;
    /** Request HTTP para extraer IP (opcional) */
    request?: Request;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
    const {
        headquartersId,
        performedById,
        action,
        entityName,
        entityId,
        resourceName,
        payloadChanges,
        request,
    } = params;

    const clientIp = request
        ? (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown')
        : undefined;

    try {
        await prisma.systemAuditLog.create({
            data: {
                headquartersId,
                performedById: performedById ?? null,
                action,
                entityName,
                entityId,
                // Inyectamos resourceName dentro de payloadChanges para no romper el schema existente
                payloadChanges: (resourceName || payloadChanges)
                    ? ({ resourceName, ...payloadChanges } as Prisma.InputJsonValue)
                    : Prisma.DbNull,
                clientIp: clientIp ?? null,
            },
        });
    } catch (err) {
        // Non-fatal: nunca interrumpir la operación principal por un fallo de auditoría
        console.error('[AUDIT_LOG_FAIL]', { action, entityName, entityId, err });
    }
}
