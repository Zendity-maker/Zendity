import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const patientId = session.user.id;

        // Fetch all invoices for the family's patient, including line items
        const invoices = await prisma.invoice.findMany({
            where: { patientId },
            include: { items: true },
            orderBy: { dueDate: 'desc' }
        });

        return NextResponse.json({ success: true, invoices });
    } catch (e) {
        console.error("Billing Fetch Error:", e);
        return NextResponse.json({ success: false, error: "Error al cargar facturas" }, { status: 500 });
    }
}
