import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';

export async function GET(req: Request, { params }: any) {
    try {
        const { userId } = await params;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
        }

        // Ventana rodante de 7 días (FIX: antes era 30 días, acumulativo)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        let kpis: Record<string, any> = {};

        // Base Trust Score is direct from User
        const trustScore = user.complianceScore || 100;

        // ============================================
        // 1. CUIDADORES (Caregivers) KPIs
        // ============================================
        if (user.role === Role.CAREGIVER) {
            // ADL Completion Rate (Baños + Comidas)
            const sevenDaysBath = await prisma.bathLog.count({
                where: { caregiverId: userId, timeLogged: { gte: sevenDaysAgo } }
            });
            const sevenDaysMeal = await prisma.mealLog.count({
                where: { caregiverId: userId, timeLogged: { gte: sevenDaysAgo } }
            });
            // Total ADLs as Volume
            const adlVolume = sevenDaysBath + sevenDaysMeal;

            // Handover Punctuality (HandoverCompleted en ShiftSession vs Total)
            const totalShifts = await prisma.shiftSession.count({
                where: { caregiverId: userId, startTime: { gte: sevenDaysAgo } }
            });
            const completedHandovers = await prisma.shiftSession.count({
                where: { caregiverId: userId, handoverCompleted: true, startTime: { gte: sevenDaysAgo } }
            });

            const handoverRate = totalShifts === 0 ? 100 : Math.round((completedHandovers / totalShifts) * 100);

            // Early Warning Rate (Clinical Alerts raised)
            const earlyWarnings = await prisma.dailyLog.count({
                where: { authorId: userId, isClinicalAlert: true, createdAt: { gte: sevenDaysAgo } }
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
                where: { administeredById: userId, administeredAt: { gte: sevenDaysAgo } }
            });
            const omittedMeds = await prisma.medicationAdministration.count({
                where: { administeredById: userId, status: 'OMITTED', administeredAt: { gte: sevenDaysAgo } }
            });

            const emarAccuracy = totalMeds === 0 ? 100 : Math.round(((totalMeds - omittedMeds) / totalMeds) * 100);

            // Clinical Notes Consistency
            const clinicalNotes = await prisma.medicationAuditLog.count({
                where: { authorId: userId, createdAt: { gte: sevenDaysAgo } }
            });

            // Turnaround de Relevos Cero-Errores
            const totalHandoversGiven = await prisma.shiftHandover.count({
                where: { outgoingNurseId: userId, createdAt: { gte: sevenDaysAgo } }
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
                where: { type: 'INFRASTRUCTURE', status: 'RESOLVED', startTime: { gte: sevenDaysAgo } }
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
            period: "Últimos 7 Días"
        });

    } catch (error) {
        console.error("Performance Engine Error:", error);
        return NextResponse.json({ success: false, error: "Error calculando métricas de rendimiento" }, { status: 500 });
    }
}
