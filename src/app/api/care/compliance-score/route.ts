import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/compliance-score?userId=X
 *
 * Fórmula revisada (v2):
 * Base: 100 puntos
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
 * Función pura exportada — usada por el cron sync-compliance y el route de evaluación.
 */
export async function calculateDynamicScore(userId: string) {
    const sevenDaysAgo    = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo   = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // ── Positivos clínicos (últimos 7 días) ──
    const [rotationsOnTime, medsAdministered, preventiveAlerts] = await Promise.all([
        prisma.posturalChangeLog.count({
            where: { nurseId: userId, isComplianceAlert: false, performedAt: { gte: sevenDaysAgo } }
        }),
        prisma.medicationAdministration.count({
            where: { administeredById: userId, status: 'ADMINISTERED', administeredAt: { gte: sevenDaysAgo } }
        }),
        prisma.dailyLog.count({
            where: { authorId: userId, isClinicalAlert: true, notes: { contains: '[ACCIÓN PREVENTIVA' }, createdAt: { gte: sevenDaysAgo } }
        }),
    ]);

    // ── Negativos clínicos (últimos 7 días) ──
    const [medsOmitted, rotationsLate, fastActionsFailed] = await Promise.all([
        prisma.medicationAdministration.count({
            where: { administeredById: userId, status: 'OMITTED', administeredAt: { gte: sevenDaysAgo } }
        }),
        prisma.posturalChangeLog.count({
            where: { nurseId: userId, isComplianceAlert: true, performedAt: { gte: sevenDaysAgo } }
        }),
        prisma.fastActionAssignment.count({
            where: { caregiverId: userId, status: 'FAILED', createdAt: { gte: sevenDaysAgo } }
        }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // ── Sesiones no cerradas (últimos 14 días, excluye el día en curso) ──
    const unclosedSessions = await prisma.shiftSession.count({
        where: {
            caregiverId: userId,
            startTime: { gte: fourteenDaysAgo, lt: todayStart },
            actualEndTime: null,
        }
    });

    // ── Handovers no completados (sesiones ya cerradas pero sin handover, últimos 14 días) ──
    const incompleteHandovers = await prisma.shiftSession.count({
        where: {
            caregiverId: userId,
            startTime: { gte: fourteenDaysAgo, lt: todayStart },
            handoverCompleted: false,
            actualEndTime: { not: null },
        }
    });

    // ── Observaciones/Incidentes aplicados (últimos 90 días) ──
    // Sin filtro de pointsDeducted > 0 para no perder registros con null
    const appliedObservations = await prisma.incidentReport.findMany({
        where: {
            employeeId: userId,
            status: { in: ['APPLIED', 'EXPLANATION_RECEIVED'] },
            OR: [
                { appliedAt: { gte: ninetyDaysAgo } },
                // Si appliedAt es null, usar createdAt como fallback
                { appliedAt: null, createdAt: { gte: ninetyDaysAgo } }
            ]
        },
        select: { pointsDeducted: true },
    });

    const observationPenalty = appliedObservations.reduce(
        (sum, obs) => sum + (obs.pointsDeducted ?? 5), // default -5 si no tiene valor
        0
    );

    // ── Evaluaciones del supervisor (últimos 90 días) ──
    const evaluations = await prisma.employeeEvaluation.findMany({
        where: {
            employeeId: userId,
            createdAt: { gte: ninetyDaysAgo }
        },
        select: { score: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5 // máximo las últimas 5 evaluaciones
    });

    // La más reciente pesa doble, las demás pesan 1x
    let evaluationDelta = 0;
    evaluations.forEach((ev, idx) => {
        const weight = idx === 0 ? 2 : 1; // doble peso a la más reciente
        let delta = 0;
        if (ev.score >= 90)      delta = 5;
        else if (ev.score >= 80) delta = 2;
        else if (ev.score >= 70) delta = -3;
        else if (ev.score >= 60) delta = -8;
        else                     delta = -15;
        evaluationDelta += delta * weight;
    });

    // ── ScoreEvents extra (Academy, Photo, Mission, Vitals — excluye EVALUATION) ──
    const extraScoreEvents = await prisma.scoreEvent.findMany({
        where: {
            userId,
            createdAt: { gte: ninetyDaysAgo },
            category: { in: ['ACADEMY', 'PHOTO', 'MISSION', 'SHIFT', 'VITALS'] },
        },
        select: { delta: true },
    });
    const extraDelta = extraScoreEvents.reduce((sum, e) => sum + e.delta, 0);

    // ── Cálculo final ──
    const rawPositives = (rotationsOnTime * 1.5) + (medsAdministered * 0.5) + (preventiveAlerts * 5);
    const positives    = Math.min(rawPositives, 15); // cap para evitar techo por volumen

    const negatives =
        (medsOmitted * 8) +
        (rotationsLate * 8) +
        (fastActionsFailed * 8) +
        (unclosedSessions * 10) +
        (incompleteHandovers * 10);

    const raw   = 100 + positives - negatives - observationPenalty + evaluationDelta + extraDelta;
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    return {
        score,
        breakdown: {
            base: 100,
            positives: Math.round(positives),
            negatives,
            observationPenalty,
            evaluationDelta,
            extraDelta,
            total: Math.round(raw),
            details: {
                rotationsOnTime,
                medsAdministered,
                preventiveAlerts,
                medsOmitted,
                rotationsLate,
                fastActionsFailed,
                unclosedSessions,
                incompleteHandovers,
                appliedObservationsCount: appliedObservations.length,
                evaluationsCount: evaluations.length,
                extraScoreEventsCount: extraScoreEvents.length,
            }
        }
    };
}
