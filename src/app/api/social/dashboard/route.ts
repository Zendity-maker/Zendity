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
            activeResidents,
            allVisits,
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
            // For overdue specialists calculation
            prisma.patient.findMany({ where: { headquartersId: hqId, status: 'ACTIVE' }, select: { id: true, name: true } }),
            prisma.specialistVisit.findMany({ where: { headquartersId: hqId }, orderBy: { visitDate: 'desc' } }),
        ]);

        // Calculate overdue specialists: for each active resident, find specialist types
        // where the last visit was more than 90 days ago
        const SPECIALIST_TYPES = ['DOCTOR', 'PODIATRIST', 'PSYCHOLOGIST', 'DENTIST', 'PSYCHIATRIST'];
        const overdueSpecialists: { patient: { id: string; name: string }; specialistType: string; lastVisit: Date | null; daysSince: number }[] = [];

        for (const patient of activeResidents) {
            const patientVisits = allVisits.filter(v => v.patientId === patient.id);
            for (const specType of SPECIALIST_TYPES) {
                const lastVisit = patientVisits.find(v => v.specialistType === specType);
                if (!lastVisit) {
                    // Never visited — flag as overdue
                    overdueSpecialists.push({ patient, specialistType: specType, lastVisit: null, daysSince: 999 });
                } else {
                    const daysSince = Math.floor((now.getTime() - new Date(lastVisit.visitDate).getTime()) / 86400000);
                    if (daysSince > 90) {
                        overdueSpecialists.push({ patient, specialistType: specType, lastVisit: lastVisit.visitDate, daysSince });
                    }
                }
            }
        }

        // Sort overdue: most overdue first, skip "never visited" unless we want them
        const sortedOverdue = overdueSpecialists
            .filter(o => o.daysSince < 999) // Only show those that had at least one visit
            .sort((a, b) => b.daysSince - a.daysSince)
            .slice(0, 20);

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
