import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, authorId, description, type } = await req.json();

        if (!patientId || !authorId || !description || !type) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: { familyMembers: { select: { id: true } } }
        });

        if (!patient) return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });

        // Buscamos un familiar para anclar la queja (o usamos un fallback de sistema si no tiene)
        const familyMemberId = patient.familyMembers.length > 0 ? patient.familyMembers[0].id : null;

        if (!familyMemberId) {
            // Nota: Si la BD requiere estrictamente un familiar para crear un Complaint, deberíamos insertar una entidad dummy o hacer el campo opcional en Schema. 
            // Para fines operativos, si no hay familiares, generamos un HQ Event como Workaround.
            const event = await prisma.headquartersEvent.create({
                data: {
                    headquartersId: patient.headquartersId,
                    title: `Queja Familiar Atendida (Sin Familiar Registrado)`,
                    description: description,
                    type: "OTHER",
                    patientId: patient.id,
                    startTime: new Date(),
                    endTime: new Date()
                }
            });
            return NextResponse.json({ success: true, event });
        }

        const complaint = await prisma.complaint.create({
            data: {
                headquartersId: patient.headquartersId,
                patientId: patient.id,
                familyMemberId: familyMemberId,
                description: `[Reportado por Cuidador ID: ${authorId}] - ${description}`,
                status: "PENDING"
            }
        });

        return NextResponse.json({ success: true, complaint });
    } catch (error: any) {
        console.error("Care Complaint POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
