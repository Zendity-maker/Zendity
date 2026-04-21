import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

export async function GET() {
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

        // EmployeeEvaluation SOLO de la sede del usuario
        const evaluations = await prisma.employeeEvaluation.findMany({
            where: { headquartersId: hqId },
            include: { employee: true, headquarters: true },
            orderBy: { createdAt: 'asc' }
        });

        // 1. Datos para Recharts (Línea de Tiempo Mensual Multi-Sede)
        const monthlyDataMap: Record<string, any> = {};
        const headquartersSet = new Set<string>();

        evaluations.forEach(ev => {
            const hqName = ev.headquarters.name;
            headquartersSet.add(hqName);

            // Obtener mes y año (Ej: "Feb 2026")
            const date = new Date(ev.createdAt);
            const monthKey = date.toLocaleString('es-ES', { month: 'short', year: 'numeric' });

            if (!monthlyDataMap[monthKey]) {
                monthlyDataMap[monthKey] = { name: monthKey };
            }

            if (!monthlyDataMap[monthKey][`${hqName}_sum`]) {
                monthlyDataMap[monthKey][`${hqName}_sum`] = 0;
                monthlyDataMap[monthKey][`${hqName}_count`] = 0;
            }

            monthlyDataMap[monthKey][`${hqName}_sum`] += ev.score;
            monthlyDataMap[monthKey][`${hqName}_count`] += 1;
        });

        // Promediar los meses
        const chartData = Object.values(monthlyDataMap).map(item => {
            const formattedItem: any = { name: item.name };
            headquartersSet.forEach(hq => {
                if (item[`${hq}_count`]) {
                    formattedItem[hq] = Math.round(item[`${hq}_sum`] / item[`${hq}_count`]);
                }
            });
            return formattedItem;
        });

        // 2. Leaderboard: Empleados y sus Tendencias (UP, DOWN, STABLE)
        const employeeStatsMap: Record<string, { name: string, role: string, hq: string, photoUrl: string | null, scores: number[] }> = {};

        evaluations.forEach(ev => {
            const empId = ev.employeeId;
            if (!employeeStatsMap[empId]) {
                employeeStatsMap[empId] = {
                    name: ev.employee.name,
                    role: ev.employee.role,
                    hq: ev.headquarters.name,
                    photoUrl: (ev.employee as any).photoUrl || null,
                    scores: []
                };
            }
            // Insertar asumiendo orden ascendente chronologico
            employeeStatsMap[empId].scores.push(ev.score);
        });

        const leaderboard = Object.values(employeeStatsMap).map(emp => {
            const numScores = emp.scores.length;
            const currentScore = numScores > 0 ? emp.scores[numScores - 1] : 0;
            let trend = 'STABLE';

            if (numScores >= 2) {
                const prevScore = emp.scores[numScores - 2];
                const diff = currentScore - prevScore;
                if (diff >= 5) trend = 'UP';
                else if (diff <= -5) trend = 'DOWN';
            }

            return {
                name: emp.name,
                role: emp.role,
                hq: emp.hq,
                photoUrl: emp.photoUrl,
                currentScore,
                trend
            };
        });

        // Ordenar Leaderboard: Los de tendencia DOWN primero (para llamar atención del CEO)
        leaderboard.sort((a, b) => {
            if (a.trend === 'DOWN' && b.trend !== 'DOWN') return -1;
            if (b.trend === 'DOWN' && a.trend !== 'DOWN') return 1;
            return b.currentScore - a.currentScore;
        });

        // 3. Promedio GLOBAL real (sobre todas las evaluaciones, no solo HQ[0])
        const allScores = evaluations.map(e => e.score);
        const globalAvg = allScores.length > 0
            ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
            : 0;

        // 4. Occupancy & Clinical Risk Heatmap (FASE 67 Predictive Analytics)
        // Solo la sede del usuario (no cross-tenant)
        const headquartersAll = await prisma.headquarters.findMany({
            where: { id: hqId },
            select: { id: true, name: true, capacity: true }
        });
        const activePatients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { notIn: ['DISCHARGED', 'DECEASED'] }
            },
            select: { id: true, name: true, roomNumber: true, downtonRisk: true, headquartersId: true }
        });

        const occupancyData = headquartersAll.map(hq => {
            const installed = activePatients.filter(p => p.headquartersId === hq.id).length;
            const rate = hq.capacity > 0 ? Math.round((installed / hq.capacity) * 100) : 0;
            return {
                hqId: hq.id,
                hqName: hq.name,
                capacity: hq.capacity,
                installed,
                rate
            };
        });

        // Heatmap: Patients with High Fall Risk
        const clinicalRisk = activePatients
            .filter(p => p.downtonRisk)
            .map(p => {
                const hq = headquartersAll.find(h => h.id === p.headquartersId);
                return {
                    id: p.id,
                    name: p.name,
                    room: p.roomNumber,
                    hqName: hq ? hq.name : "Desconocido"
                };
            });

        return NextResponse.json({
            success: true,
            chartData,
            leaderboard,
            headquarters: Array.from(headquartersSet),
            globalAvg,
            occupancyData,
            clinicalRisk
        });

    } catch (error) {
        console.error("Error generating insights:", error);
        return NextResponse.json({ success: false, error: "Failed to load BI data" }, { status: 500 });
    }
}
