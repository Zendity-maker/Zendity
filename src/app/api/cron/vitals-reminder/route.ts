import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import { applyScoreEvent } from '@/lib/score-event';
import { PENALTY_GRACE_MS } from '@/lib/vitals-window';
import { sinServicio } from '@/lib/ventanas-sin-servicio';
import { MOTIVO_OBSERVACION, OBSERVACION_MIN, esOrdenDeObservacion } from '@/lib/observacion-vitales';

export const dynamic = 'force-dynamic';

// Sprint O — Cap diario de penalidades por cuidador para evitar DoS
// reputacional (−30+ pts en 1 segundo cuando un turno no alcanzó a tomar
// vitales a 15 residentes). Máximo 5 penalidades/día = −10 pts máx.
const DAILY_PENALTY_CAP = 5;

/**
 * LA PENALIDAD, APAGADA. El aviso, encendido.
 *
 * Este cron nunca estuvo programado en vercel.json, así que hace tres cosas de
 * las que solo una faltaba de verdad: recordar 20 minutos antes, marcar
 * vencidas, y restar puntos. Las órdenes YA se vencen solas al cerrar turno
 * —6 337 así en producción— o sea que lo único que hacía falta era el aviso.
 *
 * No se enciende el castigo, por lo mismo que se apagó el de omitir un
 * medicamento el 05-sep-2026: penalizar el registro de un hueco enseña a no
 * registrarlo. En 24 537 administraciones había TRES omisiones, y no porque no
 * se omita. Y aquí la asimetría es peor todavía: 280 órdenes vencieron en una
 * semana, casi todas por falta de manos, no por descuido — restarle puntos a
 * quien estaba solo con quince residentes no cambia que estaba solo.
 *
 * El aviso sí queda: quien no las tomó se entera, y supervisión también. Ahí
 * está la información; lo que sobra es el precio.
 *
 * Hacer el dato veraz, no crear una métrica que castigue la conducta.
 */
const APLICAR_PENALIDAD = false;

// La gracia vive en src/lib/vitals-window.ts, junto al plazo que modifica.

// Cron cada 5 min:
//  A. Recuerda al cuidador si una orden pendiente vence en ~20 min.
//  B. Marca EXPIRED las vencidas sin completar.
//  C. Sprint J: aplica -2 puntos al cuidador por cada VitalsOrder autoCreada
//     que expiró sin completarse, una vez pasada la gracia (ver arriba).
export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no configurado en entorno' }, { status: 500 });
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON Inválida' }, { status: 401 });
    }

    try {
        const now = new Date();
        const windowStart = new Date(now.getTime() + 15 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 25 * 60 * 1000);

        // ── A. Recordatorio preventivo 20 min antes ──
        const dueOrders = await prisma.vitalsOrder.findMany({
            where: {
                status: 'PENDING',
                reminderSentAt: null,
                expiresAt: { gte: windowStart, lte: windowEnd }
            },
            include: {
                patient: { select: { name: true } }
            }
        });

        let reminded = 0;
        for (const order of dueOrders) {
            // La misma tabla lleva dos obligaciones distintas desde el
            // 22-sep-2026: la ventana de entrada al turno (4 h) y la revisión
            // del protocolo de observación (45 min). Llamarlas igual en el
            // aviso haría que la urgente se leyera como la rutinaria.
            const esRevision = esOrdenDeObservacion(order.reason);
            const hora = order.expiresAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico' });
            const title = esRevision ? "Revisión de observación por vencer" : "Vitales por vencer (20 min)";
            const msg = esRevision
                ? `La revisión de ${order.patient.name} vence a las ${hora}. Vuelve a tomarle los vitales.`
                : `La ventana de vitales de ${order.patient.name} vence a las ${hora}. Tómalos cuanto antes.`;

            if (order.caregiverId) {
                await notifyUser(order.caregiverId, { type: 'EMAR_ALERT', title, message: msg, link: '/care/vitals' });
            } else {
                await notifyRoles(order.headquartersId, ['CAREGIVER'], { type: 'EMAR_ALERT', title, message: msg, link: '/care/vitals' });
            }

            await prisma.vitalsOrder.update({
                where: { id: order.id },
                data: { reminderSentAt: now }
            });
            reminded++;
        }

        /**
         * ── A-bis. LA REVISIÓN DE 45 MINUTOS QUE VENCIÓ SIN HACERSE ──
         *
         * Esto es lo que no existía. Hasta el 22-sep-2026 el protocolo de
         * observación le anunciaba a la cuidadora una revisión obligatoria y
         * después no la vigilaba nadie: de 578 anunciadas, 46 se hicieron
         * dentro del plazo (8 %) y 8 no se hicieron nunca. Ese mismo día, a
         * las 18:11, había tres vencidas y sin revisar —171, 75 y 71 minutos—
         * y ni una sola pantalla lo decía.
         *
         * Se escribe EXPIRED antes de avisar, y por eso el aviso sale UNA vez:
         * en la pasada siguiente la orden ya no está PENDING y no vuelve a
         * entrar. Es la misma idempotencia que da el compare-and-swap del
         * cierre de turno, sin necesidad de una bandera nueva.
         *
         * NO hay penalidad, ni aquí ni en el bloque C —que filtra
         * `autoCreated: true` y deja estas fuera por construcción—. Avisar de
         * que falta una revisión es información; cobrarla enseñaría a no
         * registrar los vitales que la disparan.
         */
        const revisionesVencidas = await prisma.vitalsOrder.findMany({
            where: {
                status: 'PENDING',
                reason: MOTIVO_OBSERVACION,
                completedAt: null,
                expiresAt: { lt: now },
            },
            include: {
                patient: { select: { name: true, status: true } },
                caregiver: { select: { id: true, name: true, isActive: true, isDeleted: true } },
            },
        });
        let revisionesEscaladas = 0;
        let revisionesSinAvisar = 0;
        for (const o of revisionesVencidas) {
            // Primero se cierra la puerta, luego se avisa.
            await prisma.vitalsOrder.update({
                where: { id: o.id },
                data: { status: 'EXPIRED' },
            });

            /**
             * A quien ya no está no se le pide trabajo. Una revisión vencida
             * de alguien dado de alta o fallecido se vence igual —el dato
             * queda— pero no manda a nadie a buscarlo.
             */
            if (o.patient.status !== 'ACTIVE') { revisionesSinAvisar++; continue; }

            const vencidaHace = Math.round((now.getTime() - o.expiresAt.getTime()) / 60000);
            // Sin cifras ni hallazgo clínico en el cuerpo — regla 7.
            const msg = `Se tomaron vitales fuera de rango y la revisión de los ${OBSERVACION_MIN} min`
                + ` venció hace ${vencidaHace} min sin volver a tomarlos.`;

            await notifyRoles(o.headquartersId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                type: 'EMAR_ALERT',
                title: `Revisión de observación vencida — ${o.patient.name}`,
                message: msg,
                link: '/care/supervisor',
            });
            // Y a quien la tenía asignada, si sigue trabajando aquí.
            if (o.caregiverId && o.caregiver?.isActive && !o.caregiver.isDeleted) {
                await notifyUser(o.caregiverId, {
                    type: 'EMAR_ALERT',
                    title: `Revisión pendiente — ${o.patient.name}`,
                    message: msg,
                    link: '/care',
                });
            }
            revisionesEscaladas++;
        }

        // ── B. Cleanup: PENDING cuyo expiresAt ya pasó → EXPIRED ──
        const expired = await prisma.vitalsOrder.updateMany({
            where: { status: 'PENDING', expiresAt: { lt: now } },
            data: { status: 'EXPIRED' }
        });

        // ── C. Sprint J: penalizar autoCreate expirados sin vitales ──
        const limitePenalidad = new Date(now.getTime() - PENALTY_GRACE_MS);
        let toPenalize = await prisma.vitalsOrder.findMany({
            where: {
                status: 'EXPIRED',
                autoCreated: true,
                penaltyApplied: false,
                completedAt: null,
                caregiverId: { not: null },
                // La gracia mantiene el umbral real de penalidad donde estaba.
                expiresAt: { lt: limitePenalidad },
            },
            include: {
                patient: { select: { name: true, headquartersId: true } },
                caregiver: { select: { id: true, name: true, complianceScore: true } }
            }
        });

        /**
         * Las que vencieron mientras Zéndity no era accesible NO se penalizan.
         *
         * Se marcan como ya penalizadas —sin descontar nada— para que no vuelvan
         * a entrar en este barrido mañana. Castigar por no completar una orden
         * en un sistema al que no se podía entrar es cobrarle a la persona
         * equivocada. Ver src/lib/ventanas-sin-servicio.ts.
         */
        const exentas = toPenalize.filter(o => o.expiresAt && sinServicio(o.expiresAt));
        if (exentas.length > 0) {
            await prisma.vitalsOrder.updateMany({
                where: { id: { in: exentas.map(o => o.id) } },
                data: { penaltyApplied: true },
            });
            console.log(`[vitals-reminder] ${exentas.length} órdenes exentas: vencieron sin servicio.`);
        }
        const exentasIds = new Set(exentas.map(o => o.id));
        toPenalize = toPenalize.filter(o => !exentasIds.has(o.id));

        // ── Agrupar por cuidador para aplicar cap diario + 1 sola notificación ──
        const byCaregiver = new Map<string, typeof toPenalize>();
        for (const o of toPenalize) {
            if (!o.caregiverId || !o.caregiver) continue;
            if (!byCaregiver.has(o.caregiverId)) byCaregiver.set(o.caregiverId, []);
            byCaregiver.get(o.caregiverId)!.push(o);
        }

        const todayClinicalStart = todayStartAST();
        let penalized = 0;
        let penaltiesSkippedByCap = 0;

        for (const [caregiverId, orders] of byCaregiver.entries()) {
            const caregiver = orders[0].caregiver;
            if (!caregiver) continue;
            const hqId = orders[0].headquartersId;

            // Penalidades ya aplicadas hoy a este cuidador (ventana de día clínico AST)
            const todayApplied = await prisma.vitalsOrder.count({
                where: {
                    caregiverId,
                    penaltyApplied: true,
                    autoCreated: true,
                    expiresAt: { gte: todayClinicalStart },
                },
            });

            const available = Math.max(0, DAILY_PENALTY_CAP - todayApplied);
            const toActuallyPenalize = orders.slice(0, available);
            const toSkipPenalty = orders.slice(available);
            const pointsDeducted = toActuallyPenalize.length * 2;

            try {
                const allIds = orders.map(o => o.id);

                // Marcar órdenes como penalizadas (transaction atómica)
                await prisma.vitalsOrder.updateMany({
                    where: { id: { in: allIds } },
                    data: { penaltyApplied: true },
                });

                // Aplicar deducción vía applyScoreEvent (registra en ScoreEvent
                // para que calculateDynamicScore lo capture en el cron diario)
                if (APLICAR_PENALIDAD && pointsDeducted > 0) {
                    await applyScoreEvent(
                        caregiverId,
                        hqId,
                        -pointsDeducted,
                        `Vitales vencidos sin completar (${toActuallyPenalize.length} orden${toActuallyPenalize.length !== 1 ? 'es' : ''})`,
                        'VITALS',
                    );
                }

                const residentNames = orders.map(o => o.patient?.name || 'residente').join(', ');
                const capSuffix = toSkipPenalty.length > 0
                    ? ` (cap diario alcanzado — ${toSkipPenalty.length} no penalizados)`
                    : '';

                await notifyUser(caregiverId, {
                    type: 'EMAR_ALERT',
                    title: 'Vitales no tomados',
                    message: APLICAR_PENALIDAD
                        ? `${orders.length} residentes sin vitales: ${residentNames}. −${pointsDeducted} pts aplicados${capSuffix}.`
                        : `${orders.length} residentes se quedaron sin vitales en tu turno: ${residentNames}.`,
                    link: '/care',
                });

                await notifyRoles(hqId, ['SUPERVISOR'], {
                    type: 'EMAR_ALERT',
                    title: `Vitales vencidos — ${caregiver.name}`,
                    message: APLICAR_PENALIDAD
                        ? `${orders.length} residentes sin vitales en turno de ${caregiver.name}. −${pointsDeducted} pts aplicados${capSuffix}.`
                        : `${orders.length} residentes sin vitales en el turno de ${caregiver.name}. Si se repite, mira si el turno tenía manos suficientes.`,
                    link: '/care/supervisor',
                });

                penalized += toActuallyPenalize.length;
                penaltiesSkippedByCap += toSkipPenalty.length;
            } catch (e) {
                console.error(`[vitals-reminder] Fallo aplicando penalidad grupal a ${caregiverId}:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            reminded,
            expired: expired.count,
            penalized,
            penaltiesSkippedByCap,
            // Sin topes silenciosos: si hubo revisiones que no avisaron a
            // nadie, se dice cuántas y no se confunden con cero.
            revisionesEscaladas,
            revisionesSinAvisar,
        });
    } catch (error: any) {
        console.error("vitals-reminder cron error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
