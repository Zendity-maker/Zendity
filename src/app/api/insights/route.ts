import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const evaluations = await prisma.employeeEvaluation.findMany({
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
        const employeeStatsMap: Record<string, { name: string, role: string, hq: string, scores: number[] }> = {};

        evaluations.forEach(ev => {
            const empId = ev.employeeId;
            if (!employeeStatsMap[empId]) {
                employeeStatsMap[empId] = {
                    name: ev.employee.name,
                    role: ev.employee.role,
                    hq: ev.headquarters.name,
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

        // 3. Occupancy & Clinical Risk Heatmap (FASE 67 Predictive Analytics)
        const headquartersAll = await prisma.headquarters.findMany({ select: { id: true, name: true, capacity: true } });
        const activePatients = await prisma.patient.findMany({
            where: { status: { not: "DISCHARGED" } },
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
            occupancyData,
            clinicalRisk
        });

    } catch (error) {
        console.error("Error generating insights:", error);
        return NextResponse.json({ success: false, error: "Failed to load BI data" }, { status: 500 });
    }
}
