import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { compatibleShiftTypesAt } from '@/lib/shift-coverage';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const hqId = searchParams.get('hqId');

        if (!userId || !hqId) {
            return NextResponse.json({ success: false, color: null });
        }

        // FIX — turno cruce de límite: si la cuidadora tiene una ShiftSession activa,
        // anclamos el filtro de shiftType al INICIO de esa sesión, no a la hora actual.
        // Ejemplo: inició a las 6 AM (MORNING). Si ahora son las 3 PM (EVENING),
        // necesitamos buscar su ScheduledShift MORNING — sin esto, my-color
        // retornaría null y el tablet quedaría vacío durante el cruce.
        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId: userId,
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: todayStartAST() },
            },
            orderBy: { startTime: 'desc' },
            select: { id: true, startTime: true },
        });

        // Si hay sesión activa, anclamos a su startTime; si no, a la hora actual.
        // compatibleShiftTypesAt usa esto para devolver los turnos cuya ventana
        // CONTIENE ese momento (con tolerancia a FULL_DAY/FULL_NIGHT).
        const evaluatedAt = activeSession?.startTime ?? undefined;

        // Resolver color del día (prioridad: asignación manual → roster publicado del turno)
        let resolvedColor: string | null = null;
        let shiftNotes: string | null = null;
        // Posibles fuentes del color (o de la ausencia de color):
        //   'assignment'         → ColorAssignment manual hoy
        //   'roster'             → ScheduledShift compatible con shiftType actual
        //   'no_color_assigned'  → shift hoy SIN colorGroup (KITCHEN/MAINTENANCE)
        //   'shift_not_current'  → shift hoy CON colorGroup pero NO en shiftType actual
        //                          (ej. Brendali pautada NIGHT haciendo clock-in 18:00).
        //                          Crítico: frontend NO debe caer a localStorage en este caso.
        //   'none'               → no hay shift HOY ni asignación (caregiver fuera de pauta).
        let source: 'assignment' | 'roster' | 'none' | 'no_color_assigned' | 'shift_not_current' = 'none';

        // Los shifts se guardan como medianoche UTC (ej. 2026-05-11T00:00:00.000Z).
        // startOfDay(date-fns) usa la TZ local del servidor (UTC-4 en Vercel PR)
        // y produce 04:00 UTC, que excluye esos shifts. Usar UTC midnight puro.
        const todayUTCStart = new Date();
        todayUTCStart.setUTCHours(0, 0, 0, 0);
        const todayUTCEnd = new Date();
        todayUTCEnd.setUTCHours(23, 59, 59, 999);

        const colorAssignment = await prisma.shiftColorAssignment.findFirst({
            where: {
                userId,
                headquartersId: hqId,
                assignedAt: { gte: todayUTCStart, lte: todayUTCEnd }
            },
            orderBy: { assignedAt: 'desc' }
        });

        if (colorAssignment) {
            resolvedColor = colorAssignment.color;
            source = 'assignment';
        } else {
            // Buscar ScheduledShift del turno actual. Usamos compatibleShiftTypesAt
            // para limitar el filtro a turnos cuya ventana CONTIENE la hora actual
            // (o la hora de inicio de sesión si está activa). Esto cierra el bug
            // de "entrante temprano se le asigna color futuro": a las 18:00, una
            // pauta NIGHT (22-06) NO es compatible — devolvemos null para que el
            // CoveragePickerModal del tablet ofrezca claim explícito.
            //
            // Antes (eliminado): un "ajuste operacional" expandía el filtro a
            // TODOS los turnos del día para "no quedar sin color asignado", lo
            // cual difuminaba responsabilidad y antagonizaba el fix de
            // shift/start (rama A).
            const compatibleShiftTypes = compatibleShiftTypesAt(evaluatedAt);

            const todayShift = await prisma.scheduledShift.findFirst({
                where: {
                    userId,
                    date: { gte: todayUTCStart, lte: todayUTCEnd },
                    shiftType: { in: compatibleShiftTypes as any[] },
                    isAbsent: false,
                    schedule: {
                        headquartersId: hqId,
                        status: 'PUBLISHED'
                    }
                },
                // Si hay múltiples turnos del día, priorizar el más reciente.
                orderBy: { date: 'desc' }
            });
            if (todayShift) {
                // Capturar notas del turno independientemente del colorGroup
                shiftNotes = todayShift.notes || null;
                if (todayShift.colorGroup) {
                    resolvedColor = todayShift.colorGroup;
                    source = 'roster';
                } else {
                    // Shift existe pero sin colorGroup (ej. SUPERVISOR_DAY, KITCHEN).
                    // Devolver color=null + source especial para que el tablet NO caiga
                    // a localStorage — en su lugar muestra "sin residentes asignados".
                    source = 'no_color_assigned';
                }
            } else {
                // No hubo match con un shiftType compatible. Pero quizás hay una pauta
                // HOY para otro shiftType (ej. Brendali NIGHT entrando 4h antes en
                // EVENING). Detectamos ese caso para devolver source distinta — el
                // frontend NO debe caer a localStorage (su pauta NIGHT no aplica AHORA;
                // tomar el color cacheado sería incorrecto).
                const anyShiftToday = await prisma.scheduledShift.findFirst({
                    where: {
                        userId,
                        date: { gte: todayUTCStart, lte: todayUTCEnd },
                        isAbsent: false,
                        colorGroup: { not: null },
                        schedule: { headquartersId: hqId, status: 'PUBLISHED' },
                    },
                    select: { shiftType: true, notes: true },
                });
                if (anyShiftToday) {
                    shiftNotes = anyShiftToday.notes || null;
                    source = 'shift_not_current';
                }
                // Si tampoco hay pauta HOY → source queda 'none' (caregiver realmente
                // fuera de pauta hoy, fallback a localStorage es razonable).
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
                    shiftNotes,
                });
            }
        }

        if (resolvedColor) {
            return NextResponse.json({ success: true, color: resolvedColor, source, shiftNotes });
        }

        // Sin color. source puede ser:
        //  - 'no_color_assigned' → shift encontrado pero sin colorGroup (KITCHEN, etc.)
        //  - 'shift_not_current' → shift HOY con colorGroup pero NO compatible con el shiftType actual
        //  - 'none'              → no hay shift hoy ni asignación
        // Frontend trata 'no_color_assigned' y 'shift_not_current' igual: no-color screen
        // sin caer a localStorage. Solo 'none' permite el fallback a localStorage.
        return NextResponse.json({ success: true, color: null, source, shiftNotes });

    } catch (error) {
        console.error('my-color error:', error);
        return NextResponse.json({ success: false, color: null });
    }
}
