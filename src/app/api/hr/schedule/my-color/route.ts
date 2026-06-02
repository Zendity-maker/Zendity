import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';
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

        // ANCLAJE AL DÍA CLÍNICO AST. Antes este endpoint usaba
        //   const todayUTCStart = new Date(); todayUTCStart.setUTCHours(0,0,0,0);
        // que es "medianoche UTC del día calendario UTC actual". Esto rompe
        // después de las 8pm AST: `new Date()` ya cruzó midnight UTC, así que
        // el "día UTC" salta al SIGUIENTE calendar day. Las ScheduledShifts
        // guardadas como medianoche UTC del día calendar AST quedan fuera del
        // rango y my-color trae la pauta de MAÑANA en lugar de HOY.
        //
        // Caso real (26-may EVENING ~9pm AST): Herminia pautada YELLOW hoy y
        // BLUE mañana. La query con setUTCHours saltó al 27-may UTC y trajo
        // BLUE. Tablet mostraba azul cuando debía mostrar amarillo.
        //
        // Fix: reusar `clinicalDayCalendarUTCRange()` — el helper probado que
        // usa `computeShiftCoverage`. Devuelve `{ start, end }` con start =
        // medianoche UTC del día calendar AST actual (transición a las 6am
        // AST), end = +24h. Esto coincide con el formato de ScheduledShift.date.
        const { start: todayUTCStart, end: todayUTCEnd } = clinicalDayCalendarUTCRange();

        const colorAssignment = await prisma.shiftColorAssignment.findFirst({
            where: {
                userId,
                headquartersId: hqId,
                assignedAt: { gte: todayUTCStart, lt: todayUTCEnd }
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
                    date: { gte: todayUTCStart, lt: todayUTCEnd },
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
                        date: { gte: todayUTCStart, lt: todayUTCEnd },
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
        //
        // 2-jun-2026: añadido filtro por rol clínico (CAREGIVER/NURSE) para
        // consistencia con `/api/care/route.ts` (mismo cálculo de isSolo). Antes
        // contaba KITCHEN/MAINTENANCE/SUPERVISOR como "cuidadores activos" — eso
        // podría haber falseado el conteo en cualquier dirección.
        if (resolvedColor && resolvedColor !== 'ALL') {
            const activeSessions = await prisma.shiftSession.count({
                where: {
                    headquartersId: hqId,
                    actualEndTime: null,
                    startTime: { gte: todayStartAST() },
                    caregiver: { role: { in: ['CAREGIVER', 'NURSE'] } },
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
