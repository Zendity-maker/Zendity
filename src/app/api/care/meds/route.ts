import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientMedicationId, administeredById, status, notes, biometricSignature } = await req.json();

        if (!biometricSignature || biometricSignature.length < 4) {
            return NextResponse.json({ success: false, error: "Firma obligatoria" }, { status: 400 });
        }

        const admin = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById,
                status: status || 'GIVEN',
                biometricSignature,
                notes
            }
        });

        return NextResponse.json({ success: true, administration: admin });

    } catch (error) {
        console.error("Meds POST Error:", error);
        return NextResponse.json({ success: false, error: "Error registrando medicamento" }, { status: 500 });
    }
}
