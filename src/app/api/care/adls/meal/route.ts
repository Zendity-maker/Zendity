import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
import { MealType, MealQuality } from '@prisma/client';
import { resolverHoraReal } from '@/lib/hora-real';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const MealBody = z.object({
    patientId:      z.string().min(1, 'patientId requerido'),
    caregiverId:    z.string().min(1, 'caregiverId requerido'),
    shiftSessionId: z.string().min(1, 'shiftSessionId requerido'),
    mealType:       z.nativeEnum(MealType),
    quality:        z.nativeEnum(MealQuality),
    // Hora real de la comida. Opcional: sin ella se usa `now()` como siempre.
    timeLogged:     z.string().datetime().optional(),
});

export async function POST(req: Request) {
    try {
        // Auth + rol clínico (antes este endpoint era público)
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const sessionHqId = auth.headquartersId;

        const rawBody = await req.json().catch(() => null);
        const parsed = MealBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { patientId, caregiverId, shiftSessionId, mealType, quality, timeLogged } = parsed.data;

        // Tenant check — el residente DEBE pertenecer a la sede del invocador
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { headquartersId: true }
        });
        if (!patient || patient.headquartersId !== sessionHqId) {
            return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede." }, { status: 404 });
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

        /**
         * Guarda contra doble envio — la misma que /adls/bath, que por tenerla
         * lleva CERO duplicados en 2 972 registros.
         *
         * Aqui no existia, y el resultado medido el 30-ago-2026: 1 149 comidas
         * duplicadas de 8 687. Mismo residente, misma comida, misma calidad,
         * misma cuidadora, segundos aparte — hasta pares con 0 y 1 segundo de
         * diferencia. Eso inflaba la nutricion registrada de cada residente y
         * el progreso del turno.
         *
         * Se compara tambien mealType: registrar el almuerzo y despues la cena
         * seguidas es legitimo; registrar el almuerzo dos veces no.
         */
        const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
        const comidaReciente = await prisma.mealLog.findFirst({
            where: { patientId, mealType, timeLogged: { gte: dosMinutosAtras } },
        });
        if (comidaReciente) {
            return NextResponse.json({
                success: false,
                error: 'COOLDOWN_ACTIVE',
                message: 'Esta comida ya fue registrada para este residente hace un momento.',
            }, { status: 429 });
        }

        const hora = resolverHoraReal(timeLogged);
        if (!hora.ok) {
            return NextResponse.json({ success: false, error: hora.error }, { status: 400 });
        }

        const newMeal = await prisma.mealLog.create({
            data: {
                patientId,
                caregiverId,
                shiftSessionId,
                mealType,
                quality,
                timeLogged: hora.hora,
            }
        });

        return NextResponse.json({ success: true, meal: newMeal });

    } catch (error) {
        logError('care.adls.meal.post', error);
        return NextResponse.json({ success: false, error: "Error interno procesando la bandeja de comida" }, { status: 500 });
    }
}
