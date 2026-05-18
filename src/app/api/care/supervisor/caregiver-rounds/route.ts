import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';
import { inferShiftTypeFromAST } from '@/lib/shift-coverage';
import { logError } from '@/lib/logger';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/caregiver-rounds?hqId=X
 *
 * Retorna el progreso de rondas de TODOS los cuidadores con sesión activa.
 * Una "ronda" = registrar al menos 1 atención a cada residente de su grupo de color.
 *
 * En guardia nocturna: rotaciones posturales + notas de ronda nocturna cuentan.
 * En turno diurno: rotaciones + baños + comidas + notas diarias.
 *
 * Por cuidador retorna:
 *   caregiverId, name, colorGroup
 *   roundsCompleted       — rondas completas desde que inició el turno
 *   residentsInGroup      — total residentes del grupo
 *   attendedThisRound     — residentes atendidos en la ronda en curso
 *   remainingThisRound    — pendientes para completar la ronda actual
 *   pendingResidents      — nombres + habitación de los pendientes
 *   minutesSinceLastRound — minutos desde la última ronda completa (null si ninguna)
 *   isNightShift          — true si hora actual es 10pm–6am
 *   shiftStartedAt        — cuándo inició la sesión activa
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const role = (session.user as any).role;
        if (!SUPERVISOR_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Acceso restringido a supervisores' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get('hqId');
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }

        // Sesiones activas de cuidadores (ventana 14h para incluir NIGHT vivos)
        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                actualEndTime: null,
                startTime: { gte: fourteenHrsAgo },
                caregiver: { headquartersId: hqId, role: 'CAREGIVER' }
            },
            select: {
                id: true,
                caregiverId: true,
                startTime: true,
                caregiver: { select: { name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        if (activeSessions.length === 0) {
            return NextResponse.json({ success: true, caregivers: [] });
        }

        const caregiverIds = activeSessions.map(s => s.caregiverId);

        // Para timestamps reales (assignedAt de ColorAssignments) usamos
        // todayStartAST() (6am AST = 10am UTC).
        // Para ScheduledShift.date (que se guarda como medianoche UTC del día
        // calendar correspondiente) usamos clinicalDayCalendarUTCRange()
        // — antes este endpoint usaba todayStartAST() ahí, lo cual EXCLUÍA los
        // shifts publicados del día porque date=00:00 UTC < 10:00 UTC.
        const todayStartUTC = todayStartAST();
        const scheduledDayRange = clinicalDayCalendarUTCRange();

        // Resolver color efectivo de cada cuidadora con la misma prioridad que
        // resolveAssignedPatients en shift/start:
        //   1. ShiftColorAssignment más reciente de HOY (cobertura manual /
        //      redistribución reciente — refleja qué color cubre AHORA).
        //   2. ScheduledShift del shiftType ACTUAL (color base del Builder).
        //   3. Fallback overtime: cualquier ScheduledShift de hoy más reciente.
        //
        // Caso real: si Joaneliz tiene ScheduledShift MORNING/RED (ya terminó)
        // + ColorAssignment YELLOW de hace 1h (cubriendo EVENING), debe verse
        // como YELLOW en el panel, no como RED.
        const colorMap = new Map<string, string>();

        const currentShiftType = inferShiftTypeFromAST();

        // Prioridad 1: ShiftColorAssignment más reciente de HOY
        const todayColorAssignments = await prisma.shiftColorAssignment.findMany({
            where: { userId: { in: caregiverIds }, assignedAt: { gte: todayStartUTC } },
            select: { userId: true, color: true, assignedAt: true },
            orderBy: { assignedAt: 'desc' }
        });
        for (const ca of todayColorAssignments) {
            if (!colorMap.has(ca.userId) && ca.color) colorMap.set(ca.userId, ca.color);
        }

        // Prioridad 2: ScheduledShift del shiftType actual (color base del Builder)
        const currentShiftScheduled = await prisma.scheduledShift.findMany({
            where: {
                userId: { in: caregiverIds },
                date: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                shiftType: currentShiftType as any,
                isAbsent: false,
                colorGroup: { not: null },
                schedule: { headquartersId: hqId, status: 'PUBLISHED' }
            },
            select: { userId: true, colorGroup: true },
        });
        for (const s of currentShiftScheduled) {
            if (!colorMap.has(s.userId) && s.colorGroup && s.colorGroup !== 'UNASSIGNED') {
                colorMap.set(s.userId, s.colorGroup);
            }
        }

        // Prioridad 3 (overtime fallback): cualquier ScheduledShift de hoy
        const fallbackShifts = await prisma.scheduledShift.findMany({
            where: {
                userId: { in: caregiverIds },
                date: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                isAbsent: false,
                colorGroup: { not: null },
                schedule: { headquartersId: hqId, status: 'PUBLISHED' }
            },
            select: { userId: true, colorGroup: true },
            orderBy: { date: 'desc' }
        });
        for (const s of fallbackShifts) {
            if (!colorMap.has(s.userId) && s.colorGroup && s.colorGroup !== 'UNASSIGNED') {
                colorMap.set(s.userId, s.colorGroup);
            }
        }

        // Residentes ACTIVE por color group en esta HQ.
        // Si alguna cuidadora tiene color 'ALL', traer todos los residentes.
        const hasAll = [...colorMap.values()].some(c => c === 'ALL');
        const distinctColors = [...new Set(colorMap.values())].filter(c => c !== 'ALL');
        const allGroupPatients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                ...(hasAll ? {} : { colorGroup: { in: distinctColors as any[] } })
            },
            select: { id: true, name: true, roomNumber: true, colorGroup: true },
            orderBy: { roomNumber: 'asc' }
        });

        const isNightShift = currentShiftType === 'NIGHT';

        const now = new Date();

        // Batch query refactor: en lugar de N×5 queries (1 set por cuidadora dentro
        // del Promise.all del map), se hacen 5 queries globales que traen TODOS los
        // touches de TODOS los cuidadores activos desde el shiftStart más antiguo,
        // y se agrupan en memoria por caregiverId. Reduce ~85% de queries con 5
        // cuidadoras en piso.
        const minShiftStart = activeSessions.reduce<Date>(
            (min, s) => (s.startTime < min ? s.startTime : min),
            activeSessions[0].startTime
        );
        const allPatientIds = allGroupPatients.map(p => p.id);

        type Touch = { patientId: string; at: Date };
        const rotationsByCg = new Map<string, Touch[]>();
        const bathsByCg = new Map<string, Touch[]>();
        const mealsByCg = new Map<string, Touch[]>();
        const dailyLogsByCg = new Map<string, Touch[]>();
        const nightRoundNotesByCg = new Map<string, Touch[]>();
        const dayDiapersByCg = new Map<string, Touch[]>();

        // Solo 5 queries globales en paralelo. Selección y filtrado por shiftStart
        // individual + groupIds del cuidador se hacen en memoria después.
        const queries: Array<Promise<any>> = [
            prisma.posturalChangeLog.findMany({
                where: { nurseId: { in: caregiverIds }, patientId: { in: allPatientIds }, performedAt: { gte: minShiftStart } },
                select: { nurseId: true, patientId: true, performedAt: true },
            }),
            prisma.dailyLog.findMany({
                where: { authorId: { in: caregiverIds }, patientId: { in: allPatientIds }, createdAt: { gte: minShiftStart } },
                select: { authorId: true, patientId: true, createdAt: true, notes: true },
            }),
        ];
        if (!isNightShift) {
            queries.push(
                prisma.bathLog.findMany({
                    where: { caregiverId: { in: caregiverIds }, patientId: { in: allPatientIds }, timeLogged: { gte: minShiftStart } },
                    select: { caregiverId: true, patientId: true, timeLogged: true },
                }),
                prisma.mealLog.findMany({
                    where: { caregiverId: { in: caregiverIds }, patientId: { in: allPatientIds }, timeLogged: { gte: minShiftStart } },
                    select: { caregiverId: true, patientId: true, timeLogged: true },
                }),
                prisma.clinicalNote.findMany({
                    where: {
                        authorId: { in: caregiverIds },
                        patientId: { in: allPatientIds },
                        createdAt: { gte: minShiftStart },
                        content: { contains: '[CAMBIO PAÑAL DIURNO ZENDI]' },
                    },
                    select: { authorId: true, patientId: true, createdAt: true },
                }),
            );
        }
        const results = await Promise.all(queries);
        const allRotations = results[0] as Array<{ nurseId: string; patientId: string; performedAt: Date }>;
        const allDailyLogs = results[1] as Array<{ authorId: string; patientId: string; createdAt: Date; notes: string | null }>;
        const allBaths = (results[2] || []) as Array<{ caregiverId: string; patientId: string; timeLogged: Date }>;
        const allMeals = (results[3] || []) as Array<{ caregiverId: string; patientId: string; timeLogged: Date }>;
        const allDiapers = (results[4] || []) as Array<{ authorId: string; patientId: string; createdAt: Date }>;

        // Agrupar por caregiverId
        const pushTouch = (map: Map<string, Touch[]>, cgId: string, t: Touch) => {
            const arr = map.get(cgId);
            if (arr) arr.push(t); else map.set(cgId, [t]);
        };
        for (const r of allRotations) pushTouch(rotationsByCg, r.nurseId, { patientId: r.patientId, at: r.performedAt });
        for (const r of allDailyLogs) {
            const touch: Touch = { patientId: r.patientId, at: r.createdAt };
            pushTouch(dailyLogsByCg, r.authorId, touch);
            if (isNightShift && r.notes?.includes('[RONDA NOCTURNA')) {
                pushTouch(nightRoundNotesByCg, r.authorId, touch);
            }
        }
        for (const r of allBaths) pushTouch(bathsByCg, r.caregiverId, { patientId: r.patientId, at: r.timeLogged });
        for (const r of allMeals) pushTouch(mealsByCg, r.caregiverId, { patientId: r.patientId, at: r.timeLogged });
        for (const r of allDiapers) pushTouch(dayDiapersByCg, r.authorId, { patientId: r.patientId, at: r.createdAt });

        // Por cuidadora: filtrar por shiftStart individual + groupIds + construir allTouches
        const caregiverResults = activeSessions.map((sess) => {
            const caregiverId = sess.caregiverId;
            const name = sess.caregiver?.name || 'Cuidador';
            const shiftStart = sess.startTime;
            const shiftStartMs = shiftStart.getTime();
            const colorGroup = colorMap.get(caregiverId) ?? null;

            if (!colorGroup) {
                return {
                    caregiverId, name, colorGroup: null,
                    noColorGroup: true,
                    roundsCompleted: 0, residentsInGroup: 0,
                    attendedThisRound: 0, remainingThisRound: 0,
                    pendingResidents: [], minutesSinceLastRound: null,
                    isNightShift, shiftStartedAt: shiftStart,
                };
            }

            const groupPatients = colorGroup === 'ALL'
                ? allGroupPatients
                : allGroupPatients.filter(p => p.colorGroup === colorGroup);
            const groupSize = groupPatients.length;

            if (groupSize === 0) {
                return {
                    caregiverId, name, colorGroup,
                    emptyGroup: true,
                    roundsCompleted: 0, residentsInGroup: 0,
                    attendedThisRound: 0, remainingThisRound: 0,
                    pendingResidents: [], minutesSinceLastRound: null,
                    isNightShift, shiftStartedAt: shiftStart,
                };
            }

            const groupIds = groupPatients.map(p => p.id);
            const groupIdsSet = new Set(groupIds);

            // Filtra touches del cuidador por shiftStart individual + groupIds
            const filterTouches = (touches: Touch[] | undefined): Touch[] =>
                (touches || []).filter(t => t.at.getTime() >= shiftStartMs && groupIdsSet.has(t.patientId));

            let allTouches: Touch[];
            if (isNightShift) {
                allTouches = [
                    ...filterTouches(rotationsByCg.get(caregiverId)),
                    ...filterTouches(nightRoundNotesByCg.get(caregiverId)),
                ];
            } else {
                allTouches = [
                    ...filterTouches(rotationsByCg.get(caregiverId)),
                    ...filterTouches(bathsByCg.get(caregiverId)),
                    ...filterTouches(mealsByCg.get(caregiverId)),
                    ...filterTouches(dailyLogsByCg.get(caregiverId)),
                    ...filterTouches(dayDiapersByCg.get(caregiverId)),
                ];
            }
            allTouches.sort((a, b) => a.at.getTime() - b.at.getTime());

            return computeRoundStats({ caregiverId, name, colorGroup, groupSize, groupPatients, groupIds, allTouches, isNightShift, shiftStart, now });
        });

        return NextResponse.json({ success: true, isNightShift, caregivers: caregiverResults });

    } catch (err: any) {
        logError('care.supervisor.caregiver_rounds.get', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

function computeRoundStats({
    caregiverId, name, colorGroup, groupSize, groupPatients, groupIds, allTouches, isNightShift, shiftStart, now
}: {
    caregiverId: string; name: string; colorGroup: string;
    groupSize: number; groupPatients: { id: string; name: string; roomNumber: string | null }[];
    groupIds: string[]; allTouches: { patientId: string; at: Date }[];
    isNightShift: boolean; shiftStart: Date; now: Date;
}) {
    let roundsCompleted = 0;
    let roundCompletedAt: Date | null = null;
    const seenInCurrentRound = new Set<string>();

    for (const touch of allTouches) {
        seenInCurrentRound.add(touch.patientId);
        if (seenInCurrentRound.size === groupSize) {
            roundsCompleted++;
            roundCompletedAt = touch.at;
            seenInCurrentRound.clear();
        }
    }

    const attendedThisRound = seenInCurrentRound.size;
    const remainingThisRound = groupSize - attendedThisRound;
    const pendingIds = new Set(groupIds.filter(id => !seenInCurrentRound.has(id)));
    const pendingResidents = groupPatients
        .filter(p => pendingIds.has(p.id))
        .map(p => ({ name: p.name.split(' ')[0], room: p.roomNumber || '—' }));

    const minutesSinceLastRound = roundCompletedAt
        ? Math.round((now.getTime() - roundCompletedAt.getTime()) / 60000)
        : null;

    return {
        caregiverId, name, colorGroup,
        roundsCompleted,
        residentsInGroup: groupSize,
        attendedThisRound,
        remainingThisRound,
        pendingResidents,
        minutesSinceLastRound,
        isNightShift,
        shiftStartedAt: shiftStart,
    };
}
