import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hr/schedule/draft-status
 *
 * Endpoint lightweight para los avisos de "Schedule en DRAFT".
 * Consumido por:
 *   - AppLayout (badge en sidebar "Configurar Horario")
 *   - /care/supervisor banner amber arriba del wall
 *   - /api/cron/schedule-publish-check (verificación lunes 6AM)
 *
 * Devuelve:
 *   - hasDraftCurrentWeek: boolean (hay un schedule DRAFT cuya weekStartDate
 *     cae en la semana actual lunes-domingo)
 *   - scheduleId, weekStartDate, shiftCount (si hay draft)
 *
 * Auth: DIRECTOR/ADMIN/SUPERVISOR (todos los que pueden ver el wall).
 *
 * Notas:
 *   - "Semana actual" = lunes a domingo, time-zone PR.
 *   - Solo cuenta como problemático si tiene shifts > 0 (un Schedule vacío
 *     es un placeholder, no operacional).
 */
export async function GET() {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPERVISOR']);
        if (auth instanceof NextResponse) return auth;

        // Calcular lunes de esta semana en hora local (PR). Aproximación con UTC:
        // hora PR = UTC-4, así que el "hoy" en PR puede diferir del UTC. Para
        // alineación operativa usamos la fecha PR.
        const nowPR = new Date(Date.now() - 4 * 3600 * 1000); // PR offset
        const dayOfWeek = nowPR.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sab
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayUTC = new Date(nowPR.getTime());
        mondayUTC.setUTCDate(nowPR.getUTCDate() - daysFromMonday);
        mondayUTC.setUTCHours(0, 0, 0, 0);
        // Re-ajustar a UTC real
        const mondayReal = new Date(mondayUTC.getTime() + 4 * 3600 * 1000);
        const sundayReal = new Date(mondayReal.getTime() + 7 * 24 * 3600 * 1000);

        const draft = await prisma.schedule.findFirst({
            where: {
                headquartersId: auth.headquartersId,
                status: 'DRAFT',
                weekStartDate: { gte: mondayReal, lt: sundayReal },
            },
            select: {
                id: true,
                weekStartDate: true,
                _count: { select: { shifts: true } },
            },
        });

        if (!draft || draft._count.shifts === 0) {
            return NextResponse.json({ success: true, hasDraftCurrentWeek: false });
        }

        return NextResponse.json({
            success: true,
            hasDraftCurrentWeek: true,
            scheduleId: draft.id,
            weekStartDate: draft.weekStartDate,
            shiftCount: draft._count.shifts,
        });
    } catch (err: any) {
        logError('hr.schedule.draft-status', err);
        return NextResponse.json({ success: false, error: 'Error' }, { status: 500 });
    }
}
