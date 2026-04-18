import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser, notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// Cron cada 5 min: recuerda al cuidador si una orden pendiente vence en ~20 min.
// Ventana: expiresAt entre (now+15min) y (now+25min), reminderSentAt NULL.
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL'}`) {
        return NextResponse.json({ error: 'Firma CRON Inválida' }, { status: 401 });
    }

    try {
        const now = new Date();
        const windowStart = new Date(now.getTime() + 15 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 25 * 60 * 1000);

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

        let sent = 0;
        for (const order of dueOrders) {
            const title = "Vitales por vencer (20 min)";
            const msg = `La orden de vitales de ${order.patient.name} vence a las ${order.expiresAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}. Tómalos cuanto antes.`;

            if (order.caregiverId) {
                await notifyUser(order.caregiverId, { type: 'EMAR_ALERT', title, message: msg });
            } else {
                await notifyRoles(order.headquartersId, ['CAREGIVER'], { type: 'EMAR_ALERT', title, message: msg });
            }

            await prisma.vitalsOrder.update({
                where: { id: order.id },
                data: { reminderSentAt: now }
            });
            sent++;
        }

        // Expirar órdenes ya vencidas (best-effort cleanup)
        const expired = await prisma.vitalsOrder.updateMany({
            where: { status: 'PENDING', expiresAt: { lt: now } },
            data: { status: 'EXPIRED' }
        });

        return NextResponse.json({ success: true, reminded: sent, expired: expired.count });
    } catch (error: any) {
        console.error("vitals-reminder cron error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
