import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';
import { TicketStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

/**
 * GET /api/corporate/live?hqId=X
 * Sala de mando en tiempo real (agregado multi-sede para DIRECTOR/ADMIN,
 * una sede para SUPERVISOR). Pensado para polling a 30s.
 *
 * Retorna 8 chips agregados:
 *  - activeCaregivers (ShiftSession abierta hoy)
 *  - bathsToday
 *  - mealsToday
 *  - incidentsWeek (IncidentReport últimos 7 días)
 *  - triageOpen (TriageTicket OPEN/IN_PROGRESS — sin resolver)
 *  - handoversPending (ShiftHandover sin supervisorSignedAt del día)
 *  - zombiePatients (residentes activos sin baño, sin comida y sin vitales hoy)
 *  - onHospitalLeave (residentes con leaveType = 'HOSPITAL')
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

        const [
            activeSessions,
            bathsToday,
            mealsToday,
            incidentsWeek,
            triageOpenCount,
            handoversToday,
            activePatients,
            onHospitalLeave,
        ] = await Promise.all([
            prisma.shiftSession.count({
                where: {
                    ...hqFilter,
                    actualEndTime: null,
                    startTime: { gte: today },
                },
            }),
            prisma.bathLog.count({
                where: { ...hqFilterViaPatient, timeLogged: { gte: today } },
            }),
            prisma.mealLog.count({
                where: { ...hqFilterViaPatient, timeLogged: { gte: today } },
            }),
            prisma.incidentReport.count({
                where: { ...hqFilter, createdAt: { gte: weekAgo } },
            }),
            prisma.triageTicket.count({
                where: {
                    ...hqFilter,
                    status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
                    isVoided: false,
                },
            }),
            prisma.shiftHandover.findMany({
                where: { ...hqFilter, createdAt: { gte: today } },
                select: { supervisorSignedAt: true },
            }),
            prisma.patient.findMany({
                where: {
                    ...(effectiveHqId === 'ALL' ? {} : { headquartersId: effectiveHqId }),
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    name: true,
                    roomNumber: true,
                    headquartersId: true,
                },
            }),
            prisma.patient.count({
                where: {
                    ...(effectiveHqId === 'ALL' ? {} : { headquartersId: effectiveHqId }),
                    status: 'TEMPORARY_LEAVE',
                    leaveType: 'HOSPITAL',
                },
            }),
        ]);

        const handoversPending = handoversToday.filter(h => !h.supervisorSignedAt).length;

        // Zombi detection: residentes activos sin baño/comida/vitales hoy
        const patientIds = activePatients.map(p => p.id);
        let zombieCount = 0;
        let zombieSample: Array<{ id: string; name: string; roomNumber: string | null }> = [];
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
            const zombies = activePatients.filter(p => !touched.has(p.id));
            zombieCount = zombies.length;
            zombieSample = zombies.slice(0, 5).map(z => ({
                id: z.id,
                name: z.name,
                roomNumber: z.roomNumber,
            }));
        }

        return NextResponse.json({
            success: true,
            effectiveHqId,
            timestamp: new Date().toISOString(),
            chips: {
                activeCaregivers: activeSessions,
                bathsToday,
                mealsToday,
                incidentsWeek,
                triageOpen: triageOpenCount,
                handoversPending,
                zombiePatients: zombieCount,
                onHospitalLeave,
            },
            totals: {
                activePatients: activePatients.length,
                handoversToday: handoversToday.length,
            },
            zombieSample,
        });
    } catch (err: any) {
        console.error('[corporate/live GET]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
