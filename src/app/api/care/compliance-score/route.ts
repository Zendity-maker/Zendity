import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateDynamicScore } from '@/lib/compliance-score';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/compliance-score?userId=X
 *
 * Fórmula revisada (v3):
 * Base: 75 puntos
 *
 * Positivos (cap +15 para evitar techo por volumen):
 *   +1.5 por rotación postural a tiempo
 *   +0.5 por medicamento ADMINISTERED
 *   +5   por alerta preventiva (DailyLog isClinicalAlert)
 *
 * Negativos:
 *   -8  por medicamento OMITTED
 *   -8  por rotación postural tardía
 *   -8  por FastAction FAILED
 *   -10 por sesión no cerrada (actualEndTime IS NULL, últimos 14 días)
 *   -10 por handover no completado (últimos 14 días)
 *   -10 por turno cerrado con CERO registros clínicos (últimos 14 días)
 *   - Σ pointsDeducted de observaciones APPLIED (últimos 90 días)
 *
 * Evaluaciones del supervisor (últimos 90 días, la más reciente pesa más):
 *   Score evaluación ≥ 90 → +5
 *   Score evaluación 80-89 → +2
 *   Score evaluación 70-79 → -3
 *   Score evaluación 60-69 → -8
 *   Score evaluación < 60  → -15
 *
 * Cap: [0, 100]
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const targetUserId = searchParams.get('userId') || (session.user as any).id;

        if (!targetUserId) {
            return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 });
        }

        const invokerHqId = (session.user as any).headquartersId;
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, headquartersId: true, role: true }
        });
        if (!targetUser || targetUser.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Usuario fuera de tu sede' }, { status: 403 });
        }

        const result = await calculateDynamicScore(targetUserId);
        return NextResponse.json({ success: true, user: { id: targetUser.id, name: targetUser.name, role: targetUser.role }, ...result });

    } catch (err: any) {
        console.error('[compliance-score]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * La fórmula se mudó a src/lib/compliance-score.ts el 10-sep-2026.
 * Se re-exporta para no romper los cuatro importadores de golpe; lo correcto
 * es importarla del lib.
 */
export { calculateDynamicScore };
