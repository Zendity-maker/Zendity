import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const employeeId = params.id;

        const employee = await prisma.user.findUnique({
            where: { id: employeeId },
            include: {
                headquarters: true,
                _count: {
                    select: {
                        administeredMeds: true,
                        shiftSessions: true,
                    }
                }
            }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Empleado no encontrado" }, { status: 404 });
        }

        // Generar un historial de desempeño (Scores) simulado basado en el complianceScore actual
        // En Fase 55+ esto vendría de una tabla real de Evaluaciones
        const baseScore = employee.complianceScore || 75;
        const months = ["Oct", "Nov", "Dic", "Ene", "Feb", "Mar"];
        const performanceHistory = months.map(month => {
            // Generar una variación de -5 a +5 puntos alrededor del baseScore, sin pasarse de 100
            const variation = Math.floor(Math.random() * 11) - 5;
            let score = baseScore + variation;
            if (score > 100) score = 100;
            if (score < 0) score = 0;
            return { month, score };
        });

        // Asegurar que el último mes (Marzo) refleje exactamente el score actual
        performanceHistory[5].score = baseScore;

        return NextResponse.json({
            success: true,
            employee,
            performanceHistory
        });

    } catch (error: any) {
        console.error("Error fetching employee profile:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}
