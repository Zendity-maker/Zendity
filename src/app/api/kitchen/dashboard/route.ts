import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const hqId = searchParams.get('hqId') || (session.user as any).headquartersId;

        const [activePatients, hospitalPatients, observations, todayMenu] = await Promise.all([
            prisma.patient.findMany({
                where: { headquartersId: hqId!, status: 'ACTIVE' },
                select: { id: true, name: true, roomNumber: true, diet: true, colorGroup: true },
                orderBy: { name: 'asc' }
            }),
            prisma.patient.findMany({
                where: { headquartersId: hqId!, status: 'TEMPORARY_LEAVE', leaveType: 'HOSPITAL' },
                select: { id: true, name: true, roomNumber: true }
            }),
            prisma.kitchenObservation.findMany({
                where: { headquartersId: hqId! },
                include: { supervisor: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 20
            }),
            prisma.dailyMenu.findFirst({
                where: {
                    headquartersId: hqId!,
                    date: {
                        gte: todayStartAST(),
                        lt: new Date(new Date().setHours(23, 59, 59, 999))
                    }
                }
            })
        ]);

        // KPI del cocinero — últimos 14 días
        const last14Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const recentObs = observations.filter(o => new Date(o.createdAt) >= last14Days);
        const avgScore = recentObs.length > 0
            ? Math.round((recentObs.reduce((sum, o) => sum + o.satisfactionScore, 0) / recentObs.length) * 10) / 10
            : null;
        const positiveCount = recentObs.filter(o => o.feedbackType === 'POSITIVE').length;
        const negativeCount = recentObs.filter(o => o.feedbackType === 'NEGATIVE').length;
        const unreadCount = observations.filter(o => !o.isRead).length;

        const lastFeedbackDaysAgo = observations.length > 0
            ? Math.floor((Date.now() - new Date(observations[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        return NextResponse.json({
            success: true,
            activePatients,
            hospitalPatients,
            observations,
            todayMenu,
            kpi: {
                avgScore,
                positiveCount,
                negativeCount,
                unreadCount,
                lastFeedbackDaysAgo,
                needsReminder: lastFeedbackDaysAgo >= 2
            }
        });
    } catch (error: any) {
        console.error('Kitchen dashboard error:', error);
        return NextResponse.json({ error: 'Error cargando dashboard' }, { status: 500 });
    }
}
