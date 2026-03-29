"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type AcademyAssignmentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

/**
 * 1. CÁLCULO DE SCORE QUINCENAL (CRON JOB BASE)
 * Revisa el historial de una cuidadora en la ventana establecida y dictamina su puntaje base.
 */
export async function calculateQuincenalScore(hqId: string, userId: string, periodStart: Date, periodEnd: Date) {
    try {
        // En un entorno de producción, aquí interrogaríamos las tablas de eMAR y ShiftClosure.
        // Simulamos la ingesta de telemetría de fallos.
        const telemetry = {
            missedPRNs: 3,        // Pastillas importantes ignoradas
            transferredTasks: 4    // Tareas pateadas al siguiente turno
        };

        const BASE_SCORE = 100;
        const penaltyPRN = telemetry.missedPRNs * 5;    // -15 ptos
        const penaltyTasks = telemetry.transferredTasks * 2; // -8 ptos

        let systemScore = BASE_SCORE - penaltyPRN - penaltyTasks;
        if (systemScore < 0) systemScore = 0;

        // Se persiste el PerformanceScore
        const scoreEntry = await prisma.performanceScore.create({
            data: {
                headquartersId: hqId,
                userId: userId,
                periodStart,
                periodEnd,
                systemScore: systemScore,
                finalScore: systemScore, // En Fase 2 se sumará la evaluación Humana
                systemFindings: telemetry
            }
        });

        // 1.B: EVALUACIÓN AUTOMÁTICA DE TRIGGERS
        if (telemetry.missedPRNs >= 3) {
            await triggerAcademyAssignment(hqId, userId, "PRN_PROTOCOL", "Fallas repetidas en administración asíncrona de medicamentos PRN.");
        }
        if (telemetry.transferredTasks >= 5) {
            await triggerAcademyAssignment(hqId, userId, "TIME_MANAGEMENT", "Exceso de tareas transferidas en Cierres de Turno.");
        }

        return { success: true, data: scoreEntry };
    } catch (error) {
        console.error("Fallo al calcular Performance Score", error);
        return { success: false, error: "Error en motor de Score" };
    }
}

/**
 * 2. ENGATILLADOR DE CURSOS (INCLUYE PROTECCIÓN ANTI-BURNOUT)
 * Asigna módulos de Academy protegiendo a la empleada de la repetición inútil.
 */
export async function triggerAcademyAssignment(hqId: string, userId: string, moduleCode: string, reason: string) {
    try {
        const cooldownWindow = new Date();
        cooldownWindow.setDate(cooldownWindow.getDate() - 30); // 30 días de protección

        const existingAssignment = await prisma.academyAssignment.findFirst({
            where: {
                userId,
                moduleCode,
                createdAt: { gte: cooldownWindow }
            }
        });

        if (existingAssignment) {
            console.warn(`[Academy Anti-Burnout] El curso ${moduleCode} ya fue asignado este mes. Escalar a Red Flag Humano en su lugar.`);
            // Aquí se despacharía una alerta de RedFlag en la tabla de Supervisión.
            return { success: false, warn: "COOLDOWN_ACTIVE_RED_FLAG_RAISED" };
        }

        const newAssignment = await prisma.academyAssignment.create({
            data: {
                headquartersId: hqId,
                userId,
                moduleCode,
                reason,
                status: "PENDING",
                assignedBySystem: true
            }
        });

        revalidatePath("/academy");
        return { success: true, data: newAssignment };

    } catch (error) {
        console.error("Fallo inyectando cápsula formativa", error);
        return { success: false, error: "Error en DB." };
    }
}

/**
 * 3. OVERRIDE HUMANO (EVALUACIÓN)
 * Permite al supervisor enmendar o agregar Calidez al score puramente algorítmico.
 */
export async function applyHumanScoreOverride(scoreId: string, humanScore: number) {
    try {
        const scoreCard = await prisma.performanceScore.findUnique({ where: { id: scoreId } });
        if (!scoreCard) return { success: false, error: "Score no encontrado." };

        // Ponderación: 70% Sistema, 30% Supervisor
        const finalScore = (scoreCard.systemScore * 0.70) + (humanScore * 0.30);

        await prisma.performanceScore.update({
            where: { id: scoreId },
            data: {
                humanScore,
                finalScore: parseFloat(finalScore.toFixed(2))
            }
        });

        revalidatePath("/performance");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Fallo aplicando Override Humano." };
    }
}
