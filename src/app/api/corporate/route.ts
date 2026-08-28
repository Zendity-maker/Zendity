import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqIdOrAll } from '@/lib/hq-resolver';
import { calculateFacilityHealthScore } from '@/lib/facility-health';
import { ENROLLED_PATIENT_STATUSES } from '@/lib/billable-residents';
import { HrIncidentSeverity } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN']; // pueden ver 'ALL' y alternar entre sedes

// Severidades que cuentan como incidente serio para gerencia.
//
// Antes esto filtraba por 'CRITICAL' y 'HIGH' — valores que NO existen en el
// enum. El include devolvía `any`, así que TypeScript no lo atrapó y el KPI
// mostraba 0 siempre. Cupey tiene 83 incidentes reales, 22 de ellos serios, y
// el dashboard decía cero: un cero en "incidentes" se lee como buena noticia.
//
// Se usa el enum de Prisma para que un cambio de valores rompa la compilación
// en vez de volver a mentir en silencio.
const SEVERIDADES_SERIAS: HrIncidentSeverity[] = [
    HrIncidentSeverity.WARNING,
    HrIncidentSeverity.SUSPENSION,
    HrIncidentSeverity.TERMINATION,
];

// Las métricas de gestión miran un período, no toda la historia.
//
// Antes se promediaba TODO desde el primer día: el empScore de Cupey salía 70
// con el histórico completo y 73 mirando solo la mitad reciente. Un indicador
// que solo puede crecer no sirve para gestionar — si el equipo mejora este mes,
// el dashboard no se entera.
const DIAS_VENTANA = 30;

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
    //
    // NOTA DE ALCANCE: no existe un modelo de organización/cliente en el schema.
    // Las sedes viven en un espacio plano, así que "todas las sedes" hoy
    // significa literalmente todas las del sistema. Con un solo operador no se
    // nota; con dos clientes distintos en la misma base, cada DIRECTOR vería el
    // nombre de las sedes ajenas. Eso necesita decisión de producto (tenencia),
    // no un parche aquí — ver el reporte del 21-ago-2026.
    const allHqs = await prisma.headquarters.findMany({
        where: MULTI_HQ_ROLES.includes(role) ? {} : { id: sessionHqId },
        select: { id: true, name: true, capacity: true },
        orderBy: { name: 'asc' },
    });

    // Sedes sobre las que se calcula, según la selección efectiva.
    const hqs = (effectiveHqId && effectiveHqId !== 'ALL')
        ? allHqs.filter(h => h.id === effectiveHqId)
        : allHqs;

    const desde = new Date(Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000);

    // ── KPIs por sede ──
    let totalPatients = 0;
    let totalCriticalIncidents = 0;
    let totalGlobalMedsGiven = 0;
    let totalGlobalMedsScheduled = 0;
    let totalCapacity = 0;
    let capacityKnown = false;

    const rankingData = await Promise.all(hqs.map(async (hq) => {
        const capacityRaw: number | null =
            (typeof hq.capacity === 'number' && hq.capacity > 0) ? hq.capacity : null;
        if (capacityRaw !== null) {
            totalCapacity += capacityRaw;
            capacityKnown = true;
        }

        // Todo se agrega en la base. Antes esto traía medications →
        // administrations de cada paciente con include anidado y sin take: 21,004
        // filas en memoria por cada carga del dashboard, solo para contar dos
        // números. Crecía sin techo con cada dosis administrada.
        const [
            hqPatients,
            hqCriticalIncidents,
            evalAgg,
            surveys,
            medsScheduled,
            medsGiven,
            fhs,
        ] = await Promise.all([
            // Matrícula, no ocupación del turno: incluye a los hospitalizados.
            // Contar solo ACTIVE era la misma incongruencia que separaba el
            // censo de facturación — 32 en uno, 25 en el otro.
            prisma.patient.count({
                where: { headquartersId: hq.id, status: { in: ENROLLED_PATIENT_STATUSES } },
            }),
            prisma.incidentReport.count({
                where: { headquartersId: hq.id, severity: { in: SEVERIDADES_SERIAS }, createdAt: { gte: desde } },
            }),
            prisma.employeeEvaluation.aggregate({
                where: { headquartersId: hq.id, createdAt: { gte: desde } },
                _avg: { score: true },
                _count: true,
            }),
            prisma.familySurvey.findMany({
                where: { headquartersId: hq.id, createdAt: { gte: desde } },
                select: { ratingCare: true, ratingClean: true, ratingHealth: true },
            }),
            prisma.medicationAdministration.count({
                where: { patientMedication: { patient: { headquartersId: hq.id } }, createdAt: { gte: desde } },
            }),
            prisma.medicationAdministration.count({
                where: {
                    patientMedication: { patient: { headquartersId: hq.id } },
                    status: 'ADMINISTERED',
                    createdAt: { gte: desde },
                },
            }),
            calculateFacilityHealthScore(hq.id),
        ]);

        totalPatients += hqPatients;
        totalCriticalIncidents += hqCriticalIncidents;
        totalGlobalMedsGiven += medsGiven;
        totalGlobalMedsScheduled += medsScheduled;

        const occupancyRate: number | null = capacityRaw !== null
            ? Math.round((hqPatients / capacityRaw) * 100)
            : null;

        // null cuando no hay datos en la ventana — nunca un default inventado.
        const empScore: number | null = evalAgg._count > 0 && evalAgg._avg.score !== null
            ? Math.round(evalAgg._avg.score)
            : null;

        // Solo las RESPONDIDAS. Desde que la encuesta se envia por correo, la
        // fila se crea al invitar y las notas quedan nulas hasta que la familia
        // contesta — promediar invitaciones sin responder daria cero.
        const respondidas = surveys.filter(
            sv => sv.ratingCare != null && sv.ratingClean != null && sv.ratingHealth != null,
        );
        const famSatisfaction: number | null = respondidas.length > 0
            ? Math.round(
                (respondidas.reduce((acc, sv) => acc + sv.ratingCare! + sv.ratingClean! + sv.ratingHealth!, 0) /
                    (respondidas.length * 3)) * 20
            )
            : null;

        const medsCompliance: number | null = medsScheduled > 0
            ? Math.round((medsGiven / medsScheduled) * 100)
            : null;

        return {
            id: hq.id,
            facility: hq.name,
            capacity: capacityRaw,
            occupancyRate,
            activePatients: hqPatients,
            empScore,
            famSatisfaction,
            medsCompliance,
            facilityHealthScore: fhs.score,
            facilityHealthGrade: fhs.grade,
        };
    }));

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
      globalMedCompliance,
      // La pantalla necesita saber que estas cifras son de un período, no de
      // toda la historia, para poder rotularlas honestamente.
      ventanaDias: DIAS_VENTANA,
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
