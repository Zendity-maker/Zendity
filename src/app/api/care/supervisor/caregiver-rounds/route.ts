import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { todayStartAST } from '@/lib/dates';
import { inferShiftTypeFromAST } from '@/lib/shift-coverage';

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

        // Día clínico estandarizado (AST 6 AM como inicio).
        // Antes este endpoint usaba setUTCHours(0,0,0,0) lo cual divergía
        // del resto del sistema y excluía shifts entre 4-6 AM AST.
        const todayStartUTC = todayStartAST();
        const todayEndUTC = new Date();
        todayEndUTC.setUTCHours(23, 59, 59, 999);

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
                date: { gte: todayStartUTC, lte: todayEndUTC },
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
                date: { gte: todayStartUTC, lte: todayEndUTC },
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

        // Calcular progreso por cuidador en paralelo
        const caregiverResults = await Promise.all(
            activeSessions.map(async (sess) => {
                const caregiverId = sess.caregiverId;
                const name = sess.caregiver?.name || 'Cuidador';
                const shiftStart = sess.startTime;
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

                // Color ALL → ve todos los residentes de la HQ
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

                // Atenciones del turno según tipo de guardia
                if (isNightShift) {
                    // Nocturna: rotaciones posturales + notas de ronda nocturna
                    const [rotations, roundNotes] = await Promise.all([
                        prisma.posturalChangeLog.findMany({
                            where: { nurseId: caregiverId, patientId: { in: groupIds }, performedAt: { gte: shiftStart } },
                            select: { patientId: true, performedAt: true },
                            orderBy: { performedAt: 'asc' }
                        }),
                        prisma.dailyLog.findMany({
                            where: {
                                authorId: caregiverId, patientId: { in: groupIds },
                                createdAt: { gte: shiftStart }, notes: { contains: '[RONDA NOCTURNA' }
                            },
                            select: { patientId: true, createdAt: true },
                            orderBy: { createdAt: 'asc' }
                        })
                    ]);
                    const allTouches = [
                        ...rotations.map(r => ({ patientId: r.patientId, at: r.performedAt })),
                        ...roundNotes.map(r => ({ patientId: r.patientId, at: r.createdAt })),
                    ].sort((a, b) => a.at.getTime() - b.at.getTime());

                    return computeRoundStats({ caregiverId, name, colorGroup, groupSize, groupPatients, groupIds, allTouches, isNightShift, shiftStart, now });
                } else {
                    // Diurno: rotaciones + baños + comidas + notas diarias + pañales diurnos
                    const [rotations, baths, meals, dailyLogs, dayDiapers] = await Promise.all([
                        prisma.posturalChangeLog.findMany({
                            where: { nurseId: caregiverId, patientId: { in: groupIds }, performedAt: { gte: shiftStart } },
                            select: { patientId: true, performedAt: true },
                            orderBy: { performedAt: 'asc' }
                        }),
                        prisma.bathLog.findMany({
                            where: { caregiverId, patientId: { in: groupIds }, timeLogged: { gte: shiftStart } },
                            select: { patientId: true, timeLogged: true },
                            orderBy: { timeLogged: 'asc' }
                        }),
                        prisma.mealLog.findMany({
                            where: { caregiverId, patientId: { in: groupIds }, timeLogged: { gte: shiftStart } },
                            select: { patientId: true, timeLogged: true },
                            orderBy: { timeLogged: 'asc' }
                        }),
                        prisma.dailyLog.findMany({
                            where: { authorId: caregiverId, patientId: { in: groupIds }, createdAt: { gte: shiftStart } },
                            select: { patientId: true, createdAt: true },
                            orderBy: { createdAt: 'asc' }
                        }),
                        prisma.clinicalNote.findMany({
                            where: {
                                authorId: caregiverId,
                                patientId: { in: groupIds },
                                createdAt: { gte: shiftStart },
                                content: { contains: '[CAMBIO PAÑAL DIURNO ZENDI]' }
                            },
                            select: { patientId: true, createdAt: true },
                            orderBy: { createdAt: 'asc' }
                        })
                    ]);
                    const allTouches = [
                        ...rotations.map(r => ({ patientId: r.patientId, at: r.performedAt })),
                        ...baths.map(r => ({ patientId: r.patientId, at: r.timeLogged })),
                        ...meals.map(r => ({ patientId: r.patientId, at: r.timeLogged })),
                        ...dailyLogs.map(r => ({ patientId: r.patientId, at: r.createdAt })),
                        ...dayDiapers.map(r => ({ patientId: r.patientId, at: r.createdAt })),
                    ].sort((a, b) => a.at.getTime() - b.at.getTime());

                    return computeRoundStats({ caregiverId, name, colorGroup, groupSize, groupPatients, groupIds, allTouches, isNightShift, shiftStart, now });
                }
            })
        );

        return NextResponse.json({ success: true, isNightShift, caregivers: caregiverResults });

    } catch (err: any) {
        console.error('[caregiver-rounds]', err);
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
