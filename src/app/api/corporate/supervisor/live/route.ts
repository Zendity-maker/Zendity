import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Evitamos que Next.js cachee esta ruta estáticamente para que siempre traiga data fresca.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ success: false, error: "headquartersId is required" }, { status: 400 });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 1. Cuidadores Activos (Turnos Abiertos)
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: todayStart }
            },
            include: { caregiver: true }
        });

        // 2. Progreso de Baños de Hoy
        const bathsToday = await prisma.bathLog.count({
            where: {
                timeLogged: { gte: todayStart },
                patient: { headquartersId: hqId }
            }
        });

        // 3. Progreso de Comidas de Hoy (Agrupadas por tipo)
        const mealsToday = await prisma.mealLog.groupBy({
            by: ['mealType'],
            where: {
                timeLogged: { gte: todayStart },
                patient: { headquartersId: hqId }
            },
            _count: { mealType: true }
        });

        // 4. Incidentes Clínicos de Hoy
        const incidentsToday = await prisma.incident.count({
            where: {
                headquartersId: hqId,
                reportedAt: { gte: todayStart }
            }
        });

        // 5. Quejas Pendientes de Triaje
        const pendingComplaintsList = await prisma.complaint.findMany({
            where: {
                headquartersId: hqId,
                status: 'PENDING'
            },
            include: { patient: true },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json({
            success: true,
            activeCaregivers: activeSessions.length,
            liveStats: {
                baths: bathsToday,
                meals: mealsToday.reduce((acc, curr) => ({ ...acc, [curr.mealType]: curr._count.mealType }), {}),
                incidents: incidentsToday,
                triageInbox: pendingComplaintsList.length
            },
            activeSessions,
            pendingComplaints: pendingComplaintsList
        });

    } catch (error) {
        console.error("Live Supervisor Sync Error:", error);
        return NextResponse.json({ success: false, error: "Error obteniendo telemetría en vivo" }, { status: 500 });
    }
}
