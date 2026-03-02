import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const headquartersId = (session.user as any).headquartersId;

        const products = await prisma.conciergeProduct.findMany({
            where: { headquartersId, isActive: true }
        });

        const services = await prisma.conciergeService.findMany({
            where: { headquartersId, isActive: true }
        });

        const patient = await prisma.patient.findUnique({
            where: { id: session.user.id },
            select: { conciergeBalance: true }
        });

        return NextResponse.json({ success: true, products, services, balance: patient?.conciergeBalance || 0 });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Error al cargar el Marketplace" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const { type, id, price } = await req.json(); // type: 'product' or 'service'
        const patientId = session.user.id;
        const familyEmail = session.user.email;

        const familyMember = await prisma.familyMember.findUnique({ where: { email: familyEmail! } });
        if (!familyMember) throw new Error("Familiar no encontrado");

        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient || patient.conciergeBalance < price) {
            return NextResponse.json({ success: false, error: "Saldo Insuficiente. Adquiere una Gift Card." }, { status: 400 });
        }

        // Descontar Saldo
        await prisma.patient.update({
            where: { id: patientId },
            data: { conciergeBalance: { decrement: price } }
        });

        if (type === 'product') {
            const order = await prisma.conciergeOrder.create({
                data: {
                    patientId,
                    productId: id,
                    quantity: 1,
                    totalPrice: price,
                    orderedById: familyMember.id
                }
            });

            // Si es Gift Card, reponer el monto de la Gift Card en lugar de descontar
            // Asumimos que la Gift Card cuesta igual que su valor, entonces descontamos el precio de la venta, 
            // y agregamos el "valor" al balance en una tx real. En este flujo simplificado: si es Gift Card, duplicamos
            // el precio a reponer (ya restamos 1 vez, sumamos 2 veces).
            // Pero para simplificar: lo detectamos en el FRONTEND y si es Gift Card no lo compramos vía este endpoint, 
            // mejor lo dejamos como orden y un Admin la aprueba, o sumamos directo:
            const product = await prisma.conciergeProduct.findUnique({ where: { id } });
            if (product?.category === 'GiftCards') {
                await prisma.patient.update({
                    where: { id: patientId },
                    data: { conciergeBalance: { increment: price * 2 } } // Restaura lo descontado y suma el bono
                });
            }

            return NextResponse.json({ success: true, order });
        } else {
            const appointment = await prisma.conciergeAppointment.create({
                data: {
                    patientId,
                    serviceId: id
                }
            });
            return NextResponse.json({ success: true, appointment });
        }

    } catch (error) {
        console.error("Concierge POST error:", error);
        return NextResponse.json({ success: false, error: "Error procesando solicitud" }, { status: 500 });
    }
}
