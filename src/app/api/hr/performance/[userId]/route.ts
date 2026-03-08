import { NextResponse } from 'next/server';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: { userId: string } }) {
    try {
        const { userId } = await params;

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let kpis: Record<string, any> = {};

        // Base Trust Score is direct from User
        const trustScore = user.complianceScore || 100;

        // ============================================
        // 1. CUIDADORES (Caregivers) KPIs
        // ============================================
        if (user.role === Role.CAREGIVER) {
            // ADL Completion Rate (Baños + Comidas)
            const thirtyDaysBath = await prisma.bathLog.count({
                where: { caregiverId: userId, timeLogged: { gte: thirtyDaysAgo } }
            });
            const thirtyDaysMeal = await prisma.mealLog.count({
                where: { caregiverId: userId, timeLogged: { gte: thirtyDaysAgo } }
            });
            // Total ADLs as Volume
            const adlVolume = thirtyDaysBath + thirtyDaysMeal;

            // Handover Punctuality (HandoverCompleted en ShiftSession vs Total)
            const totalShifts = await prisma.shiftSession.count({
                where: { caregiverId: userId, startTime: { gte: thirtyDaysAgo } }
            });
            const completedHandovers = await prisma.shiftSession.count({
                where: { caregiverId: userId, handoverCompleted: true, startTime: { gte: thirtyDaysAgo } }
            });

            const handoverRate = totalShifts === 0 ? 100 : Math.round((completedHandovers / totalShifts) * 100);

            // Early Warning Rate (Clinical Alerts raised)
            const earlyWarnings = await prisma.dailyLog.count({
                where: { authorId: userId, isClinicalAlert: true, createdAt: { gte: thirtyDaysAgo } }
            });

            kpis = {
                trustScore,
                adlCompletionRate: adlVolume > 0 ? 95 : 0, // Mocked success rate, real volume is adlVolume
                adlVolume,
                handoverRate,
                earlyWarnings
            };
        }
        // ============================================
        // 2. ENFERMERÍA (Nurses) KPIs
        // ============================================
        else if (user.role === Role.NURSE || user.role === Role.SUPERVISOR || user.role === Role.DIRECTOR) {
            // eMAR Accuracy Score
            const totalMeds = await prisma.medicationAdministration.count({
                where: { administeredById: userId, administeredAt: { gte: thirtyDaysAgo } }
            });
            const omittedMeds = await prisma.medicationAdministration.count({
                where: { administeredById: userId, status: 'OMITTED', administeredAt: { gte: thirtyDaysAgo } }
            });

            const emarAccuracy = totalMeds === 0 ? 100 : Math.round(((totalMeds - omittedMeds) / totalMeds) * 100);

            // Clinical Notes Consistency
            const clinicalNotes = await prisma.medicationAuditLog.count({
                where: { authorId: userId, createdAt: { gte: thirtyDaysAgo } }
            });

            // Turnaround de Relevos Cero-Errores
            const totalHandoversGiven = await prisma.shiftHandover.count({
                where: { outgoingNurseId: userId, createdAt: { gte: thirtyDaysAgo } }
            });

            // Respuesta a Triage (Mocked Metric para UX)
            const triageResponseMins = 12;

            kpis = {
                trustScore,
                emarAccuracy,
                clinicalNotesVolume: clinicalNotes + totalMeds,
                handoverVolume: totalHandoversGiven,
                triageResponseMins
            };
        }
        // ============================================
        // 3. MANTENIMIENTO / OPERACIONES KPIs
        // ============================================
        else if (user.role === Role.MAINTENANCE) {
            // En fase actual Mantenimiento Tickets no tienen Assignee directo en DB aún, mapeamos como HeadquartersEvents genéricos o mock.
            const resolvedTickets = await prisma.headquartersEvent.count({
                where: { type: 'INFRASTRUCTURE', status: 'RESOLVED', startTime: { gte: thirtyDaysAgo } }
            });

            kpis = {
                trustScore,
                resolutionTimeHours: 3.5, // Mocked SLA
                workOrdersVolume: resolvedTickets,
                qualityCheckRate: 98,
                preventiveCompliance: 100
            };
        }
        // ============================================
        // OTROS ROLES (Fallback genérico)
        // ============================================
        else {
            kpis = {
                trustScore,
                activityPoints: 85,
                attendanceRate: 98
            };
        }

        // Return Data payload
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                complianceScore: user.complianceScore
            },
            kpis,
            period: "Últimos 30 Días"
        });

    } catch (error) {
        console.error("Performance Engine Error:", error);
        return NextResponse.json({ success: false, error: "Error calculando métricas de rendimiento" }, { status: 500 });
    }
}
