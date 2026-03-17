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
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        let isValidWindow = false;

        if (mealType === 'BREAKFAST' && (hour >= 7 && (hour < 10 || (hour === 10 && minute === 0)))) isValidWindow = true; 
        if (mealType === 'LUNCH' && (hour >= 11 && (hour < 13 || (hour === 13 && minute === 0)))) isValidWindow = true;    
        if (mealType === 'DINNER' && (hour >= 16 && (hour < 18 || (hour === 18 && minute <= 45)))) isValidWindow = true;   

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
