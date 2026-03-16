import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ error: "Sede inválida" }, { status: 400 });
        }

        // 1. Fetch Staff with low compliance scores
        const lowScoreStaff = await prisma.user.findMany({
            where: {
                headquartersId: hqId,
                complianceScore: { lt: 80 },
                isDeleted: false,
                role: { in: ['CAREGIVER', 'NURSE', 'KITCHEN', 'SOCIAL_WORKER', 'MAINTENANCE'] }
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

        // 3. Compile "Red Flags"
        const insights: any[] = [];

        // Add Red Flags for Low Score Staff
        lowScoreStaff.forEach(staff => {
            insights.push({
                id: `compliance_risk_${staff.id}`,
                type: 'CRITICAL',
                category: 'STAFF_COMPLIANCE',
                title: 'Bajo Rendimiento Crítico',
                description: `El score de ${staff.name} (${staff.role}) ha caído a ${staff.complianceScore} pts. Esto representa un riesgo operacional y de certificación activa.`,
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

        return NextResponse.json({ 
            success: true, 
            insights: insights.sort((a,b) => b.type === 'CRITICAL' ? -1 : 1) // Critical first
        });

    } catch (error) {
        console.error("AI Insights Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
