import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import {
    resolveUserFloorScope,
    floorWhereFilter,
    CaregiverFloorMissingError,
    type FloorScope,
} from '@/lib/floor';

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
 *   residentsInGroup     — total de residentes del grupo (incluye overrides cross-piso)
 *   attendedThisRound    — residentes atendidos en la ronda en curso
 *   remainingThisRound   — residentes que faltan para completar la ronda actual
 *   pendingResidents     — lista de residentes pendientes (nombre + hab)
 *   minutesSinceLastRound — minutos desde que completó la última ronda
 *   isNightShift         — si es turno de guardia (entre 10pm y 6am)
 *   justCompletedRound   — true si esta consulta detectó una ronda recién completada
 *
 * ─── SPRINT MULTI-FLOOR (jun-2026) — patrón #1 (tablet) ─────────────────
 *
 * Aplica la regla "primario floor-scoped, override floor-bypass":
 *   - Rama PRIMARIA: residentes de MI color en MI piso (caregiver.floor).
 *   - Rama OVERRIDE: residentes asignados a mí via ShiftPatientOverride
 *     (cualquier color, cualquier piso — incluye los cross-piso del break-glass
 *     de #6 o del assign-color de #4).
 *
 * Ambas ramas entran a `groupSize`, así que los rounds sobre residentes
 * cross-piso CUENTAN hacia el progreso. Coherente con el principio acordado
 * (consumer #10 spec del user): si Yari2 cubre a X piso 1 vía override,
 * sus rounds sobre X cuentan en su progreso de Piso 2 también — es su
 * carga total del turno, no solo lo "propio".
 *
 * CAREGIVER puro con floor=null → 422 con mensaje accionable (mismo gate
 * que #1 tablet — no hay scope coherente sin floor).
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const userId = (session.user as any).id;
        const hqId   = (session.user as any).headquartersId;

        // Multi-floor: fetch invoker role+floor para resolver scope.
        // findUnique adicional por poll — aceptable (este endpoint no es hot
        // path de polling agresivo; el tablet sí lo es y ahí está optimizado).
        const invoker = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, floor: true, name: true },
        });
        if (!invoker) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 401 });
        }
        let floorScope: FloorScope;
        try {
            floorScope = resolveUserFloorScope(
                { role: invoker.role, floor: invoker.floor },
                userId,
            );
        } catch (e) {
            if (e instanceof CaregiverFloorMissingError) {
                return NextResponse.json({ success: false, error: e.message }, { status: 422 });
            }
            throw e;
        }

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

        // Multi-floor: query overrides ANTES de groupPatients para tener
        // overridePatientIds disponibles para la rama OVERRIDE de la query OR.
        // Hoy = inicio del día AST. Misma convención que tablet (consumer #1).
        const todayStart = todayStartAST();
        const overrides = await prisma.shiftPatientOverride.findMany({
            where: {
                caregiverId: userId,
                headquartersId: hqId,
                isActive: true,
                shiftDate: { gte: todayStart },
            },
            select: { patientId: true },
        });
        const overridePatientIds = overrides.map(o => o.patientId);

        // Sin color base Y sin overrides → nada que rondar. Antes el early
        // return era solo por !myColor; ahora la cuidadora puede no tener
        // color base PERO tener overrides (caso raro: sustituta sin pauta a
        // la que se le asignan residentes específicos cross-piso). En ese
        // caso, sus rondas cuentan sobre los overrides.
        if (!myColor && overridePatientIds.length === 0) {
            return NextResponse.json({ success: true, noColorGroup: true });
        }

        // groupPatients = rama PRIMARIA (color + floor) ∪ rama OVERRIDE (IDs).
        // - PRIMARIA: residentes de MI color en MI piso. floorWhereFilter
        //   retorna {} si scope='ALL' (manager) o {floor:N} si CAREGIVER.
        // - OVERRIDE: residentes con override para mí (cualquier floor).
        //
        // Misma regla que #1 (tablet): el override bypasea floor. Si Yari2
        // (piso 2) cubre cross-piso a X (piso 1) vía override, X entra acá
        // → sus rondas sobre X cuentan en su progreso.
        const ownFloorFilter = floorWhereFilter(floorScope);
        const orConditions: any[] = [];
        if (myColor) {
            orConditions.push({
                colorGroup: myColor as any,
                ...ownFloorFilter,
            });
        }
        if (overridePatientIds.length > 0) {
            orConditions.push({ id: { in: overridePatientIds } });
        }

        const groupPatients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                OR: orConditions,
            },
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

        // Todas las atenciones del turno según tipo de guardia
        const rotations = await prisma.posturalChangeLog.findMany({
            where: { nurseId: userId, patientId: { in: groupIds }, performedAt: { gte: shiftStart } },
            select: { patientId: true, performedAt: true },
            orderBy: { performedAt: 'asc' }
        });

        let allTouches: { patientId: string; at: Date }[];

        if (isNightShift) {
            // Nocturna: rotaciones + notas clínicas de ronda nocturna
            const nightNotes = await prisma.clinicalNote.findMany({
                where: {
                    authorId: userId,
                    patientId: { in: groupIds },
                    createdAt: { gte: shiftStart },
                    content: { contains: '[RONDA NOCTURNA ZENDI]' }
                },
                select: { patientId: true, createdAt: true },
                orderBy: { createdAt: 'asc' }
            });
            allTouches = [
                ...rotations.map(r => ({ patientId: r.patientId, at: r.performedAt })),
                ...nightNotes.map(r => ({ patientId: r.patientId, at: r.createdAt })),
            ].sort((a, b) => a.at.getTime() - b.at.getTime());
        } else {
            // Diurna: rotaciones + baños + comidas + notas + pañales diurnos
            const [baths, meals, dailyLogs, dayDiapers] = await Promise.all([
                prisma.bathLog.findMany({
                    where: { caregiverId: userId, patientId: { in: groupIds }, timeLogged: { gte: shiftStart } },
                    select: { patientId: true, timeLogged: true },
                    orderBy: { timeLogged: 'asc' }
                }),
                prisma.mealLog.findMany({
                    where: { caregiverId: userId, patientId: { in: groupIds }, timeLogged: { gte: shiftStart } },
                    select: { patientId: true, timeLogged: true },
                    orderBy: { timeLogged: 'asc' }
                }),
                prisma.dailyLog.findMany({
                    where: { authorId: userId, patientId: { in: groupIds }, createdAt: { gte: shiftStart } },
                    select: { patientId: true, createdAt: true },
                    orderBy: { createdAt: 'asc' }
                }),
                prisma.clinicalNote.findMany({
                    where: {
                        authorId: userId,
                        patientId: { in: groupIds },
                        createdAt: { gte: shiftStart },
                        content: { contains: '[CAMBIO PAÑAL DIURNO ZENDI]' }
                    },
                    select: { patientId: true, createdAt: true },
                    orderBy: { createdAt: 'asc' }
                })
            ]);
            allTouches = [
                ...rotations.map(r => ({ patientId: r.patientId, at: r.performedAt })),
                ...baths.map(r => ({ patientId: r.patientId, at: r.timeLogged })),
                ...meals.map(r => ({ patientId: r.patientId, at: r.timeLogged })),
                ...dailyLogs.map(r => ({ patientId: r.patientId, at: r.createdAt })),
                ...dayDiapers.map(r => ({ patientId: r.patientId, at: r.createdAt })),
            ].sort((a, b) => a.at.getTime() - b.at.getTime());
        }

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
