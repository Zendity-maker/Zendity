import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';
import { TicketStatus } from '@prisma/client';
import { groupByFloor } from '@/lib/floor';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

/**
 * GET /api/corporate/live?hqId=X
 * Sala de mando en tiempo real. Retorna chips + listas de detalle para cada uno.
 */
export async function GET(request: NextRequest) {
    try {
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

        const requestedHqId = request.nextUrl.searchParams.get('hqId');
        let effectiveHqId: string | 'ALL';
        if (MULTI_HQ_ROLES.includes(role)) {
            effectiveHqId = (!requestedHqId || requestedHqId === 'ALL') ? 'ALL' : requestedHqId;
        } else {
            effectiveHqId = sessionHqId;
        }

        const today = todayStartAST();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const hqFilter = effectiveHqId === 'ALL' ? {} : { headquartersId: effectiveHqId };
        const hqFilterViaPatient = effectiveHqId === 'ALL' ? {} : { patient: { headquartersId: effectiveHqId } };
        const patientHqFilter = effectiveHqId === 'ALL' ? {} : { headquartersId: effectiveHqId };

        const [
            activeSessions,
            bathLogs,
            mealLogs,
            incidentsWeekList,
            triageOpenList,
            handoversToday,
            activePatients,
            onHospitalLeaveList,
        ] = await Promise.all([
            // 1. Cuidadores con sesión abierta hoy
            prisma.shiftSession.findMany({
                where: { ...hqFilter, actualEndTime: null, startTime: { gte: today } },
                select: {
                    id: true,
                    startTime: true,
                    caregiver: { select: { id: true, name: true, role: true } },
                },
                orderBy: { startTime: 'asc' },
            }),

            // 2. Baños del día
            prisma.bathLog.findMany({
                where: { ...hqFilterViaPatient, timeLogged: { gte: today } },
                select: {
                    id: true,
                    timeLogged: true,
                    status: true,
                    patient: { select: { id: true, name: true, roomNumber: true } },
                    caregiver: { select: { name: true } },
                },
                orderBy: { timeLogged: 'desc' },
            }),

            // 3. Comidas del día
            prisma.mealLog.findMany({
                where: { ...hqFilterViaPatient, timeLogged: { gte: today } },
                select: {
                    id: true,
                    timeLogged: true,
                    mealType: true,
                    quality: true,
                    patient: { select: { id: true, name: true, roomNumber: true } },
                    caregiver: { select: { name: true } },
                },
                orderBy: { timeLogged: 'desc' },
            }),

            // 4. Observaciones/Incidentes de RRHH últimos 7 días
            prisma.incidentReport.findMany({
                where: { ...hqFilter, createdAt: { gte: weekAgo } },
                select: {
                    id: true,
                    type: true,
                    severity: true,
                    createdAt: true,
                    status: true,
                    description: true,
                    employee: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),

            // 5. Triage abierto
            prisma.triageTicket.findMany({
                where: {
                    ...hqFilter,
                    status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
                    isVoided: false,
                },
                select: {
                    id: true,
                    description: true,
                    status: true,
                    priority: true,
                    createdAt: true,
                    originType: true,
                    patient: { select: { name: true, roomNumber: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),

            // 6. Handovers del día
            prisma.shiftHandover.findMany({
                where: { ...hqFilter, createdAt: { gte: today } },
                select: {
                    id: true,
                    supervisorSignedAt: true,
                    createdAt: true,
                    outgoingNurse: { select: { name: true, role: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),

            // 7. Residentes activos (para zombie detection).
            //
            // Multi-floor (jun-2026): NO scopeamos por floor acá — el chip del
            // director es vista UNSCOPED (ve TODA la sede). El agrupamiento
            // por piso se hace después con groupByFloor → zombiePatientsByFloor
            // en el response. Residentes con floor=null caen en bucket
            // 'unassigned' → Phase 4 UI los pinta como ALARMA de integridad
            // (no como sección neutral). Esta es la red de seguridad que el
            // user pidió en el plan: scoped views excluyen nulls, unscoped
            // views los exponen.
            prisma.patient.findMany({
                where: { ...patientHqFilter, status: 'ACTIVE' },
                select: { id: true, name: true, roomNumber: true, floor: true },
            }),

            // 8. En hospital (TEMPORARY_LEAVE con leaveType HOSPITAL)
            prisma.patient.findMany({
                where: { ...patientHqFilter, status: 'TEMPORARY_LEAVE', leaveType: 'HOSPITAL' },
                select: {
                    id: true,
                    name: true,
                    roomNumber: true,
                    leaveDate: true,
                    dischargeReason: true,
                },
                orderBy: { leaveDate: 'desc' },
            }),
        ]);

        const handoversPending = handoversToday.filter(h => !h.supervisorSignedAt);
        const handoversSigned  = handoversToday.filter(h =>  h.supervisorSignedAt);

        // ── Zombie detection ───────────────────────────────────────────────────
        // Multi-floor (jun-2026): `floor` añadido a la shape del item para que
        // groupByFloor pueda agruparlos. UI Phase 4 itera floors dinámicamente
        // (1, 2, ..., N — sin hardcoding) + alarma sobre bucket 'unassigned'.
        const patientIds = activePatients.map(p => p.id);
        let zombieList: Array<{
            id: string;
            name: string;
            roomNumber: string | null;
            floor: number | null;
        }> = [];

        if (patientIds.length > 0) {
            const [bathPatients, mealPatients, vitalPatients] = await Promise.all([
                prisma.bathLog.findMany({
                    where: { timeLogged: { gte: today }, patientId: { in: patientIds } },
                    select: { patientId: true },
                    distinct: ['patientId'],
                }),
                prisma.mealLog.findMany({
                    where: { timeLogged: { gte: today }, patientId: { in: patientIds } },
                    select: { patientId: true },
                    distinct: ['patientId'],
                }),
                prisma.vitalSigns.findMany({
                    where: { createdAt: { gte: today }, patientId: { in: patientIds } },
                    select: { patientId: true },
                    distinct: ['patientId'],
                }),
            ]);
            const touched = new Set<string>([
                ...bathPatients.map(b => b.patientId),
                ...mealPatients.map(m => m.patientId),
                ...vitalPatients.map(v => v.patientId),
            ]);
            zombieList = activePatients
                .filter(p => !touched.has(p.id))
                .map(z => ({
                    id: z.id,
                    name: z.name,
                    roomNumber: z.roomNumber,
                    floor: z.floor,
                }));
        }

        // Multi-floor (jun-2026): agrupar por floor con buckets dinámicos.
        // groupByFloor retorna { "1": [...], "2": [...], "unassigned": [...] }.
        // - Floors numéricos: derivados dinámicamente de los items (Mayagüez
        //   con N pisos funciona sin hardcoding 1/2).
        // - 'unassigned' bucket: residentes ACTIVE con floor=null (data anomaly).
        //   El endpoint solo expone — UI Phase 4 lo trata como ALARMA de
        //   integridad cuando length > 0 (NO sección neutral), per user note:
        //     "estos residentes no tienen piso, investiga".
        const zombiePatientsByFloor = groupByFloor(zombieList);

        // Multi-floor (jun-2026): chip de alarma — residentes ACTIVE con
        // floor=null. Sentinel a nivel director que complementa al del
        // supervisor (caregiver-rounds.unassignedFloorPatientsCount).
        // Vista UNSCOPED del director ES quien debe verlos: los flujos
        // scoped-por-piso los excluyen silenciosamente. Cuando el director
        // los caza, los abre desde el chip y asigna piso desde el perfil.
        const unassignedFloorPatientsList = activePatients
            .filter(p => p.floor === null)
            .map(p => ({
                id: p.id,
                name: p.name,
                room: p.roomNumber ?? '—',
            }));

        return NextResponse.json({
            success: true,
            effectiveHqId,
            timestamp: new Date().toISOString(),
            chips: {
                activeCaregivers:  activeSessions.length,
                bathsToday:        bathLogs.length,
                mealsToday:        mealLogs.length,
                incidentsWeek:     incidentsWeekList.length,
                triageOpen:        triageOpenList.length,
                handoversPending:  handoversPending.length,
                zombiePatients:    zombieList.length,
                onHospitalLeave:   onHospitalLeaveList.length,
                unassignedFloorPatients: unassignedFloorPatientsList.length,
            },
            totals: {
                activePatients: activePatients.length,
                handoversToday: handoversToday.length,
            },
            details: {
                activeCaregivers: activeSessions.map(s => ({
                    id: s.id,
                    name: s.caregiver?.name ?? '—',
                    role: s.caregiver?.role ?? '—',
                    since: s.startTime,
                })),
                bathsToday: bathLogs.map(b => ({
                    id: b.id,
                    patient: b.patient?.name ?? '—',
                    room: b.patient?.roomNumber ?? '—',
                    type: b.status,
                    caregiver: b.caregiver?.name ?? '—',
                    time: b.timeLogged,
                })),
                mealsToday: mealLogs.map(m => ({
                    id: m.id,
                    patient: m.patient?.name ?? '—',
                    room: m.patient?.roomNumber ?? '—',
                    mealType: m.mealType,
                    intake: m.quality,
                    caregiver: m.caregiver?.name ?? '—',
                    time: m.timeLogged,
                })),
                incidentsWeek: incidentsWeekList.map(i => ({
                    id: i.id,
                    type: i.type,
                    severity: i.severity,
                    status: i.status,
                    employee: i.employee?.name ?? '—',
                    description: i.description,
                    time: i.createdAt,
                })),
                triageOpen: triageOpenList.map(t => ({
                    id: t.id,
                    title: t.description.length > 80 ? t.description.slice(0, 80) + '…' : t.description,
                    status: t.status,
                    priority: t.priority,
                    originType: t.originType,
                    patient: t.patient?.name ?? '—',
                    room: t.patient?.roomNumber ?? '—',
                    time: t.createdAt,
                })),
                handoversPending: handoversPending.map(h => ({
                    id: h.id,
                    nurse: h.outgoingNurse?.name ?? '—',
                    role: h.outgoingNurse?.role ?? '—',
                    time: h.createdAt,
                })),
                handoversSigned: handoversSigned.map(h => ({
                    id: h.id,
                    nurse: h.outgoingNurse?.name ?? '—',
                    role: h.outgoingNurse?.role ?? '—',
                    signedAt: h.supervisorSignedAt,
                    time: h.createdAt,
                })),
                zombiePatients: zombieList,
                // Multi-floor (jun-2026): vista agrupada por floor para Phase 4
                // UI. Buckets numéricos dinámicos + 'unassigned' (data anomaly
                // → alarma integridad). El flat list de arriba mantiene
                // backwards-compat con consumers que aún no agrupan.
                zombiePatientsByFloor,
                unassignedFloorPatients: unassignedFloorPatientsList,
                onHospitalLeave: onHospitalLeaveList.map(p => ({
                    id: p.id,
                    name: p.name,
                    room: p.roomNumber ?? '—',
                    since: p.leaveDate,
                    reason: p.dischargeReason,
                })),
            },
            zombieSample: zombieList.slice(0, 5), // compatibilidad legacy
        });
    } catch (err: any) {
        console.error('[corporate/live GET]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
