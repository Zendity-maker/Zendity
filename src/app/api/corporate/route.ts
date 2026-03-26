import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';



export async function GET(request: NextRequest) {
  try {
    const hqId = request.nextUrl.searchParams.get('hqId');

    // 1. Obtener todas las sedes activas
    const allHqs = await prisma.headquarters.findMany({
      include: {
        patients: {
          where: {
            status: { notIn: ['DISCHARGED', 'DECEASED'] }
          },
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

    // Filtrar sedes para cálculos
    const hqs = (hqId && hqId !== 'ALL') ? allHqs.filter((h: any) => h.id === hqId) : allHqs;

    // 3. Generar el arreglo para la tabla Ranking de Desempeño
    const rankingData = hqs.map((hq: any) => {
      totalCapacity += hq.capacity || 50;

      const hqPatients = hq.patients.length;
      totalPatients += hqPatients;

      const hqCriticalIncidents = hq.incidents.filter((inc: any) => inc.severity === 'CRITICAL' || inc.severity === 'HIGH').length;
      totalCriticalIncidents += hqCriticalIncidents;

      // Calcular promedios (Dummy logic si no hay datos)
      const avgEmpScore = hq.evals.length > 0
        ? Math.round(hq.evals.reduce((acc: any, ev: any) => acc + ev.score, 0) / hq.evals.length)
        : 85; // Default score si no hay evaluaciones

      const avgFamSat = hq.surveys.length > 0
        ? Math.round((hq.surveys.reduce((acc: any, sv: any) => acc + sv.ratingCare + sv.ratingClean + sv.ratingHealth, 0) / (hq.surveys.length * 3)) * 20) // a escala de 100
        : 90; // Default score si no hay encuestas completadas

      // Calcular cumplimiento eMAR (FASE 10)
      let hqMedsGiven = 0;
      let hqMedsScheduled = 0;

      hq.patients.forEach((patient: any) => {
        patient.medications.forEach((pm: any) => {
          pm.administrations.forEach((admin: any) => {
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
      facilities: allHqs.map((hq: any) => ({ id: hq.id, name: hq.name }))
    });

  } catch (error) {
    console.error("Error fetching corporate data:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
