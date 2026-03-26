import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);

        if (!session || !['ADMIN', 'DIRECTOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        // Validar paciente
        const patient = await prisma.patient.findUnique({
            where: { id: patientId }
        });

        if (!patient || patient.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Paciente no encontrado." }, { status: 404 });
        }

        // Obtener facturas
        const invoices = await prisma.invoice.findMany({
            where: { 
                patientId: patientId,
                headquartersId: hqId
            },
            include: {
                items: true,
                payments: {
                    orderBy: { date: 'desc' }
                }
            },
            orderBy: {
                issueDate: 'desc'
            }
        });

        return NextResponse.json({ success: true, invoices });

    } catch (error) {
        console.error("Error fetching patient invoices:", error);
        return NextResponse.json({ success: false, error: "Error de servidor al cargar facturas." }, { status: 500 });
    }
}
