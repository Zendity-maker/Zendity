import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, subDays } from 'date-fns';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId') || (session.user as any).headquartersId;

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'hqId requerido' }, { status: 400 });
        }

        const now = new Date();
        const sixtyDaysFromNow = new Date(Date.now() + 60 * 86400000);
        const sevenDaysAgo = startOfDay(subDays(now, 7));
        const ninetyDaysAgo = subDays(now, 90);

        // All queries in parallel
        const [
            pendingTasks,
            expiringBenefits,
            recentNotes,
            totalActiveResidents,
            tasksCompletedThisWeek,
            totalPendingTasks,
            benefitsExpiringSoonCount,
        ] = await Promise.all([
            // Pending tasks with patient info
            prisma.socialWorkTask.findMany({
                where: { headquartersId: hqId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
                include: {
                    patient: { select: { id: true, name: true, roomNumber: true } },
                    createdBy: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true } },
                },
                orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
            }),
            // Benefits expiring within 60 days
            prisma.socialWorkBenefit.findMany({
                where: {
                    headquartersId: hqId,
                    status: 'ACTIVE',
                    expirationDate: { gte: now, lte: sixtyDaysFromNow },
                },
                include: { patient: { select: { id: true, name: true } } },
                orderBy: { expirationDate: 'asc' },
            }),
            // Recent notes
            prisma.socialWorkNote.findMany({
                where: { headquartersId: hqId },
                include: {
                    patient: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            // Stats
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
        console.error('Social Dashboard GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando dashboard social' }, { status: 500 });
    }
}
