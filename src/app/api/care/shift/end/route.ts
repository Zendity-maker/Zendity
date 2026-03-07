import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { shiftSessionId } = await req.json();

        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: "shiftSessionId requerido" }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: {
                caregiver: true
            }
        });

        if (!session) {
            return NextResponse.json({ success: false, error: "Turno no encontrado" }, { status: 404 });
        }

        if (session.actualEndTime) {
            return NextResponse.json({ success: false, error: "Este turno ya fue finalizado" }, { status: 400 });
        }

        // 1. Gather data for AI summary (Meds, Baths, Meals, Incidents of this shift)
        // For now, we will mock the AI call or build a basic string. We can plug OpenAI/Gemini here later.

        const bathCount = await prisma.bathLog.count({
            where: { shiftSessionId }
        });

        const mealCount = await prisma.mealLog.count({
            where: { shiftSessionId }
        });

        const aiSummaryReport = `Turno finalizado. Se registraron ${bathCount} baños y ${mealCount} comidas. (Resumen IA pendiente de integración completa)`;

        // 2. Cierre de Turno
        const closedSession = await prisma.shiftSession.update({
            where: { id: shiftSessionId },
            data: {
                actualEndTime: new Date(),
                aiSummaryReport
            }
        });

        return NextResponse.json({ success: true, shiftSession: closedSession });

    } catch (error) {
        console.error("Shift End Error:", error);
        return NextResponse.json({ success: false, error: "Error al finalizar el turno" }, { status: 500 });
    }
}
