import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employeeId, evaluatorId, hqId, categoryScores, feedback } = body;

        if (!employeeId || !evaluatorId || !hqId || !categoryScores) {
            return NextResponse.json({ success: false, error: "Datos de auditoría incompletos" }, { status: 400 });
        }

        // 1. Calcular el Score Global Promedio
        const scores: number[] = Object.values(categoryScores);
        const globalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

        // 2. Transacción Segura: Guardar Evaluación y Actualizar Empleado
        const [evaluation, updatedUser] = await prisma.$transaction([
            prisma.employeeEvaluation.create({
                data: {
                    employeeId,
                    evaluatorId,
                    headquartersId: hqId,
                    score: globalScore,
                    categoryScores,
                    feedback
                }
            }),
            prisma.user.update({
                where: { id: employeeId },
                data: {
                    complianceScore: globalScore // El score global dinámico reemplaza su métrica actual
                }
            })
        ]);

        return NextResponse.json({ success: true, evaluation, newComplianceScore: updatedUser.complianceScore });

    } catch (error) {
        console.error("Evaluation POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo registrando la Evaluación" }, { status: 500 });
    }
}
