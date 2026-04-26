/**
 * Helper centralizado para aplicar cambios al complianceScore
 * y guardar el evento en la tabla ScoreEvent.
 *
 * Garantiza:
 *  - Score siempre en [0, 100] (clamp)
 *  - Historial auditables con scoreBefore / scoreAfter
 *  - Nunca lanza excepción al caller (best-effort en el registro del evento)
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
