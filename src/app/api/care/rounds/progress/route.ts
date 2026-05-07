import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/rounds/progress
 *
 * Retorna el progreso de rondas del cuidador durante su turno activo.
 * Una "ronda" = registrar al menos 1 atención a cada residente del grupo de color.
 * En guardia nocturna: rotaciones posturales + notas de ronda (pañal) cuentan.
 * Baños y comidas NO se incluyen (no ocurren en guardia).
 *
 * Responde:
 *   roundsCompleted      — rondas completas desde que empezó el turno
 *   residentsInGroup     — total de residentes del grupo
 *   attendedThisRound    — residentes atendidos en la ronda en curso
 *   remainingThisRound   — residentes que faltan para completar la ronda actual
 *   pendingResidents     — lista de residentes pendientes (nombre + hab)
 *   minutesSinceLastRound — minutos desde que completó la última ronda
 *   isNightShift         — si es turno de guardia (entre 10pm y 6am)
 *   justCompletedRound   — true si esta consulta detectó una ronda recién completada
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const userId = (session.user as any).id;
        const hqId   = (session.user as any).headquartersId;

        // Sesión activa del cuidador
        const activeSession = await prisma.shiftSession.findFirst({
            where: { caregiverId: userId, actualEndTime: null },
            orderBy: { startTime: 'desc' },
            select: { id: true, startTime: true }
        });

        if (!activeSession) {
            return NextResponse.json({ success: true, noActiveSession: true });
        }

        const shiftStart = activeSession.startTime;

        // Detectar si es guardia nocturna (10pm–6am)
        const now = new Date();
        const hour = now.getHours();
        const isNightShift = hour >= 22 || hour < 6;

        // Grupo de color del cuidador
        const lastColorAssignment = await prisma.shiftColorAssignment.findFirst({
            where: { userId },
            orderBy: { assignedAt: 'desc' },
            select: { color: true }
        });
        const myColor = lastColorAssignment?.color ?? null;

        if (!myColor) {
            return NextResponse.json({ success: true, noColorGroup: true });
        }

        // Residentes del grupo
        const groupPatients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE', colorGroup: myColor as any },
            select: { id: true, name: true, roomNumber: true },
            orderBy: { roomNumber: 'asc' }
        });

        const groupSize = groupPatients.length;
        if (groupSize === 0) {
            return NextResponse.json({ success: true, emptyGroup: true });
        }

        const groupIds = groupPatients.map(p => p.id);

        // ── Calcular rondas completas desde el inicio del turno ──────────────
        // Estrategia: construir una línea de tiempo de atenciones por residente
        // y detectar cuántas veces se ha cubierto el 100% del grupo

        // Todas las atenciones del turno (rotaciones + notas de ronda)
        const [rotations, roundNotes] = await Promise.all([
            prisma.posturalChangeLog.findMany({
                where: { nurseId: userId, patientId: { in: groupIds }, performedAt: { gte: shiftStart } },
                select: { patientId: true, performedAt: true },
                orderBy: { performedAt: 'asc' }
            }),
            prisma.dailyLog.findMany({
                where: {
                    authorId: userId,
                    patientId: { in: groupIds },
                    createdAt: { gte: shiftStart },
                    notes: { contains: '[RONDA NOCTURNA' }
                },
                select: { patientId: true, createdAt: true },
                orderBy: { createdAt: 'asc' }
            })
        ]);

        // Unir y ordenar cronológicamente
        const allTouches = [
            ...rotations.map(r => ({ patientId: r.patientId, at: r.performedAt })),
            ...roundNotes.map(r => ({ patientId: r.patientId, at: r.createdAt })),
        ].sort((a, b) => a.at.getTime() - b.at.getTime());

        // Contar rondas completas y progreso actual
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

        // ── Detectar si esta consulta reveló una ronda recién completada ─────
        // Se detecta cuando en el último minuto el attended pasó a = groupSize
        // Hacemos la verificación comparando con 1 minuto atrás
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const justCompletedRound =
            roundCompletedAt !== null &&
            roundCompletedAt >= oneMinuteAgo;

        // ── Si completó una ronda → notificar al supervisor ──────────────────
        if (justCompletedRound) {
            const caregiver = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true }
            });
            const firstName = caregiver?.name?.split(' ')[0] || 'El cuidador';
            const colorEmoji = myColor === 'RED' ? '🔴' : myColor === 'YELLOW' ? '🟡' : myColor === 'BLUE' ? '🔵' : '⚪';

            try {
                await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                    type: 'SHIFT_ALERT',
                    title: `${colorEmoji} Ronda completa — ${firstName}`,
                    message: `${firstName} completó la ronda ${roundsCompleted} (grupo ${myColor}). Considera enviarle un mensaje de felicitación.`,
                    link: '/care/supervisor',
                });
            } catch (e) {
                console.error('[rounds/progress] Error notificando supervisor:', e);
            }
        }

        return NextResponse.json({
            success: true,
            colorGroup: myColor,
            isNightShift,
            roundsCompleted,
            residentsInGroup: groupSize,
            attendedThisRound,
            remainingThisRound,
            pendingResidents,
            minutesSinceLastRound,
            justCompletedRound,
            shiftStarted: shiftStart,
        });

    } catch (err: any) {
        console.error('[rounds/progress]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
