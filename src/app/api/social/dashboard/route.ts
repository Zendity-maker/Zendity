import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, subDays } from 'date-fns';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { logError } from '@/lib/logger';

const SW_ALLOWED = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

async function getHandler(req: Request) {
    try {
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;

        // hqId de la sesión (resolver): rol limitado → su sede. DIRECTOR/ADMIN
        // pueden pasar ?hqId del query y el resolver valida que tengan
        // acceso. resolveEffectiveHqId requiere `session` raw para el chequeo
        // de DIRECTOR/ADMIN — auth (requireRole) ya validó el rol.
        const session = await getServerSession(authOptions);
        const { searchParams } = new URL(req.url);
        const hqId = await resolveEffectiveHqId(session!, searchParams.get('hqId'));

        const now = new Date();
        const sixtyDaysFromNow = new Date(Date.now() + 60 * 86400000);
        const sevenDaysAgo = startOfDay(subDays(now, 7));

        const [
            pendingTasks,
            expiringBenefits,
            recentNotes,
            totalActiveResidents,
            tasksCompletedThisWeek,
            totalPendingTasks,
            benefitsExpiringSoonCount,
        ] = await Promise.all([
            prisma.socialWorkTask.findMany({
                where: { headquartersId: hqId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
                include: {
                    patient: { select: { id: true, name: true, roomNumber: true } },
                    createdBy: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true } },
                },
                orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.socialWorkBenefit.findMany({
                where: {
                    headquartersId: hqId,
                    status: 'ACTIVE',
                    expirationDate: { gte: now, lte: sixtyDaysFromNow },
                },
                include: { patient: { select: { id: true, name: true } } },
                orderBy: { expirationDate: 'asc' },
            }),
            prisma.socialWorkNote.findMany({
                where: { headquartersId: hqId },
                include: {
                    patient: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma.patient.count({ where: { headquartersId: hqId, status: 'ACTIVE' } }),
            prisma.socialWorkTask.count({ where: { headquartersId: hqId, status: 'COMPLETED', completedAt: { gte: sevenDaysAgo } } }),
            prisma.socialWorkTask.count({ where: { headquartersId: hqId, status: 'PENDING' } }),
            prisma.socialWorkBenefit.count({ where: { headquartersId: hqId, status: 'ACTIVE', expirationDate: { gte: now, lte: sixtyDaysFromNow } } }),
        ]);

        // FIX 2026-05-31: SpecialistVisit removido. El cálculo de "especialistas
        // vencidos" basado en aquel modelo se reconstruirá con
        // ExternalServiceVisit en sprint futuro si Celia lo pide. Por ahora,
        // overdueSpecialists devuelve vacío. El frontend del dashboard social
        // tolera array vacío (sección colapsa sola).
        const sortedOverdue: { patient: { id: string; name: string }; specialistType: string; lastVisit: Date | null; daysSince: number }[] = [];

        return NextResponse.json({
            success: true,
            pendingTasks,
            expiringBenefits,
            overdueSpecialists: sortedOverdue,
            recentNotes,
            stats: {
                totalActiveResidents,
                tasksCompletedThisWeek,
                totalPendingTasks,
                benefitsExpiringSoon: benefitsExpiringSoonCount,
            },
        });
    } catch (error) {
        logError('social.dashboard.get', error);
        return NextResponse.json({ success: false, error: 'Error cargando dashboard social' }, { status: 500 });
    }
}

// PHI audit (HIPAA Pilar 1). Es aggregate (no por paciente) — patientId null.
export const GET = withPhiAccessLog(getHandler, { resourceType: 'SocialWorkDashboard' });
