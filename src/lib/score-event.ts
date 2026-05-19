/**
 * Helper centralizado para aplicar cambios al complianceScore
 * y guardar el evento en la tabla ScoreEvent.
 *
 * Garantiza:
 *  - Score siempre en [0, 100] (clamp)
 *  - Historial auditables con scoreBefore / scoreAfter
 *  - Nunca lanza excepción al caller (best-effort en el registro del evento)
 *
 * DEUDA TÉCNICA — coexistencia de dos modelos de Z-Score:
 *
 *   1) User.complianceScore RAW: este helper lo actualiza directamente
 *      cada vez que se llama. Es lo que muestran HR/staff, evaluaciones
 *      y panel de empleado individual.
 *
 *   2) Score DINÁMICO calculado en /api/care/compliance-score: parte de
 *      base 75 + reglas (rondas, meds, observaciones) + extraDelta capeado
 *      a +15 que suma ScoreEvents (ACADEMY/PHOTO/MISSION/SHIFT/VITALS) de
 *      últimos 90 días. Es lo que ve la cuidadora en /care/profile.
 *
 *   Como resultado, ambos números pueden divergir (ej. cuidador con
 *   muchos cursos viejos antes del rebalanceo de mayo 2026 puede tener
 *   complianceScore RAW=100 pero dynamic=85).
 *
 *   Plan de migración futura: dejar de escribir a User.complianceScore
 *   y calcular dinámicamente siempre, eliminando el campo o usándolo
 *   solo como snapshot diario para queries rápidas.
 */
import { prisma } from '@/lib/prisma';
import { clampComplianceScore } from '@/lib/compliance-score';

export type ScoreCategory =
    | 'VITALS'
    | 'MEDS'
    | 'ROTATION'
    | 'MISSION'
    | 'ACADEMY'
    | 'INCIDENT'
    | 'SHIFT'
    | 'PREVENTIVE'
    | 'PHOTO'
    | 'EVALUATION';

export interface ScoreEventResult {
    scoreBefore: number;
    scoreAfter:  number;
    delta:       number;
}

export async function applyScoreEvent(
    userId:         string,
    headquartersId: string,
    delta:          number,
    reason:         string,
    category:       ScoreCategory,
): Promise<ScoreEventResult | null> {
    try {
        // 1. Leer score actual
        const user = await prisma.user.findUnique({
            where:  { id: userId },
            select: { complianceScore: true },
        });
        if (!user) return null;

        const scoreBefore = user.complianceScore;

        // 2. Aplicar delta
        if (delta > 0) {
            await prisma.user.update({
                where: { id: userId },
                data:  { complianceScore: { increment: delta } },
            });
        } else if (delta < 0) {
            await prisma.user.update({
                where: { id: userId },
                data:  { complianceScore: { decrement: Math.abs(delta) } },
            });
        }
        // delta === 0 → solo registrar el evento, sin tocar el score

        // 3. Clamp [0, 100]
        await clampComplianceScore(userId);

        // 4. Leer score final real
        const updated = await prisma.user.findUnique({
            where:  { id: userId },
            select: { complianceScore: true },
        });
        const scoreAfter = updated?.complianceScore ?? scoreBefore;

        // 5. Guardar evento (best-effort — nunca bloquea el flujo principal)
        await prisma.scoreEvent.create({
            data: {
                userId,
                headquartersId,
                delta,
                reason,
                category,
                scoreBefore,
                scoreAfter,
            },
        });

        return { scoreBefore, scoreAfter, delta };
    } catch (err) {
        console.error('[applyScoreEvent] Error:', err);
        return null;
    }
}
