import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR', 'SUPERVISOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        const orders = await prisma.conciergeOrder.findMany({
            where: {
                patient: { headquartersId: hqId }
            },
            include: {
                patient: { select: { name: true, roomNumber: true } },
                product: { select: { name: true, category: true, imageUrl: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, orders });
    } catch (error: any) {
        console.error("Error fetching Concierge Orders:", error);
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { orderId, status } = body;

        if (!Object.values(OrderStatus).includes(status)) {
            return NextResponse.json({ success: false, error: 'Estado inválido' }, { status: 400 });
        }

        const order = await prisma.conciergeOrder.findUnique({
            where: { id: orderId },
            include: { patient: true }
        });

        if (!order) return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });

        await prisma.$transaction(async (tx) => {
            // 1. Actualizar estado
            await tx.conciergeOrder.update({
                where: { id: orderId },
                data: { status }
            });

            // 2. Si se CANCELA y estaba pendiente, devolver los fondos al residente B2C
            if (status === 'CANCELLED' && order.status === 'PENDING') {
                await tx.patient.update({
                    where: { id: order.patientId },
                    data: { conciergeBalance: { increment: order.totalPrice } }
                });

                // Registrar mensaje a la familia avisando la cancelación
                await tx.familyMessage.create({
                    data: {
                        patientId: order.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `Tu orden por $${order.totalPrice.toFixed(2)} ha sido cancelada por la administración. El saldo ha sido reintegrado a tu cuenta de manera exitosa.`
                    }
                });
            }
        });

        return NextResponse.json({ success: true, message: 'Orden actualizada' });
    } catch (error: any) {
        console.error("Error updating Concierge Order:", error);
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}
