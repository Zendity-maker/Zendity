import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, headquartersId, type, severity, description, biometricSignature, photoUrl } = await req.json();

        // Si es una caída (FALL), la procesamos con la lógica severa
        if (type === 'FALL') {
            const riskAssessment = await prisma.fallRiskAssessment.create({
                data: {
                    patientId,
                    evaluatorId: biometricSignature, // The caregiver ID
                    morseScore: 85, // Dummy default dictando Alto Riesgo
                    riskLevel: 'HIGH',
                    factors: "Asignación de Zendi Vision Pose-Detection (IoT Sentinel)",
                    nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });

            const incident = await prisma.fallIncident.create({
                data: {
                    patientId,
                    location: "Ubicación reportada vía Triage",
                    severity: 'SEVERE',
                    interventions: 'Activado Protocolo Emergencia Zendi',
                    notes: description
                }
            });

            return NextResponse.json({ success: true, incident, riskAssessment });
        }

        // FASE 32: Reportes No-Clínicos / Incidentes Generales u Operativos (Mantenimiento)
        if (type === 'OTHER') {
            // Utilizamos HeadquartersEvent para loggear situaciones del edificio o inventario referentes a un residente
            const event = await prisma.headquartersEvent.create({
                data: {
                    headquartersId,
                    title: `Reporte de Mantenimiento / Operación [Severidad: ${severity}]`,
                    description: `[Firmado por Cuidador ID: ${biometricSignature}] - ${description}`,
                    type: "OTHER",
                    patientId: patientId || null,
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // Default 2 hours resolve time ETA
                    photoUrl: photoUrl || null // FASE 37
                }
            });

            return NextResponse.json({ success: true, event });
        }


        return NextResponse.json({ success: false, error: "Invalid Incident Type" }, { status: 400 });

    } catch (error: any) {
        console.error("Care Incidents POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
