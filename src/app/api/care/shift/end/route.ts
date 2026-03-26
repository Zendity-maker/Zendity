import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



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

        // --- FASE 44: SHIFT HANDOVER ENFORCEMENT ---
        // Evaluar si estamos dentro de la ventana de Cierre de Guardia (±30 mins)
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        let inHandoverWindow = false;
        let shiftTypeDraft = "OTHER";

        // Night Shift End: 5:30 AM - 6:30 AM
        if ((hours === 5 && minutes >= 30) || (hours === 6 && minutes <= 30)) {
            inHandoverWindow = true;
            shiftTypeDraft = "NIGHT";
        }
        // Morning Shift End: 1:30 PM - 2:30 PM
        else if ((hours === 13 && minutes >= 30) || (hours === 14 && minutes <= 30)) {
            inHandoverWindow = true;
            shiftTypeDraft = "MORNING";
        }
        // Evening Shift End: 9:30 PM - 10:30 PM
        else if ((hours === 21 && minutes >= 30) || (hours === 22 && minutes <= 30)) {
            inHandoverWindow = true;
            shiftTypeDraft = "EVENING";
        }

        if (inHandoverWindow && !session.handoverCompleted) {
            return NextResponse.json({
                success: false,
                requireHandover: true,
                shiftType: shiftTypeDraft,
                error: `Debe completar el Relevo de Guardia (${shiftTypeDraft} SHIFT) antes de poder finalizar su turno.`
            }, { status: 403 }); // 403 Forbidden para forzar la UI a abrir el Modal
        }
        // -------------------------------------------

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
