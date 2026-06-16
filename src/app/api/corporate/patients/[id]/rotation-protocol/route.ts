import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { assertPatientInTenant } from '@/lib/patient-tenant';
import { SystemAuditAction } from '@prisma/client';

/**
 * PATCH /api/corporate/patients/[id]/rotation-protocol
 *
 * Toggle dedicado del campo Patient.requiresPosturalChanges. Endpoint propio
 * (no extender el PUT genérico) porque este flag dispara cambios materiales
 * de protocolo clínico:
 *
 *   1. Grid de rotación en /care/page.tsx ("Protocolo UPP Fase Dual") —
 *      sale "Vigilancia Dermatológica", entra grid de 3 botones que escribe
 *      a /api/care/postural.
 *   2. Dashboard /care/nursing — paciente entra al enrolled set con badge
 *      "Encamado" (vía requiresPosturalChanges true).
 *   3. Cron /api/cron/upp-alerts — push URGENTE cada 2h si lleva > 2h sin
 *      rotación. (Push cesa al volver a false SIEMPRE QUE el paciente no
 *      esté enrolado por otra señal: nortonRisk o úlcera activa.)
 *
 * Por eso:
 *   - Contrato exige `confirmed: true` en el body (defensa en profundidad
 *     contra el modal del front — no se puede saltar via curl sin intención
 *     explícita).
 *   - Audit row con action PATIENT_PROTOCOL_CHANGED, NO un PATIENT_UPDATED
 *     genérico. El director ve quién prendió/apagó protocolo de ESTE
 *     residente en /corporate/audit.
 *   - Roles: SUPERVISOR / DIRECTOR / ADMIN / NURSE. CAREGIVER NO — protocolo
 *     lo decide el clínico, no la cuidadora de turno. SUPERVISOR incluido a
 *     propósito para cobertura nocturna (cuando el enfermero no está y
 *     alguien puede volverse encamado en turno).
 *
 * Body: { requiresPosturalChanges: boolean, confirmed: true }
 *
 * Response: { success, patient: { id, requiresPosturalChanges }, audit: { id } }
 *
 * Errores:
 *   400 — body inválido / `confirmed` no es true / `requiresPosturalChanges`
 *         no es boolean
 *   403 — rol no autorizado / paciente fuera de la sede del invocador
 *   404 — paciente no existe
 *
 * Idempotencia: si `requiresPosturalChanges` ya es el valor solicitado,
 * el endpoint retorna 200 con `{ success: true, changed: false }` y NO
 * crea audit row (la doble-prensa del botón no debe contaminar el log).
 */

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

async function patchHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;
        const invokerId = auth.id;

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const { requiresPosturalChanges, confirmed } = body as {
            requiresPosturalChanges?: unknown;
            confirmed?: unknown;
        };

        // Validación del contrato — confirmed:true OBLIGATORIO (defensa
        // backend, no solo del modal del front).
        if (confirmed !== true) {
            return NextResponse.json(
                { success: false, error: 'Falta confirmación explícita del cambio de protocolo (confirmed:true)' },
                { status: 400 },
            );
        }
        if (typeof requiresPosturalChanges !== 'boolean') {
            return NextResponse.json(
                { success: false, error: 'requiresPosturalChanges debe ser boolean' },
                { status: 400 },
            );
        }

        // Tenant + existencia
        const patientRaw = await prisma.patient.findUnique({
            where: { id },
            select: { id: true, name: true, headquartersId: true, requiresPosturalChanges: true },
        });
        const patient = assertPatientInTenant(patientRaw, invokerHqId);
        if (patient instanceof NextResponse) return patient;

        // Idempotencia: mismo valor → 200 + changed:false, SIN audit row.
        // Una doble-prensa del botón (click rápido del usuario, retry del
        // cliente) no debe inflar el audit log. Solo cambios reales se
        // auditan.
        if (patient.requiresPosturalChanges === requiresPosturalChanges) {
            return NextResponse.json({
                success: true,
                changed: false,
                patient: { id: patient.id, requiresPosturalChanges },
            });
        }

        // Tx: update + audit atómicos
        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.patient.update({
                where: { id },
                data: { requiresPosturalChanges },
                select: { id: true, requiresPosturalChanges: true },
            });
            const audit = await tx.systemAuditLog.create({
                data: {
                    headquartersId: invokerHqId,
                    entityName: 'Patient',
                    entityId: id,
                    action: SystemAuditAction.PATIENT_PROTOCOL_CHANGED,
                    performedById: invokerId,
                    payloadChanges: {
                        protocol: 'rotation',
                        field: 'requiresPosturalChanges',
                        before: patient.requiresPosturalChanges,
                        after: requiresPosturalChanges,
                        patientName: patient.name,
                        operatorRole: auth.role,
                    },
                },
                select: { id: true },
            });
            return { updated, audit };
        });

        return NextResponse.json({
            success: true,
            changed: true,
            patient: result.updated,
            audit: result.audit,
        });
    } catch (error: any) {
        console.error('[rotation-protocol PATCH] error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error procesando cambio de protocolo' },
            { status: 500 },
        );
    }
}

// PHI audit (Pilar 1) — escritura sobre el expediente del residente.
export const PATCH = withPhiAccessLog(patchHandler, {
    resourceType: 'Patient',
    getPatientId: async ({ params }) => (await params).id,
});
