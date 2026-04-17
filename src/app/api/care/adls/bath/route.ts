import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const { patientId, caregiverId, shiftSessionId } = await req.json();

        if (!patientId || !caregiverId || !shiftSessionId) {
            return NextResponse.json({ success: false, error: "Faltan identificadores para registrar el baño." }, { status: 400 });
        }

        // Anti doble-click: cooldown de 2 minutos por (cuidadora + residente)
        // Permite bañar múltiples residentes seguidos; solo bloquea registrar
        // dos veces al MISMO residente en una ventana corta.
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

        const recentBath = await prisma.bathLog.findFirst({
            where: {
                caregiverId,
                patientId,
                timeLogged: {
                    gte: twoMinutesAgo
                }
            }
        });

        if (recentBath) {
            return NextResponse.json({
                success: false,
                error: "COOLDOWN_ACTIVE",
                message: "Este baño ya fue registrado recientemente para este residente. Espera un momento."
            }, { status: 429 });
        }

        const newBath = await prisma.bathLog.create({
            data: {
                patientId,
                caregiverId,
                shiftSessionId,
                status: "COMPLETED"
            }
        });

        return NextResponse.json({ success: true, bath: newBath });

    } catch (error) {
        console.error("Bath Route Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando el baño" }, { status: 500 });
    }
}
