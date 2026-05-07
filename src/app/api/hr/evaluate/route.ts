import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { calculateDynamicScore } from '@/app/api/care/compliance-score/route';
import { notifyUser } from '@/lib/notifications';
import { applyScoreEvent } from '@/lib/score-event';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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
                            headquartersId: evaluator.headquartersId,
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

            // D. Notificar al empleado — sabe exactamente qué pasó y qué hacer
            try {
                const courseMsg = reinforcementCourse
                    ? ` Completa el curso "${reinforcementCourse.title}" en Academy para reactivar tu acceso.`
                    : ' Contacta a tu supervisor para reactivar tu acceso.';
                await notifyUser(employeeId, {
                    type: 'SHIFT_BLOCKED',
                    title: '⚠️ Turno suspendido temporalmente',
                    message: `Tu evaluación de hoy resultó en una puntuación de ${globalScore}/100. ${blockReasonText}.${courseMsg}`,
                    link: '/academy',
                });
            } catch (e) { console.error('[notify SHIFT_BLOCKED]', e); }

        } else {
            // ScoreEvent proporcional — negativo si es bajo, positivo si es alto
            // (ya no siempre positivo — evaluación de 60 no puede dar puntos)
            let scoreDelta = 0;
            if (globalScore >= 95)      scoreDelta = 5;
            else if (globalScore >= 80) scoreDelta = 2;
            else if (globalScore >= 70) scoreDelta = -3;
            else if (globalScore >= 60) scoreDelta = -8;
            else                        scoreDelta = -15;

            if (scoreDelta !== 0) {
                const targetUser = await prisma.user.findUnique({ where: { id: employeeId }, select: { headquartersId: true } });
                if (targetUser) {
                    const { applyScoreEvent } = await import('@/lib/score-event');
                    await applyScoreEvent(employeeId, targetUser.headquartersId, scoreDelta,
                        `Evaluación supervisora: ${globalScore}/100`, 'EVALUATION');
                }
            }

            // Notificar al empleado con resultado
            try {
                const msg = globalScore >= 90
                    ? `¡Excelente evaluación! Obtuviste ${globalScore}/100. Sigue así.`
                    : globalScore >= 80
                    ? `Tu evaluación fue completada con ${globalScore}/100. Buen trabajo.`
                    : `Tu evaluación fue de ${globalScore}/100. Hay áreas de mejora — revisa tu perfil.`;
                await notifyUser(employeeId, {
                    type: 'EVALUATION_COMPLETE',
                    title: '📋 Evaluación de desempeño registrada',
                    message: msg,
                    link: '/care',
                });
            } catch (e) { console.error('[notify EVALUATION_COMPLETE]', e); }
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

        // 6. Recalcular complianceScore inmediatamente y registrar en historial
        let newScore = globalScore;
        try {
            const result = await calculateDynamicScore(employeeId);
            newScore = result.score;
            const currentUser = await prisma.user.findUnique({ where: { id: employeeId }, select: { complianceScore: true, headquartersId: true } });
            const scoreDeltaCron = newScore - (currentUser?.complianceScore ?? 100);
            if (scoreDeltaCron !== 0) {
                // applyScoreEvent actualiza el score Y crea el ScoreEvent (alimenta la gráfica)
                await applyScoreEvent(
                    employeeId,
                    evaluator.headquartersId,
                    scoreDeltaCron,
                    `Evaluación supervisora — score actualizado a ${newScore}/100`,
                    'EVALUATION',
                );
            } else {
                // Score no cambió pero registrar snapshot igual para la gráfica
                await prisma.scoreEvent.create({
                    data: {
                        userId: employeeId,
                        headquartersId: evaluator.headquartersId,
                        delta: 0,
                        reason: `Evaluación supervisora — score estable en ${newScore}/100`,
                        category: 'EVALUATION',
                        scoreBefore: newScore,
                        scoreAfter: newScore,
                    }
                });
            }
        } catch (scoreErr) {
            console.error("[evaluate] No se pudo recalcular complianceScore en tiempo real:", scoreErr);
        }

        // 7. Correo electrónico al empleado
        try {
            const employee = await prisma.user.findUnique({
                where: { id: employeeId },
                select: { name: true, email: true }
            });
            const hq = await prisma.headquarters.findUnique({
                where: { id: evaluator.headquartersId },
                select: { name: true }
            });

            if (employee?.email && process.env.SENDGRID_API_KEY) {
                const hqName   = hq?.name || 'Zendity';
                const empName  = employee.name.split(' ')[0];
                const fechaHoy = new Date().toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

                const subjectLine = isPenalized
                    ? `⚠️ Evaluación de desempeño — Acceso suspendido temporalmente`
                    : globalScore >= 80
                    ? `✅ Evaluación de desempeño completada — ${globalScore}/100`
                    : `📋 Evaluación de desempeño registrada — ${globalScore}/100`;

                const bodyHtml = isPenalized ? `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
                        <div style="background:#ef4444;padding:24px;border-radius:12px 12px 0 0;text-align:center">
                            <h1 style="color:white;margin:0;font-size:22px">⚠️ Turno Suspendido Temporalmente</h1>
                        </div>
                        <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                            <p style="font-size:16px">Hola <strong>${empName}</strong>,</p>
                            <p>Tu evaluación de desempeño del <strong>${fechaHoy}</strong> en <strong>${hqName}</strong> resultó en una puntuación de <strong style="color:#ef4444">${globalScore}/100</strong>.</p>
                            <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:8px;margin:20px 0">
                                <p style="margin:0;font-weight:bold;color:#dc2626">Razón del bloqueo:</p>
                                <p style="margin:8px 0 0">${blockReasonText}</p>
                            </div>
                            <p style="font-weight:bold">¿Qué debo hacer?</p>
                            <p>Para reactivar tu acceso al turno y al eMAR, completa el curso de refuerzo asignado en la plataforma Academy de Zendity. Una vez completado, tu acceso se restaurará automáticamente.</p>
                            <div style="text-align:center;margin:28px 0">
                                <a href="https://app.zendity.com/academy" style="background:#7c3aed;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ir a Academy →</a>
                            </div>
                            <p style="color:#64748b;font-size:13px">Si tienes preguntas, habla directamente con tu supervisor. Este correo fue generado automáticamente por Zendity RRHH.</p>
                        </div>
                    </div>` : `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
                        <div style="background:${globalScore >= 80 ? '#10b981' : '#f59e0b'};padding:24px;border-radius:12px 12px 0 0;text-align:center">
                            <h1 style="color:white;margin:0;font-size:22px">${globalScore >= 80 ? '✅ ¡Buena evaluación!' : '📋 Evaluación registrada'}</h1>
                        </div>
                        <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                            <p style="font-size:16px">Hola <strong>${empName}</strong>,</p>
                            <p>Tu evaluación de desempeño del <strong>${fechaHoy}</strong> en <strong>${hqName}</strong> fue registrada.</p>
                            <div style="background:#f8fafc;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
                                <p style="margin:0;color:#64748b;font-size:14px">Puntuación obtenida</p>
                                <p style="margin:8px 0 0;font-size:48px;font-weight:bold;color:${globalScore >= 80 ? '#10b981' : '#f59e0b'}">${globalScore}<span style="font-size:24px">/100</span></p>
                                <p style="margin:8px 0 0;color:#64748b;font-size:13px">Score Compliance actualizado: ${newScore}/100</p>
                            </div>
                            ${globalScore < 80 ? '<p style="color:#92400e;background:#fef3c7;padding:12px;border-radius:8px">Hay áreas de mejora identificadas. Revisa el detalle en tu perfil de la aplicación.</p>' : '<p>¡Sigue con el buen trabajo! Tu compromiso con la calidad asistencial marca la diferencia.</p>'}
                            <div style="text-align:center;margin:28px 0">
                                <a href="https://app.zendity.com/care" style="background:#0f766e;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Ver mi perfil →</a>
                            </div>
                            <p style="color:#64748b;font-size:13px">Este correo fue generado automáticamente por Zendity RRHH.</p>
                        </div>
                    </div>`;

                await sgMail.send({
                    to: employee.email,
                    from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                    subject: `[${hqName}] ${subjectLine}`,
                    html: bodyHtml,
                });
            }
        } catch (emailErr) {
            console.error("[evaluate] Error enviando correo:", emailErr);
            // No falla el request principal
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
