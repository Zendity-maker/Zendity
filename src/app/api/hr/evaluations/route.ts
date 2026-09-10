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

        /**
         * NADIE SE EVALUA A SI MISMO.
         *
         * No estaba bloqueado, y esta ruta ESCRIBE el complianceScore
         * directamente: bastaba una llamada con el propio employeeId para
         * ponerse en 100. Las dos supervisoras de Cupey pueden llamarla, y
         * tambien sobre su DIRECTOR — la comprobacion de arriba solo mira que
         * sean de la misma sede, no que haya jerarquia.
         *
         * Lo de la jerarquia queda pendiente y avisado. Lo de uno mismo se
         * cierra aqui, que es lo barato y lo evidente.
         */
        if (employeeId === evaluatorId) {
            return NextResponse.json({
                success: false,
                error: 'No puedes evaluarte a ti mismo.',
            }, { status: 403 });
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
        /**
         * Los valores vienen del body y se promediaban sin validar. Un numero
         * fuera de [0,100] —o un texto que Number() convierte en algo raro—
         * entraba tal cual al score. Se acota cada categoria antes de promediar
         * y se descarta lo que no sea un numero.
         */
        const scores: number[] = Object.values(categoriasFinales)
            .map(v => Number(v))
            .filter(v => Number.isFinite(v))
            .map(v => Math.max(0, Math.min(100, v)));
        if (scores.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'La evaluación no trae ninguna categoría con puntaje.',
            }, { status: 400 });
        }
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
            /**
             * REEMPLAZABA EL SCORE ENTERO. Una evaluacion podia llevar a alguien
             * de 100 a 0 en una sola llamada, y sin dejar ScoreEvent: la grafica
             * de historial que ve el empleado contradecia el numero de arriba.
             * En produccion ya hay 30 reescrituras asi, invisibles.
             *
             * Se deja de escribir el campo desde aqui. La evaluacion se guarda
             * —que es el hecho real, con su autor y su fecha— y el score lo
             * calcula quien tenga que calcularlo, una sola vez, leyendo esta
             * fila como una entrada mas. Ver src/lib/z-score-visible.ts.
             */
            prisma.user.update({
                where: { id: employeeId },
                data: {},
            })
        ]);

        return NextResponse.json({ success: true, evaluation, newComplianceScore: updatedUser.complianceScore });

    } catch (error) {
        console.error("Evaluation POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo registrando la Evaluación" }, { status: 500 });
    }
}
