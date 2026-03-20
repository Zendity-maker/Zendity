import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, caregiverId, symptom, aiNote } = await req.json();

        if (!patientId || !caregiverId || !symptom) {
            return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios." }, { status: 400 });
        }

        // 1. Guardar o inyectar reporte clínico en el Handover (DailyLog con isClinicalAlert = true)
        const logContext = `[ACCIÓN PREVENTIVA: ${symptom.toUpperCase()}] ${aiNote || "Sin detalles adicionales proporcionados."}`;
        
        const diagnosticLog = await prisma.dailyLog.create({
            data: {
                patientId,
                authorId: caregiverId,
                bathCompleted: false,
                foodIntake: 0,
                notes: logContext,
                isClinicalAlert: true, // Esto envía el registro autónomo al Mando de Enfermería
                isResolved: false
            }
        });

        // 2. Sistema de Recompensa de Empleado (+5 Puntos)
        await prisma.user.update({
            where: { id: caregiverId },
            data: { complianceScore: { increment: 5 } }
        });

        return NextResponse.json({ success: true, log: diagnosticLog, pointsDelta: 5 });

    } catch (error) {
        console.error("Preventive Hub Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando acción preventiva." }, { status: 500 });
    }
}
