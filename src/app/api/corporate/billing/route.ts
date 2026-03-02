import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const headquartersId = (session.user as any).headquartersId;

        const invoices = await prisma.invoice.findMany({
            where: { headquartersId },
            include: {
                patient: true,
                items: true
            },
            orderBy: {
                issueDate: 'desc'
            }
        });

        // Calculamos resumen gerencial
        const totalPending = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((acc, curr) => acc + curr.totalAmount, 0);

        return NextResponse.json({ success: true, invoices, totalPending, totalPaid });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Error al cargar facturación" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const { invoiceId, action } = await req.json();

        // Admin solo aprueba pagos ('mark_paid') en este MVP
        if (action === 'mark_paid') {
            const updated = await prisma.invoice.update({
                where: { id: invoiceId },
                data: { status: 'PAID', updatedAt: new Date() }
            });
            return NextResponse.json({ success: true, invoice: updated });
        }

        return NextResponse.json({ success: false, error: "Acción no reconocida" }, { status: 400 });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Error procesando solicitud de pago" }, { status: 500 });
    }
}
