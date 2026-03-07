import { NextResponse } from 'next/server';
import { PrismaClient, MealType, MealQuality } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, caregiverId, shiftSessionId, mealType, quality } = await req.json();

        if (!patientId || !caregiverId || !shiftSessionId || !mealType || !quality) {
            return NextResponse.json({ success: false, error: "Todos los campos de la comida son requeridos." }, { status: 400 });
        }

        // Validar Ventanas de Tiempo Estrictas (Huso Horario Local del Servidor)
        const hour = new Date().getHours();
        let isValidWindow = false;

        if (mealType === 'BREAKFAST' && hour >= 8 && hour <= 10) isValidWindow = true; // 8am - 10am
        if (mealType === 'LUNCH' && hour >= 11 && hour <= 13) isValidWindow = true;    // 11am - 1pm
        if (mealType === 'DINNER' && hour >= 16 && hour < 20) isValidWindow = true;    // 4:30pm(16) - 7pm(19)

        if (!isValidWindow) {
            return NextResponse.json({
                success: false,
                error: `La ventana de tiempo para registrar el ${mealType} está actualmente cerrada.`
            }, { status: 403 });
        }

        const newMeal = await prisma.mealLog.create({
            data: {
                patientId,
                caregiverId,
                shiftSessionId,
                mealType: mealType as MealType,
                quality: quality as MealQuality
            }
        });

        return NextResponse.json({ success: true, meal: newMeal });

    } catch (error) {
        console.error("Meal Route Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando la bandeja de comida" }, { status: 500 });
    }
}
