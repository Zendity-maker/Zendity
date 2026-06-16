import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/nursing/rotation
 *
 * Dashboard de rotación postural / UPP para enfermería.
 *
 * Enrolled (UNIÓN, ninguno se escapa):
 *   - `requiresPosturalChanges=true`  (flag explícito clínico — fuente PRIMARIA)
 *   - `nortonRisk=true`                (escala Norton)
 *   - PressureUlcer activa             (status != RESOLVED)
 *
 * El cron `/api/cron/upp-alerts` hoy usa solo nortonRisk OR ulcer. Cuando
 * Cupey marque su grupo RED encamado con requiresPosturalChanges, esos
 * pacientes entrarán al dashboard pero NO al cron hasta que el cron también
 * incluya el flag — follow-up separado.
 *
 * Tier de compliance — computado desde TIMESTAMPS en read time, NO desde el
 * flag `PosturalChangeLog.isComplianceAlert` (un write path no lo setea,
 * /api/care/rounds type=ROTACION pone hardcoded false → flag inservible
 * como source of truth).
 *
 * Umbrales canónicos del módulo de scoring (/api/care/postural):
 *   - target:  120 min  (objetivo clínico)
 *   - breach:  135 min  (15 min tolerancia legal — pasa de aquí: incidente)
 *
 * Tiers:
 *   - OK:      lastRotation existe Y minutesSince ≤ 120
 *   - DUE:     lastRotation existe Y 120 < minutesSince ≤ 135  (zona ventana)
 *   - OVERDUE: lastRotation existe Y minutesSince > 135        (vencido)
 *   - NEVER:   no hay PosturalChangeLog para el paciente
 *
 * NOTA — Inconsistencia conocida cron-vs-postural (follow-up):
 *   `/api/cron/upp-alerts` usa umbral plano 2h (120 min) sin la tolerancia de
 *   15 min. Eso fuerza notificaciones falsas en la ventana 120–135 (que aún
 *   está dentro de tolerancia legal). El endpoint usa los umbrales canónicos
 *   del módulo de scoring. Reconciliar en pieza separada (no en este sprint).
 *
 * Multi-tenant: hqId del session.user. Scoped strict.
 * Roles: NURSE / SUPERVISOR / DIRECTOR / ADMIN.
 */

const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const TARGET_MIN = 120;
const BREACH_MIN = 135;

type Tier = 'OK' | 'DUE' | 'OVERDUE' | 'NEVER';

function classify(minutesSince: number | null): Tier {
    if (minutesSince === null) return 'NEVER';
    if (minutesSince <= TARGET_MIN) return 'OK';
    if (minutesSince <= BREACH_MIN) return 'DUE';
    return 'OVERDUE';
}

export async function GET(_req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const now = new Date();

        // Enrolled = UNIÓN de 3 señales:
        //   1. requiresPosturalChanges=true  (flag clínico explícito)
        //   2. nortonRisk=true
        //   3. PressureUlcer activa (status != RESOLVED)
        // Ninguno se escapa. status filtra DISCHARGED/DECEASED (fix 31-may del cron).
        const enrolledPatients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
                OR: [
                    { requiresPosturalChanges: true },
                    { nortonRisk: true },
                    { pressureUlcers: { some: { status: { not: 'RESOLVED' } } } },
                ],
            },
            select: {
                id: true,
                name: true,
                roomNumber: true,
                requiresPosturalChanges: true,
                nortonRisk: true,
                status: true,
                posturalChanges: {
                    orderBy: { performedAt: 'desc' },
                    take: 1,
                    select: {
                        performedAt: true,
                        position: true,
                        nurse: { select: { id: true, name: true } },
                    },
                },
                pressureUlcers: {
                    where: { status: { not: 'RESOLVED' } },
                    orderBy: [{ stage: 'desc' }, { identifiedAt: 'asc' }],
                    select: {
                        id: true,
                        bodyLocation: true,
                        stage: true,
                        status: true,
                        identifiedAt: true,
                    },
                },
            },
            orderBy: [{ roomNumber: 'asc' }, { name: 'asc' }],
        });

        const patients = enrolledPatients.map((p) => {
            const last = p.posturalChanges[0] ?? null;
            const minutesSince = last
                ? Math.floor((now.getTime() - last.performedAt.getTime()) / 60000)
                : null;
            const tier = classify(minutesSince);
            // Por qué entró al set (útil para tooltip "enrolled by:" en UI)
            const enrolledBy = {
                flag: p.requiresPosturalChanges,
                norton: p.nortonRisk,
                ulcer: p.pressureUlcers.length > 0,
            };
            return {
                patientId: p.id,
                name: p.name,
                roomNumber: p.roomNumber,
                status: p.status,
                requiresPosturalChanges: p.requiresPosturalChanges,
                nortonRisk: p.nortonRisk,
                enrolledBy,
                activeUlcers: p.pressureUlcers,
                lastRotation: last
                    ? {
                          performedAt: last.performedAt,
                          position: last.position,
                          nurseId: last.nurse?.id ?? null,
                          nurseName: last.nurse?.name ?? null,
                      }
                    : null,
                minutesSince,
                tier,
            };
        });

        // Counts por tier (útil para chips agregados en el header del dashboard).
        const counts: Record<Tier, number> = { OK: 0, DUE: 0, OVERDUE: 0, NEVER: 0 };
        for (const p of patients) counts[p.tier]++;

        return NextResponse.json({
            success: true,
            generatedAt: now.toISOString(),
            hqId,
            thresholdsMin: { target: TARGET_MIN, breach: BREACH_MIN },
            counts,
            total: patients.length,
            patients,
        });
    } catch (err: any) {
        console.error('[care/nursing/rotation] error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Error generando dashboard de rotación' },
            { status: 500 }
        );
    }
}
