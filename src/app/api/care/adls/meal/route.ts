import { NextResponse } from 'next/server';
import { PrismaClient, MealType, MealQuality } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, caregiverId, shiftSessionId, mealType, quality } = await req.json();

        if (!patientId || !caregiverId || !shiftSessionId || !mealType || !quality) {
            return NextResponse.json({ success: false, error: "Todos los campos de la comida son requeridos." }, { status: 400 });
        }

        // Validar Ventanas de Tiempo Estrictas (Huso Horario America/Puerto_Rico)
        const now = new Date();
        const prTimeString = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Puerto_Rico',
            hour12: false,
            hour: 'numeric',
            minute: 'numeric'
        }).format(now);
        
        // Manejamos el factor "24h" format "13:05"
        const [hourStr, minuteStr] = prTimeString.split(':');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        let isValidWindow = false;

        // Ajuste estricto solicitado por el usuario:
        // Desayuno: de 7:00 AM a 9:59 AM 
        if (mealType === 'BREAKFAST' && (hour >= 7 && hour < 10)) isValidWindow = true; 
        // Almuerzo: de 11:00 AM a 1:59 PM
        if (mealType === 'LUNCH' && (hour >= 11 && hour < 14)) isValidWindow = true;    
        // Cena: de 4:00 PM a 6:59 PM
        if (mealType === 'DINNER' && (hour >= 16 && hour < 19)) isValidWindow = true;   

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
