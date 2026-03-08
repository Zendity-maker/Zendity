import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, authorId, bathCompleted, foodIntake, notes, photoUrl } = await req.json();

        // Determinar alerta clínica si no comió nada (0%) o notas preocupantes
        const isClinicalAlert = Number(foodIntake) === 0 || (notes && notes.toLowerCase().includes('dolor'));

        const log = await prisma.dailyLog.create({
            data: {
                patientId,
                authorId,
                bathCompleted: Boolean(bathCompleted),
                foodIntake: Number(foodIntake),
                notes,
                isClinicalAlert: Boolean(isClinicalAlert),
                photoUrl: photoUrl || null // FASE 37
            }
        });

        return NextResponse.json({ success: true, log, alert: isClinicalAlert ? "Notificación de Riesgo Nutricional/Dolor enviada a Enfermería." : null });

    } catch (error) {
        console.error("Log POST Error:", error);
        return NextResponse.json({ success: false, error: "Error registrando bitácora" }, { status: 500 });
    }
}
