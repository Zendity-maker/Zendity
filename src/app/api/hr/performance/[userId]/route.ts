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
        // ============================================
        // 1. CUIDADORES (Caregivers) KPIs — Turno de Guardia
        // ============================================
        if (user.role === Role.CAREGIVER) {

            // ── Grupo de color del cuidador (ResidentGroup) ──────────────────
            // Se determina por el colorGroup mayoritario de los pacientes que atendió
            // o por la última asignación en ShiftColorAssignment
            const lastColorAssignment = await prisma.shiftColorAssignment.findFirst({
                where: { userId },
                orderBy: { assignedAt: 'desc' },
                select: { color: true }
            });
            const myColor = lastColorAssignment?.color ?? null;

            // Residentes de su grupo de color
            const groupPatients = myColor
                ? await prisma.patient.findMany({
                    where: { headquartersId: user.headquartersId!, status: 'ACTIVE', colorGroup: myColor as any },
                    select: { id: true }
                })
                : [];
            const groupSize = groupPatients.length;
            const groupPatientIds = groupPatients.map(p => p.id);

            // ── KPI 1: Cobertura de Ronda (últimos 7 días) ───────────────────
            // % de residentes del grupo que recibieron al menos 1 atención
            let uniqueAttended = 0;
            let roundCoverage = groupSize > 0 ? 0 : 100; // si no hay grupo asignado → n/a

            if (groupSize > 0) {
                const [bathPatients, mealPatients, rotationPatients, logPatients] = await Promise.all([
                    prisma.bathLog.findMany({
                        where: { caregiverId: userId, patientId: { in: groupPatientIds }, timeLogged: { gte: sevenDaysAgo } },
                        select: { patientId: true }, distinct: ['patientId']
                    }),
                    prisma.mealLog.findMany({
                        where: { caregiverId: userId, patientId: { in: groupPatientIds }, timeLogged: { gte: sevenDaysAgo } },
                        select: { patientId: true }, distinct: ['patientId']
                    }),
                    prisma.posturalChangeLog.findMany({
                        where: { nurseId: userId, patientId: { in: groupPatientIds }, performedAt: { gte: sevenDaysAgo } },
                        select: { patientId: true }, distinct: ['patientId']
                    }),
                    prisma.dailyLog.findMany({
                        where: { authorId: userId, patientId: { in: groupPatientIds }, createdAt: { gte: sevenDaysAgo } },
                        select: { patientId: true }, distinct: ['patientId']
                    }),
                ]);

                const attendedSet = new Set([
                    ...bathPatients.map(r => r.patientId),
                    ...mealPatients.map(r => r.patientId),
                    ...rotationPatients.map(r => r.patientId),
                    ...logPatients.map(r => r.patientId),
                ]);
                uniqueAttended = attendedSet.size;
                roundCoverage = Math.round((uniqueAttended / groupSize) * 100);
            }

            // ── KPI 2: Densidad de Atención ───────────────────────────────────
            // Total de interacciones ÷ residentes del grupo → cuán profunda es la ronda
            const [totalBaths, totalMeals, totalRotations, totalLogs] = await Promise.all([
                prisma.bathLog.count({ where: { caregiverId: userId, timeLogged: { gte: sevenDaysAgo } } }),
                prisma.mealLog.count({ where: { caregiverId: userId, timeLogged: { gte: sevenDaysAgo } } }),
                prisma.posturalChangeLog.count({ where: { nurseId: userId, performedAt: { gte: sevenDaysAgo } } }),
                prisma.dailyLog.count({ where: { authorId: userId, createdAt: { gte: sevenDaysAgo } } }),
            ]);
            const totalInteractions = totalBaths + totalMeals + totalRotations + totalLogs;
            const attentionDensity = groupSize > 0
                ? Math.round((totalInteractions / groupSize) * 10) / 10
                : totalInteractions;

            // ── KPI 3: Cierre de Turno (Handover Rate) ───────────────────────
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const [totalShifts, completedHandovers] = await Promise.all([
                prisma.shiftSession.count({
                    where: { caregiverId: userId, startTime: { gte: sevenDaysAgo, lt: todayStart } }
                }),
                prisma.shiftSession.count({
                    where: { caregiverId: userId, handoverCompleted: true, startTime: { gte: sevenDaysAgo, lt: todayStart } }
                }),
            ]);
            const handoverRate = totalShifts === 0 ? 100 : Math.round((completedHandovers / totalShifts) * 100);

            // ── KPI 4: Rotaciones a Tiempo ────────────────────────────────────
            const [rotOnTime, rotLate] = await Promise.all([
                prisma.posturalChangeLog.count({ where: { nurseId: userId, isComplianceAlert: false, performedAt: { gte: sevenDaysAgo } } }),
                prisma.posturalChangeLog.count({ where: { nurseId: userId, isComplianceAlert: true, performedAt: { gte: sevenDaysAgo } } }),
            ]);
            const totalRot = rotOnTime + rotLate;
            const rotationTimeliness = totalRot === 0 ? 100 : Math.round((rotOnTime / totalRot) * 100);

            // ── KPI 5: Alertas Tempranas (Proactividad Clínica) ──────────────
            const earlyWarnings = await prisma.dailyLog.count({
                where: { authorId: userId, isClinicalAlert: true, createdAt: { gte: sevenDaysAgo } }
            });

            kpis = {
                trustScore,
                // Ronda
                roundCoverage,           // % residentes del grupo atendidos
                groupSize,               // total residentes en su grupo
                uniqueAttended,          // residentes únicos con atención registrada
                colorGroup: myColor,     // su grupo (RED/YELLOW/BLUE)
                // Profundidad
                attentionDensity,        // interacciones promedio por residente
                totalInteractions,       // total de toques registrados en 7d
                // Turno
                handoverRate,            // % turnos con cierre completo
                totalShifts,
                completedHandovers,
                // Calidad clínica
                rotationTimeliness,      // % rotaciones a tiempo
                totalRotations: totalRot,
                earlyWarnings,
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
