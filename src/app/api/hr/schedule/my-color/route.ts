import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { todayStartAST } from '@/lib/dates';

/**
 * Fallback determinista cuando no hay horario publicado ni asignación manual.
 * Garantiza que TODO residente ACTIVE quede cubierto por alguna cuidadora
 * mientras el Schedule oficial se publica.
 *
 *   1 cuidadora  → 'ALL'                     (ve a todos)
 *   2 cuidadoras → RED+YELLOW / GREEN+BLUE   (dividido en 2 bloques)
 *   3 cuidadoras → RED / YELLOW / BLUE       (uno por color activo)
 *   4+ cuidadoras → RED / YELLOW / GREEN / BLUE (round-robin)
 *
 * Las combinaciones ("RED,YELLOW") se filtran vía `colorGroup IN (…)` en
 * /api/care/route.ts.
 */
function autoFallbackColor(position: number, totalActive: number): string {
    if (totalActive <= 1) return 'ALL';
    if (totalActive === 2) {
        return position === 0 ? 'RED,YELLOW' : 'GREEN,BLUE';
    }
    if (totalActive === 3) {
        const palette = ['RED', 'YELLOW', 'BLUE'];
        return palette[position] || 'ALL';
    }
    const palette = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
    return palette[position % palette.length];
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const hqId = searchParams.get('hqId');

        if (!userId || !hqId) {
            return NextResponse.json({ success: false, color: null });
        }

        const today = new Date();

        // Resolver color del día (prioridad: asignación manual → roster publicado)
        let resolvedColor: string | null = null;
        let source: 'assignment' | 'roster' | 'AUTO_FALLBACK' | 'none' = 'none';

        const colorAssignment = await prisma.shiftColorAssignment.findFirst({
            where: {
                userId,
                headquartersId: hqId,
                assignedAt: { gte: startOfDay(today), lte: endOfDay(today) }
            },
            orderBy: { assignedAt: 'desc' }
        });

        if (colorAssignment) {
            resolvedColor = colorAssignment.color;
            source = 'assignment';
        } else {
            const todayShift = await prisma.scheduledShift.findFirst({
                where: {
                    userId,
                    date: { gte: startOfDay(today), lte: endOfDay(today) },
                    isAbsent: false,
                    schedule: {
                        headquartersId: hqId,
                        status: 'PUBLISHED'
                    }
                },
                orderBy: { date: 'desc' }
            });
            if (todayShift) {
                resolvedColor = todayShift.colorGroup;
                source = 'roster';
            }
        }

        // FIX solitario: si el color resuelto NO es null y NO es 'ALL',
        // contar cuántos ShiftSessions abiertos hay hoy en la sede.
        // Si hay ≤ 1 sesión activa, el cuidador es único → ve todos los residentes.
        if (resolvedColor && resolvedColor !== 'ALL') {
            const activeSessions = await prisma.shiftSession.count({
                where: {
                    headquartersId: hqId,
                    actualEndTime: null,
                    startTime: { gte: todayStartAST() }
                }
            });

            if (activeSessions <= 1) {
                return NextResponse.json({
                    success: true,
                    color: 'ALL',
                    auto: true,
                    originalColor: resolvedColor,
                    source,
                });
            }
        }

        if (resolvedColor) {
            return NextResponse.json({ success: true, color: resolvedColor, source });
        }

        // ─── AUTO_FALLBACK ──────────────────────────────────────────────
        // Sin roster publicado ni asignación manual: asignar color
        // determinísticamente en función de la posición (orden de clock-in)
        // entre las sesiones activas de la sede.
        // No se persiste en DB — es efímero y muta si llegan/salen cuidadoras.
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: todayStartAST() }
            },
            orderBy: { startTime: 'asc' },
            select: { caregiverId: true }
        });

        const position = activeSessions.findIndex(s => s.caregiverId === userId);
        if (position >= 0) {
            const autoColor = autoFallbackColor(position, activeSessions.length);
            return NextResponse.json({
                success: true,
                color: autoColor,
                source: 'AUTO_FALLBACK',
                message: 'Sin horario publicado — distribución automática temporal',
                position,
                totalActive: activeSessions.length,
            });
        }

        return NextResponse.json({ success: true, color: null, source: 'none' });

    } catch (error) {
        console.error('my-color error:', error);
        return NextResponse.json({ success: false, color: null });
    }
}
