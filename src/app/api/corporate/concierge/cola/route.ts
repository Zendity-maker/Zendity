import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { ROLES_APRUEBAN, TOPE_MENSUAL } from '@/lib/concierge';

/**
 * GET /api/corporate/concierge/cola
 *
 * Lo que espera decisión: pedidos y citas de las familias.
 *
 * Antes no existia esta cola. Una familia pedia y su pedido se quedaba en
 * PENDING sin que nadie pudiera moverlo — que es la version un paso mas
 * adelante del mismo problema que ya tenia el modulo.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const auth = await requireRole([...ROLES_APRUEBAN]);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const [pedidos, citas, especialistas] = await Promise.all([
            prisma.conciergeOrder.findMany({
                where: {
                    patient: { headquartersId: hqId },
                    status: { in: ['PENDING', 'APPROVED'] },
                },
                select: {
                    id: true, status: true, totalPrice: true, createdAt: true,
                    patient: { select: { id: true, name: true, roomNumber: true } },
                    product: { select: { name: true, stock: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.conciergeAppointment.findMany({
                where: {
                    patient: { headquartersId: hqId },
                    status: { in: ['PENDING_APPROVAL', 'SCHEDULED', 'IN_PROGRESS'] },
                },
                select: {
                    id: true, status: true, scheduledAt: true, createdAt: true,
                    agreedPrice: true, notes: true, servicioExterno: true,
                    patient: { select: { id: true, name: true, roomNumber: true } },
                    service: { select: { name: true, price: true, providerType: true } },
                    specialist: { select: { name: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            // Quien puede atender, para el desplegable. Si no hay nadie, la
            // pantalla ofrece igual la via del servicio externo.
            prisma.user.findMany({
                where: {
                    headquartersId: hqId, isActive: true, isDeleted: false,
                    role: { in: ['THERAPIST', 'BEAUTY_SPECIALIST'] },
                },
                select: { id: true, name: true, role: true },
                orderBy: { name: 'asc' },
            }),
        ]);

        // Cuanto lleva comprometido cada residente este mes, para que quien
        // aprueba vea si se esta acercando al tope antes de decir que si.
        const pr = new Date(Date.now() - 4 * 3600 * 1000);
        const desde = new Date(Date.UTC(pr.getUTCFullYear(), pr.getUTCMonth(), 1));
        const ids = [...new Set([...pedidos, ...citas].map(x => x.patient.id))];
        const gasto = new Map<string, number>();
        for (const pid of ids) {
            const [po, ci] = await Promise.all([
                prisma.conciergeOrder.findMany({
                    where: { patientId: pid, createdAt: { gte: desde }, status: { in: ['APPROVED', 'DELIVERED'] } },
                    select: { totalPrice: true },
                }),
                prisma.conciergeAppointment.findMany({
                    where: { patientId: pid, createdAt: { gte: desde }, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] } },
                    select: { agreedPrice: true, service: { select: { price: true } } },
                }),
            ]);
            gasto.set(pid,
                po.reduce((a, x) => a + x.totalPrice, 0) +
                ci.reduce((a, x) => a + (x.agreedPrice ?? x.service.price), 0));
        }

        return NextResponse.json({
            success: true,
            tope: TOPE_MENSUAL,
            especialistas,
            pedidos: pedidos.map(p => ({
                ...p,
                gastoDelMes: Math.round((gasto.get(p.patient.id) ?? 0) * 100) / 100,
            })),
            citas: citas.map(c => ({
                ...c,
                precio: c.agreedPrice ?? c.service.price,
                gastoDelMes: Math.round((gasto.get(c.patient.id) ?? 0) * 100) / 100,
            })),
        });
    } catch (e: any) {
        console.error('[concierge/cola] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
