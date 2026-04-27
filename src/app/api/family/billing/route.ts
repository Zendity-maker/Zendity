import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        // Resolver patientId desde FamilyMember (más robusto)
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
        });
        const patientId = familyMember?.patientId ?? (session.user as any).id;

        // Residente (para mostrar nombre + habitación en el header del portal)
        const resident = patientId
            ? await prisma.patient.findUnique({
                where: { id: patientId },
                select: { name: true, roomNumber: true },
              })
            : null;

        // Fetch all invoices for the family's patient, including line items
        const invoices = await prisma.invoice.findMany({
            where: { patientId },
            include: { items: true },
            orderBy: { dueDate: 'desc' }
        });

        return NextResponse.json({ success: true, invoices, resident });
    } catch (e) {
        console.error("Billing Fetch Error:", e);
        return NextResponse.json({ success: false, error: "Error al cargar facturas" }, { status: 500 });
    }
}
