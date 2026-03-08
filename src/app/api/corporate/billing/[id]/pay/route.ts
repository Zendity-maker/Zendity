import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const resolvedParams = await context.params;
        const invoiceId = resolvedParams.id;

        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'PAID', updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, invoice: updated });

    } catch (error) {
        console.error("Pay Invoice Error:", error);
        return NextResponse.json({ success: false, error: "Error procesando solicitud de pago" }, { status: 500 });
    }
}
