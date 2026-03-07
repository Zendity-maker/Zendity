import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, caregiverId, shiftSessionId } = await req.json();

        if (!patientId || !caregiverId || !shiftSessionId) {
            return NextResponse.json({ success: false, error: "Faltan identificadores para registrar el baño." }, { status: 400 });
        }

        // Sistema Antimartingala (Cooldown de 10 minutos por cuidador)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const recentBath = await prisma.bathLog.findFirst({
            where: {
                caregiverId,
                timeLogged: {
                    gte: tenMinutesAgo
                }
            }
        });

        if (recentBath) {
            return NextResponse.json({
                success: false,
                error: "COOLDOWN_ACTIVE",
                message: "Por protocolo, debes esperar al menos 10 minutos entre cada registro de baño."
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
