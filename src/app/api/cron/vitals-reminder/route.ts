import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser, notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

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

        let penalized = 0;
        for (const order of toPenalize) {
            if (!order.caregiverId || !order.caregiver) continue;

            // Transacción: decrement con piso en 0 + marcar penaltyApplied
            const current = order.caregiver.complianceScore ?? 100;
            const nextScore = Math.max(0, current - 2);

            try {
                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: order.caregiverId },
                        data: { complianceScore: nextScore }
                    }),
                    prisma.vitalsOrder.update({
                        where: { id: order.id },
                        data: { penaltyApplied: true }
                    })
                ]);

                await notifyUser(order.caregiverId, {
                    type: 'EMAR_ALERT',
                    title: 'Penalidad — Vitales no tomados',
                    message: `${order.patient.name} — No se tomaron vitales en la ventana de 4 horas. −2 puntos de desempeño aplicados.`
                });

                await notifyRoles(order.headquartersId, ['SUPERVISOR'], {
                    type: 'EMAR_ALERT',
                    title: 'Vitales no tomados',
                    message: `${order.caregiver.name} no tomó vitales de ${order.patient.name} en 4 horas. −2 pts aplicados.`
                });

                penalized++;
            } catch (e) {
                console.error(`[vitals-reminder] Fallo aplicando penalidad a orden ${order.id}:`, e);
            }
        }

        return NextResponse.json({ success: true, reminded, expired: expired.count, penalized });
    } catch (error: any) {
        console.error("vitals-reminder cron error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
