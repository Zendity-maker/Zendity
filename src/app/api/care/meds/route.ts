import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientMedicationId, administeredById, status, notes } = await req.json();

        // Validaciones básicas preventivas
        if (!patientMedicationId || !administeredById) {
            return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
        }

        const admin = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById,
                status: status || 'ADMINISTERED',
                notes
            }
        });

        return NextResponse.json({ success: true, administration: admin });

    } catch (error) {
        console.error("Meds POST Error:", error);
        return NextResponse.json({ success: false, error: "Error registrando medicamento" }, { status: 500 });
    }
}
