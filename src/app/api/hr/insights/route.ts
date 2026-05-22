import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function GET(_req: Request) {
    try {
        // ── Seguridad (tenant + rol) ──
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        // 1. Fetch Staff con compliance bajo el rango neutral (< 75)
        //
        // Bandas oficiales del sistema:
        //   ≥ 90       verde — excelente
        //   75-89      ámbar — área de mejora (NO se alerta)
        //   60-74      naranja — bajo rendimiento (warning MEDIUM)
        //   < 60       rojo — riesgo operacional (CRITICAL)
        //
        // Excluye staff con menos de 7 días en el sistema — un empleado
        // recién creado arranca en 75 y todavía no tiene actividad para
        // que el cron lo mueva arriba. Alertar de él sería falso positivo.
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const lowScoreStaff = await prisma.user.findMany({
            where: {
                headquartersId: hqId,
                complianceScore: { lt: 75 },
                createdAt: { lt: sevenDaysAgo },
                isDeleted: false,
                isActive: true,
                role: { in: ['CAREGIVER', 'NURSE', 'KITCHEN', 'SOCIAL_WORKER', 'MAINTENANCE', 'CLEANING'] }
            },
            select: { id: true, name: true, role: true, complianceScore: true }
        });

        // 2. Fetch recent Incidents (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentIncidents = await prisma.incidentReport.findMany({
            where: {
                headquartersId: hqId,
                createdAt: { gte: thirtyDaysAgo }
            },
            include: {
                employee: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 3a. Cargar dismissals activos (< 24h) para filtrar banderas suprimidas
        const now = new Date();
        const activeDismissals = await prisma.insightDismissal.findMany({
            where: { headquartersId: hqId, expiresAt: { gt: now } },
            select: { insightType: true },
        });
        const dismissedSet = new Set(activeDismissals.map((d: { insightType: string }) => d.insightType));

        // 3. Compile "Red Flags"
        const insights: any[] = [];

        // Add Red Flags for Low Score Staff — dos tiers según severidad
        lowScoreStaff.forEach(staff => {
            const score = staff.complianceScore;
            const isCritical = score < 60;
            insights.push({
                id: `compliance_risk_${staff.id}`,
                type: isCritical ? 'CRITICAL' : 'MEDIUM',
                category: 'STAFF_COMPLIANCE',
                title: isCritical ? 'Bajo Rendimiento Crítico' : 'Rendimiento Bajo',
                description: isCritical
                    ? `El score de ${staff.name} (${staff.role}) está en ${score} pts. Representa un riesgo operacional — revisión urgente recomendada.`
                    : `El score de ${staff.name} (${staff.role}) está en ${score} pts, por debajo del rango neutral (75). Conviene revisar rondas, observaciones y completitud de Academy.`,
                employeeId: staff.id,
                employeeName: staff.name,
                employeeRole: staff.role,
                timestamp: new Date().toISOString()
            });
        });

        // Add Insights based on repeated incidents
        const incidentCounts: Record<string, number> = {};
        recentIncidents.forEach(inc => {
            if (inc.employee) {
                incidentCounts[inc.employee.id] = (incidentCounts[inc.employee.id] || 0) + 1;
                
                // If it's a recent suspension/termination
                if (inc.type === 'SUSPENSION' || inc.type === 'TERMINATION') {
                     insights.push({
                        id: `severe_incident_${inc.id}`,
                        type: 'HIGH',
                        category: 'DISCIPLINARY',
                        title: `Acción Severa: ${inc.type === 'SUSPENSION' ? 'Suspensión' : 'Despido'}`,
                        description: `${inc.employee.name} recibió acción disciplinaria severa recientemente por parte de RRHH.`,
                        employeeId: inc.employee.id,
                        employeeName: inc.employee.name,
                        employeeRole: inc.employee.role,
                        timestamp: inc.createdAt.toISOString()
                    });
                }
            }
        });

        // Check for repeat offenders (2+ incidents in 30 days)
        for (const [empId, count] of Object.entries(incidentCounts)) {
            if (count >= 2) {
                const emp = recentIncidents.find(i => i.employee?.id === empId)?.employee;
                if (emp) {
                    insights.push({
                        id: `repeat_offender_${empId}`,
                        type: 'CRITICAL',
                        category: 'REPEAT_OFFENDER',
                        title: 'Comportamiento Problemático Recurrente',
                        description: `${emp.name} ha acumulado ${count} reportes disciplinarios en los últimos 30 días. Requiere revisión urgente.`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        employeeRole: emp.role,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        // Filtrar banderas suprimidas en las últimas 24h
        const visibleInsights = insights.filter(i => !dismissedSet.has(i.id));

        // Orden de severidad: CRITICAL → HIGH → MEDIUM
        const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        const sortedInsights = visibleInsights.sort(
            (a, b) => (severityOrder[a.type] ?? 99) - (severityOrder[b.type] ?? 99)
        );

        return NextResponse.json({
            success: true,
            insights: sortedInsights
        });

    } catch (error) {
        console.error("AI Insights Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
