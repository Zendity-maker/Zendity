import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

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
        if (!['SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(role)) {
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

        // Color group asignado a cada cuidador (el más reciente)
        const colorAssignments = await prisma.shiftColorAssignment.findMany({
            where: { userId: { in: caregiverIds } },
            select: { userId: true, color: true, assignedAt: true },
            orderBy: { assignedAt: 'desc' }
        });

        // Mapa userId → color (primera = más reciente ya que está ordenado desc)
        const colorMap = new Map<string, string>();
        for (const ca of colorAssignments) {
            if (!colorMap.has(ca.userId)) colorMap.set(ca.userId, ca.color);
        }

        // Residentes ACTIVE por color group en esta HQ
        const distinctColors = [...new Set(colorMap.values())];
        const allGroupPatients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE', colorGroup: { in: distinctColors as any[] } },
            select: { id: true, name: true, roomNumber: true, colorGroup: true },
            orderBy: { roomNumber: 'asc' }
        });

        // Detectar si es guardia nocturna (hora local Puerto Rico)
        const prHour = parseInt(
            new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico' })
                .format(new Date()), 10
        ) % 24;
        const isNightShift = prHour >= 22 || prHour < 6;

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

                const groupPatients = allGroupPatients.filter(p => p.colorGroup === colorGroup);
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
                    // Diurno: rotaciones + baños + comidas + notas
                    const [rotations, baths, meals, dailyLogs] = await Promise.all([
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
                        })
                    ]);
                    const allTouches = [
                        ...rotations.map(r => ({ patientId: r.patientId, at: r.performedAt })),
                        ...baths.map(r => ({ patientId: r.patientId, at: r.timeLogged })),
                        ...meals.map(r => ({ patientId: r.patientId, at: r.timeLogged })),
                        ...dailyLogs.map(r => ({ patientId: r.patientId, at: r.createdAt })),
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
