import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';

// Sprint O — Cap diario de penalidades por cuidador para evitar DoS
// reputacional (−30+ pts en 1 segundo cuando un turno no alcanzó a tomar
// vitales a 15 residentes). Máximo 5 penalidades/día = −10 pts máx.
const DAILY_PENALTY_CAP = 5;

// Cron cada 5 min:
//  A. Recuerda al cuidador si una orden pendiente vence en ~20 min.
//  B. Marca EXPIRED las vencidas sin completar.
//  C. Sprint J: aplica -2 puntos al cuidador por cada VitalsOrder autoCreada
//     que expiró sin completarse en la ventana de 4h.
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL'}`) {
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
            const title = "Vitales por vencer (20 min)";
            const msg = `La ventana de vitales de ${order.patient.name} vence a las ${order.expiresAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico' })}. Tómalos cuanto antes.`;

            if (order.caregiverId) {
                await notifyUser(order.caregiverId, { type: 'EMAR_ALERT', title, message: msg });
            } else {
                await notifyRoles(order.headquartersId, ['CAREGIVER'], { type: 'EMAR_ALERT', title, message: msg });
            }

            await prisma.vitalsOrder.update({
                where: { id: order.id },
                data: { reminderSentAt: now }
            });
            reminded++;
        }

        // ── B. Cleanup: PENDING cuyo expiresAt ya pasó → EXPIRED ──
        const expired = await prisma.vitalsOrder.updateMany({
            where: { status: 'PENDING', expiresAt: { lt: now } },
            data: { status: 'EXPIRED' }
        });

        // ── C. Sprint J: penalizar autoCreate expirados sin vitales ──
        const toPenalize = await prisma.vitalsOrder.findMany({
            where: {
                status: 'EXPIRED',
                autoCreated: true,
                penaltyApplied: false,
                completedAt: null,
                caregiverId: { not: null }
            },
            include: {
                patient: { select: { name: true, headquartersId: true } },
                caregiver: { select: { id: true, name: true, complianceScore: true } }
            }
        });

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
                // Transaction: decrement score (con piso 0) + marcar TODAS las órdenes
                // del grupo como penaltyApplied=true (aunque las sobre-cap no restaron
                // puntos, se marcan para no re-evaluarlas en el próximo cron tick).
                const current = caregiver.complianceScore ?? 100;
                const nextScore = Math.max(0, current - pointsDeducted);
                const allIds = orders.map(o => o.id);

                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: caregiverId },
                        data: { complianceScore: nextScore },
                    }),
                    prisma.vitalsOrder.updateMany({
                        where: { id: { in: allIds } },
                        data: { penaltyApplied: true },
                    }),
                ]);

                const residentNames = orders.map(o => o.patient?.name || 'residente').join(', ');
                const capSuffix = toSkipPenalty.length > 0
                    ? ` (cap diario alcanzado — ${toSkipPenalty.length} no penalizados)`
                    : '';

                await notifyUser(caregiverId, {
                    type: 'EMAR_ALERT',
                    title: 'Vitales no tomados — Penalidad',
                    message: `${orders.length} residentes sin vitales: ${residentNames}. −${pointsDeducted} pts aplicados${capSuffix}.`,
                });

                await notifyRoles(hqId, ['SUPERVISOR'], {
                    type: 'EMAR_ALERT',
                    title: `Vitales vencidos — ${caregiver.name}`,
                    message: `${orders.length} residentes sin vitales en turno de ${caregiver.name}. −${pointsDeducted} pts aplicados${capSuffix}.`,
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
        });
    } catch (error: any) {
        console.error("vitals-reminder cron error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
