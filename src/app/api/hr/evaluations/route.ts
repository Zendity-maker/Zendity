import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

// Evaluar personal y mover complianceScore es operación de gestión.
const EVAL_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(EVAL_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json();
        const { employeeId, categoryScores, feedback } = body;

        if (!employeeId || !categoryScores) {
            return NextResponse.json({ success: false, error: "Datos de auditoría incompletos" }, { status: 400 });
        }

        // hqId y evaluador salen de la sesión, nunca del body (anti-forja multi-tenant).
        const hqId = auth.headquartersId;
        const evaluatorId = auth.id;

        // Ownership: el empleado evaluado debe pertenecer a la sede del evaluador.
        const employee = await prisma.user.findFirst({
            where: { id: employeeId, headquartersId: hqId },
            select: { id: true },
        });
        if (!employee) {
            return NextResponse.json({ success: false, error: "Empleado no encontrado" }, { status: 404 });
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
