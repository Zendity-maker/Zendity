import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const hqId = url.searchParams.get("hqId");

        if (!hqId) {
            return NextResponse.json({ success: false, error: "Missing hqId" }, { status: 400 });
        }

        // 1. Obtener pacientes ACTIVOS con su dieta
        const activePatients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: "ACTIVE" },
            select: { id: true, name: true, roomNumber: true, diet: true },
            orderBy: { name: 'asc' }
        });

        // 2. Obtener pacientes en HOSPITAL
        const hospitalPatients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: "TEMPORARY_LEAVE", leaveType: "HOSPITAL" },
            select: { id: true, name: true, roomNumber: true },
            orderBy: { name: 'asc' }
        });

        // 3. Obtener Observaciones Recientes del Supervisor
        const observations = await prisma.kitchenObservation.findMany({
            where: { headquartersId: hqId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { supervisor: { select: { name: true } } }
        });

        return NextResponse.json({
            success: true,
            activePatients,
            hospitalPatients,
            observations
        });

    } catch (error: any) {
        console.error("Kitchen Dashboard API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
