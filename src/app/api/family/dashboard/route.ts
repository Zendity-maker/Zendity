import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado. Acceso exclusivo para familiares." }, { status: 401 });
        }

        const patientId = session.user.id; // En NextAuth aliasamos patientId a id

        const resident = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                lifePlan: true,
                vitalSigns: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                },
                dailyLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                },
                wellnessNotes: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                },
                medications: {
                    include: {
                        medication: true
                    }
                },
                invoices: {
                    orderBy: { issueDate: 'desc' },
                    include: { items: true }
                }
            }
        });

        if (!resident) {
            return NextResponse.json({ success: false, error: "Residente no encontrado." }, { status: 404 });
        }

        return NextResponse.json({ success: true, resident });

    } catch (error) {
        console.error("Family Dashboard API Error:", error);
        return NextResponse.json({ success: false, error: "Error al cargar dashboard familiar." }, { status: 500 });
    }
}
