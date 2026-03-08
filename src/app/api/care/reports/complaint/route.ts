import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, authorId, description, type, photoUrl } = await req.json();

        if (!patientId || !authorId || !description || !type) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: { familyMembers: { select: { id: true } } }
        });

        if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });

        // Buscamos un familiar para anclar la queja (o null si el residente no tiene)
        const familyMemberId = patient.familyMembers.length > 0 ? patient.familyMembers[0].id : null;

        const complaint = await prisma.complaint.create({
            data: {
                headquartersId: patient.headquartersId,
                patientId: patient.id,
                familyMemberId: familyMemberId,
                description: `[Reportado por Cuidador ID: ${authorId}] - ${description}`,
                status: "PENDING",
                photoUrl: photoUrl || null // FASE 37
            }
        });

        return NextResponse.json({ success: true, complaint });
    } catch (error: any) {
        console.error("Care Complaint POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
