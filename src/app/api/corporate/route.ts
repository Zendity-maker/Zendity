import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqIdOrAll } from '@/lib/hq-resolver';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN']; // pueden ver 'ALL' y alternar entre sedes

export async function GET(request: NextRequest) {
  try {
    // ── Seguridad ──
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const role = (session.user as any).role;
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
    }
    const sessionHqId = (session.user as any).headquartersId;
    if (!sessionHqId) {
      return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
    }

    // ── Resolución de hqId según rol (via hq-resolver) ──
    const requestedHqId = request.nextUrl.searchParams.get('hqId');
    let effectiveHqId: string | 'ALL';
    try {
      effectiveHqId = await resolveEffectiveHqIdOrAll(session, requestedHqId);
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
    }

    // ── Query de sedes ──
    // DIRECTOR/ADMIN → todas las sedes (para popular el selector).
    // SUPERVISOR → SOLO su propia sede.
    const allHqs = await prisma.headquarters.findMany({
      where: MULTI_HQ_ROLES.includes(role) ? {} : { id: sessionHqId },
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

    // Filtrar sedes para cálculos según la sede efectiva seleccionada
    const hqs = (effectiveHqId && effectiveHqId !== 'ALL')
      ? allHqs.filter((h: any) => h.id === effectiveHqId)
      : allHqs;

    // ── Procesamiento de KPIs y ranking ──
    let totalPatients = 0;
    let totalCriticalIncidents = 0;
    let totalGlobalMedsGiven = 0;
    let totalGlobalMedsScheduled = 0;
    let totalCapacity = 0;
    let capacityKnown = false;

    const rankingData = hqs.map((hq: any) => {
      // Capacity: usar el valor real sin default. Si es 0/null, queda null.
      const capacityRaw: number | null = (typeof hq.capacity === 'number' && hq.capacity > 0) ? hq.capacity : null;
      if (capacityRaw !== null) {
        totalCapacity += capacityRaw;
        capacityKnown = true;
      }

      const hqPatients = hq.patients.length;
      totalPatients += hqPatients;

      const hqCriticalIncidents = hq.incidents.filter((inc: any) => inc.severity === 'CRITICAL' || inc.severity === 'HIGH').length;
      totalCriticalIncidents += hqCriticalIncidents;

      // Score promedio de empleados — null si no hay evals (ya no usamos 85 de default)
      const empScore: number | null = hq.evals.length > 0
        ? Math.round(hq.evals.reduce((acc: any, ev: any) => acc + ev.score, 0) / hq.evals.length)
        : null;

      // Satisfacción familiar — null si no hay surveys (ya no usamos 90)
      const famSatisfaction: number | null = hq.surveys.length > 0
        ? Math.round((hq.surveys.reduce((acc: any, sv: any) => acc + sv.ratingCare + sv.ratingClean + sv.ratingHealth, 0) / (hq.surveys.length * 3)) * 20)
        : null;

      // Cumplimiento eMAR
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

      // medsCompliance — null si no hay administraciones programadas
      const medsCompliance: number | null = hqMedsScheduled > 0
        ? Math.round((hqMedsGiven / hqMedsScheduled) * 100)
        : null;

      return {
        id: hq.id,
        facility: hq.name,
        capacity: capacityRaw,
        empScore,
        famSatisfaction,
        medsCompliance
      };
    });

    // Ordenar por empScore (nulls al final)
    rankingData.sort((a, b) => {
      if (a.empScore === null && b.empScore === null) return 0;
      if (a.empScore === null) return 1;
      if (b.empScore === null) return -1;
      return b.empScore - a.empScore;
    });
    const rankedDataWithPosition = rankingData.map((data, index) => ({ ...data, rank: index + 1 }));

    // globalMedCompliance — null si no hay data agregada
    const globalMedCompliance: number | null = totalGlobalMedsScheduled > 0
      ? Number(((totalGlobalMedsGiven / totalGlobalMedsScheduled) * 100).toFixed(1))
      : null;

    const kpis = {
      activeHqs: hqs.length,
      totalCapacity: capacityKnown ? totalCapacity : null,
      totalPatients,
      totalCriticalIncidents,
      globalMedCompliance
    };

    return NextResponse.json({
      success: true,
      kpis,
      ranking: rankedDataWithPosition,
      facilities: allHqs.map((hq: any) => ({ id: hq.id, name: hq.name })),
      effectiveHqId,
      canSelectFacility: MULTI_HQ_ROLES.includes(role),
    });

  } catch (error) {
    console.error("Error fetching corporate data:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
