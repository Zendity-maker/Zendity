import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { formacionDe } from '@/lib/formacion';

// Evaluar personal y mover complianceScore es operación de gestión.
const EVAL_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'HR_MANAGER'];

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

        // Formacion continua: la unica categoria que NO la pone el evaluador.
        //
        // Se calcula sola porque es el unico dato objetivo de la evaluacion —
        // cursos aprobados frente a la meta que le tocaba, prorrateada por el
        // tiempo que lleva con acceso a Academy. Que la rellene el sistema
        // evita dos cosas: que haya que ir a buscarla a mano, y que dependa de
        // lo bien que le caiga alguien al evaluador.
        //
        // Entra como una categoria mas, asi que baja el global de forma
        // proporcionada. NO es una penalizacion ni un evento que resta puntos:
        // es una nota. La diferencia importa — se puede defender delante de la
        // persona con un numero detras ("tomaste 1 de los 3 que te tocaban"),
        // y hoy aprendimos que castigar produce el efecto contrario al buscado.
        const formacion = await formacionDe(employeeId);
        const categoriasFinales = {
            ...categoryScores,
            ...(formacion ? { formacion: formacion.porcentaje } : {}),
        };

        // 1. Calcular el Score Global Promedio
        const scores: number[] = Object.values(categoriasFinales);
        const globalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

        // 2. Transacción Segura: Guardar Evaluación y Actualizar Empleado
        const [evaluation, updatedUser] = await prisma.$transaction([
            prisma.employeeEvaluation.create({
                data: {
                    employeeId,
                    evaluatorId,
                    headquartersId: hqId,
                    score: globalScore,
                    categoryScores: categoriasFinales,
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
