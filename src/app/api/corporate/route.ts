import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener todas las sedes activas
    const hqs = await prisma.headquarters.findMany({
      include: {
        patients: true,
        incidents: true,
        evals: true,
        surveys: true,
      }
    });

    // 2. Procesar los datos para las tarjetas de KPIs
    let totalPatients = 0;
    let totalCriticalIncidents = 0;

    // 3. Generar el arreglo para la tabla Ranking de Desempeño
    const rankingData = hqs.map(hq => {
      const hqPatients = hq.patients.length;
      totalPatients += hqPatients;

      const hqCriticalIncidents = hq.incidents.filter(inc => inc.severity === 'CRITICAL' || inc.severity === 'HIGH').length;
      totalCriticalIncidents += hqCriticalIncidents;

      // Calcular promedios (Dummy logic si no hay datos)
      const avgEmpScore = hq.evals.length > 0
        ? Math.round(hq.evals.reduce((acc, ev) => acc + ev.score, 0) / hq.evals.length)
        : 85; // Default score si no hay evaluaciones

      const avgFamSat = hq.surveys.length > 0
        ? Math.round((hq.surveys.reduce((acc, sv) => acc + sv.ratingCare + sv.ratingClean + sv.ratingHealth, 0) / (hq.surveys.length * 3)) * 20) // a escala de 100
        : 90; // Default score si no hay encuestas completadas

      return {
        id: hq.id,
        facility: hq.name,
        empScore: avgEmpScore,
        famSatisfaction: avgFamSat,
        medsCompliance: 100 // Hardcoded temporal hasta crear tracking estricto ratio tiempo/dosis
      };
    });

    // Ordenar por score de empleados descendente para armar el leaderboard
    rankingData.sort((a, b) => b.empScore - a.empScore);
    const rankedDataWithPosition = rankingData.map((data, index) => ({ ...data, rank: index + 1 }));

    // 4. Formatear la Respuesta
    const kpis = {
      activeHqs: hqs.length,
      totalCapacity: hqs.length * 50, // asumido 50 por hogar en MVP
      totalPatients,
      totalCriticalIncidents,
      globalMedCompliance: 98.5 // Simulación temporal de eficacia general
    };

    return NextResponse.json({
      kpis,
      ranking: rankedDataWithPosition,
      facilities: hqs.map(hq => ({ id: hq.id, name: hq.name }))
    });

  } catch (error) {
    console.error("Error fetching corporate data:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
