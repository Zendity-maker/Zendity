import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { caregiverId, headquartersId, initialCensus } = await req.json();

        if (!caregiverId || !headquartersId || typeof initialCensus !== 'number') {
            return NextResponse.json({ success: false, error: "Datos incompletos o census inválido (requiere caregiverId, headquartersId, initialCensus)" }, { status: 400 });
        }

        // Verificar si ya hay una sesión activa
        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId,
                actualEndTime: null, // Sigue activa
                startTime: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)) // De hoy
                }
            }
        });

        if (activeSession) {
            return NextResponse.json({ success: true, message: "Ya existe un turno activo", shiftSession: activeSession });
        }

        const newSession = await prisma.shiftSession.create({
            data: {
                caregiverId,
                headquartersId,
                initialCensus,
                startTime: new Date()
            }
        });

        return NextResponse.json({ success: true, shiftSession: newSession });

    } catch (error) {
        console.error("Shift Start Error:", error);
        return NextResponse.json({ success: false, error: "Fallo registrando el inicio de turno" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const caregiverId = searchParams.get('caregiverId');

        if (!caregiverId) {
            return NextResponse.json({ success: false, error: "caregiverId es requerido" }, { status: 400 });
        }

        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId,
                actualEndTime: null,
                startTime: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });

        return NextResponse.json({ success: true, activeSession });

    } catch (error) {
        console.error("Shift GET Error:", error);
        return NextResponse.json({ success: false, error: "Error obteniendo sesión" }, { status: 500 });
    }
}
