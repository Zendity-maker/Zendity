import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener todas las sedes activas
    const hqs = await prisma.headquarters.findMany({
      include: {
        patients: {
          include: {
            medications: {
              include: { administrations: true }
            }
          }
        },
        incidents: true,
        evals: true,
        surveys: true,
      }
    });

    // 2. Procesar los datos para las tarjetas de KPIs
    let totalPatients = 0;
    let totalCriticalIncidents = 0;
    let totalGlobalMedsGiven = 0;
    let totalGlobalMedsScheduled = 0;
    let totalCapacity = 0;

    // 3. Generar el arreglo para la tabla Ranking de Desempeño
    const rankingData = hqs.map(hq => {
      totalCapacity += hq.capacity || 50;

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

      // Calcular cumplimiento eMAR (FASE 10)
      let hqMedsGiven = 0;
      let hqMedsScheduled = 0;

      hq.patients.forEach(patient => {
        patient.medications.forEach(pm => {
          pm.administrations.forEach(admin => {
            hqMedsScheduled++;
            if (admin.status === 'ADMINISTERED') {
              hqMedsGiven++;
            }
          });
        });
      });

      totalGlobalMedsGiven += hqMedsGiven;
      totalGlobalMedsScheduled += hqMedsScheduled;

      const medsCompliance = hqMedsScheduled > 0 
        ? Math.round((hqMedsGiven / hqMedsScheduled) * 100)
        : 100; // Por defecto 100% si no hay medicaciones

      return {
        id: hq.id,
        facility: hq.name,
        empScore: avgEmpScore,
        famSatisfaction: avgFamSat,
        medsCompliance: medsCompliance
      };
    });

    // Ordenar por score de empleados descendente para armar el leaderboard
    rankingData.sort((a, b) => b.empScore - a.empScore);
    const rankedDataWithPosition = rankingData.map((data, index) => ({ ...data, rank: index + 1 }));

    // 4. Formatear la Respuesta
    const globalMedCompliance = totalGlobalMedsScheduled > 0 
      ? Number(((totalGlobalMedsGiven / totalGlobalMedsScheduled) * 100).toFixed(1))
      : 100;

    const kpis = {
      activeHqs: hqs.length,
      totalCapacity: totalCapacity,
      totalPatients,
      totalCriticalIncidents,
      globalMedCompliance: globalMedCompliance
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
