import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export const maxDuration = 60; // Parche Staging Integral E2E

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const { employeeId, evaluatorId, role, scores } = data;

        // 1. Obtener HQ Data y Verificar Evaluador
        const evaluator = await prisma.user.findUnique({ where: { id: evaluatorId } });
        if (!evaluator || !evaluator.headquartersId) {
            return NextResponse.json({ error: "Evaluador no autorizado o sin HQ" }, { status: 403 });
        }

        // 2. Calcular Promedio Global basado en el JSON dinámico de respuestas (scores)
        const scoreValues = Object.values(scores) as number[];
        const globalScore = scoreValues.length > 0
            ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
            : 0;

        // 3. Crear Evaluación en RRHH
        const evaluation = await prisma.employeeEvaluation.create({
            data: {
                headquartersId: evaluator.headquartersId,
                employeeId,
                evaluatorId,
                score: globalScore,
                categoryScores: scores,
                feedback: "Generado automáticamente vía Zendity Smart RRHH"
            }
        });

        // 4. LÓGICA DE AUTOMATIZACIÓN (Penalización y Bloqueo Operativo)
        let isPenalized = false;
        let blockReasonText = "";

        // Si es Enfermero o Cuidador evaluamos métricas clínicas
        if (role === "NURSE" || role === "CAREGIVER") {
            const hygieneScore = Number(scores["higiene"] || 100);
            const securityScore = Number(scores["seguridad_clinica"] || 100);

            if (hygieneScore < 75 || securityScore < 75) {
                isPenalized = true;
                blockReasonText = `Bloqueo Predictivo: Puntuación deficiente en Higiene (${hygieneScore}/100) o Seguridad Clínica (${securityScore}/100)`;
            }
        }
        // Si es Admin/Director evaluamos métricas organizacionales
        else if (role === "ADMIN" || role === "DIRECTOR" || role === "SOCIAL_WORKER") {
            const complianceScore = Number(scores["cumplimiento_df"] || 100);

            if (complianceScore < 75) {
                isPenalized = true;
                blockReasonText = `Bloqueo de Auditoría: Protocolos de Cumplimiento Dept. Familia deficientes (${complianceScore}/100)`;
            }
        }

        // 5. Aplicar Penalidad en Perfil
        if (isPenalized) {
            // A. Bloquear Perfil para su próximo turno
            await prisma.user.update({
                where: { id: employeeId },
                data: {
                    isShiftBlocked: true,
                    blockReason: blockReasonText
                }
            });

            // 5B. Buscar el curso penalizador en Academy
            let reinforcementCourse = await prisma.course.findFirst({
                where: { title: { contains: "Protocolos de Seguridad" } }
            });

            // C. Asignarle el curso forzoso
            if (reinforcementCourse) {
                // Chequear si ya lo tiene asignado
                const existingEnroll = await prisma.userCourse.findFirst({
                    where: { employeeId: employeeId, courseId: reinforcementCourse.id }
                });

                if (!existingEnroll) {
                    await prisma.userCourse.create({
                        data: {
                            employeeId: employeeId,
                            courseId: reinforcementCourse.id,
                            headquartersId: evaluator.headquartersId, // Inyectado del evaluator HQ
                            status: "ASSIGNED"
                        }
                    });
                } else if (existingEnroll.status === "COMPLETED") {
                    // Re-asignar si ya lo tomó antes pero volvió a fallar
                    await prisma.userCourse.update({
                        where: { id: existingEnroll.id },
                        data: { status: "ASSIGNED" }
                    });
                }
            }
        } else {
            // FASE 66: Gamification Points for Positive Evaluation
            let bonus = 0;
            if (globalScore >= 95) bonus = 5;
            else if (globalScore >= 80) bonus = 3;
            else if (globalScore >= 60) bonus = 1;

            if (bonus > 0) {
                const targetUser = await prisma.user.findUnique({ where: { id: employeeId }, select: { headquartersId: true } });
                if (targetUser) {
                    const { applyScoreEvent } = await import('@/lib/score-event');
                    await applyScoreEvent(employeeId, targetUser.headquartersId, bonus,
                        'Evaluación positiva del supervisor', 'EVALUATION');
                }
            }
        }

        // ACADEMY TRIGGER: Score bajo (75-84) sin bloqueo formal → refuerzo formativo
        if (!isPenalized && globalScore < 85) {
            const existingCapsule = await prisma.academyAssignment.findFirst({
                where: {
                    userId: employeeId,
                    status: { in: ['PENDING', 'IN_PROGRESS'] }
                }
            });

            if (!existingCapsule) {
                await prisma.academyAssignment.create({
                    data: {
                        userId: employeeId,
                        headquartersId: evaluator.headquartersId,
                        moduleCode: 'BUENAS_PRACTICAS_101',
                        reason: `Score de evaluación ${globalScore}/100 — refuerzo preventivo asignado automáticamente.`,
                        status: 'PENDING',
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            evaluationId: evaluation.id,
            penalized: isPenalized,
            globalScore
        });

    } catch (error) {
        console.error("Error submitting evaluation:", error);
        return NextResponse.json({ error: "Failed to submit evaluation" }, { status: 500 });
    }
}
