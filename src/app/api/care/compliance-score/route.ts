import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/compliance-score?userId=X
 * Calcula score dinámico basado en eventos de los ÚLTIMOS 7 DÍAS.
 *
 * Base: 70 puntos (neutro)
 * Positivos:
 *   +2 por rotación postural a tiempo
 *   +1 por medicamento ADMINISTERED
 *   +5 por alerta preventiva (DailyLog con isClinicalAlert)
 * Negativos:
 *   -5 por medicamento OMITTED
 *   -5 por rotación postural tardía (isComplianceAlert=true)
 *   -5 por FastAction FAILED
 *
 * Cap: 0..100
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

        // Valida que el targetUser pertenece a la misma sede que el invocador
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
 * Función pura para calcular el score de un usuario — exportada también
 * para uso desde el cron job.
 */
export async function calculateDynamicScore(userId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── Positivos ──
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

    // ── Negativos ──
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

    const positives = (rotationsOnTime * 2) + (medsAdministered * 1) + (preventiveAlerts * 5);
    const negatives = (medsOmitted * 5) + (rotationsLate * 5) + (fastActionsFailed * 5);

    const raw = 70 + positives - negatives;
    const score = Math.max(0, Math.min(100, raw));

    return {
        score,
        breakdown: {
            positives,
            negatives,
            total: raw,
            details: {
                rotationsOnTime,
                medsAdministered,
                preventiveAlerts,
                medsOmitted,
                rotationsLate,
                fastActionsFailed,
            }
        }
    };
}
