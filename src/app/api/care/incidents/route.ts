import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { patientId, headquartersId, type, severity, description, biometricSignature } = body;

        if (!patientId || !headquartersId || !type || !description || !biometricSignature) {
            return NextResponse.json({ success: false, error: "Faltan datos obligatorios para registrar un Incidente" }, { status: 400 });
        }

        const incident = await prisma.incident.create({
            data: {
                patientId,
                headquartersId,
                type,
                severity: severity || 'MEDIUM',
                description,
                biometricSignature
            }
        });

        return NextResponse.json({ success: true, incident });

    } catch (error) {
        console.error("Care Incidents POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo registrando el Incidente" }, { status: 500 });
    }
}
