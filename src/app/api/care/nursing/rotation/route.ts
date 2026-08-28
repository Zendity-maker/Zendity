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

type Tier = 'OK' | 'DUE' | 'OVERDUE' | 'NEVER' | 'FUERA' | 'SIN_ORDEN';

/**
 * FUERA: el residente no esta en el edificio.
 *
 * Estaba contando las horas de hospital como rotaciones vencidas. Jose A.
 * Troche llevaba 41 h "sin girar" ingresado desde el 26-ago: el panel pedia
 * girar a alguien que no esta aqui, y esa alerta no se puede bajar haciendo
 * nada. Un contador que no puede bajar deja de mirarse, y con el se dejan de
 * mirar los que si son reales.
 *
 * No se le quita el enrolamiento: sigue en la lista, visible, con su motivo.
 * Al volver a ACTIVE reentra al conteo y —como su ultima rotacion es vieja—
 * sale como pendiente de inmediato, que es justo lo correcto.
 */
/**
 * SIN_ORDEN: enrolado UNICAMENTE por nortonRisk.
 *
 * Norton es una ESCALA DE RIESGO, no una orden de rotacion. Dice que la
 * persona tiene riesgo de ulcera; no dice que haya que girarla cada dos horas.
 * Teresa Rivera esta en silla de ruedas y se moviliza sola: su alivio de
 * presion lo hace ella, la intervencion es un cojin, no una cuidadora
 * volteandola. Aun asi el OR del enrolamiento la metia como tarea vencida.
 *
 * Peor: no habia forma de sacarla. El toggle de rotation-protocol pone
 * requiresPosturalChanges en false, pero nortonRisk sigue en true y el OR la
 * vuelve a meter. Otro contador que no puede bajar.
 *
 * Ahora sale visible pero fuera del conteo, esperando que enfermeria confirme
 * con el toggle quien necesita rotacion de verdad. No se borra a nadie: quitar
 * Norton del enrolamiento sacaria a cinco residentes de golpe, y esa es
 * decision clinica, no de este endpoint.
 */
function classify(minutesSince: number | null, fuera: boolean, sinOrden: boolean): Tier {
    if (fuera) return 'FUERA';
    if (sinOrden) return 'SIN_ORDEN';
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
                leaveType: true,
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
            const fuera = p.status === 'TEMPORARY_LEAVE';
            // Solo Norton: ni orden clinica explicita ni ulcera activa.
            const sinOrden = p.nortonRisk
                && !p.requiresPosturalChanges
                && p.pressureUlcers.length === 0;
            const tier = classify(minutesSince, fuera, sinOrden);
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
                // Fuera del edificio no se reportan minutos acumulados: el
                // numero solo servia para pintar de rojo una espera que nadie
                // puede atender.
                minutesSince: (fuera || sinOrden) ? null : minutesSince,
                tier,
                fuera,
                sinOrden,
                motivoFuera: fuera ? (p.leaveType ?? 'AUSENTE') : null,
            };
        });

        // Counts por tier (útil para chips agregados en el header del dashboard).
        const counts: Record<Tier, number> = { OK: 0, DUE: 0, OVERDUE: 0, NEVER: 0, FUERA: 0, SIN_ORDEN: 0 };
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
