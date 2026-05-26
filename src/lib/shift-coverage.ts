import { prisma } from '@/lib/prisma';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';

export type ShiftT = 'MORNING' | 'EVENING' | 'NIGHT' | 'FULL_DAY' | 'FULL_NIGHT';

/**
 * Infiere el turno clínico (MORNING/EVENING/NIGHT) en hora AST (America/Puerto_Rico).
 * @param at  Fecha opcional. Por defecto usa la hora ACTUAL.
 *            Pasar `activeSession.startTime` para resolver el turno del momento
 *            en que el cuidador inició sesión, no el turno actual del reloj.
 */
export function inferShiftTypeFromAST(at?: Date): ShiftT {
    const astFmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico',
    });
    const hAst = parseInt(astFmt.format(at ?? new Date()), 10) % 24;
    if (hAst >= 6 && hAst < 14) return 'MORNING';
    if (hAst >= 14 && hAst < 22) return 'EVENING';
    return 'NIGHT';
}

export function canonicalShiftStartUtc(shiftType: ShiftT): Date {
    const base = todayStartAST();
    const offsetHours =
        shiftType === 'MORNING'    ? 0  :
        shiftType === 'EVENING'    ? 8  :
        shiftType === 'FULL_DAY'   ? 0  :  // 6AM–6PM
        shiftType === 'FULL_NIGHT' ? 12 :  // 6PM–6AM
        16;                                // NIGHT 10PM–6AM
    return new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
}

export interface ShiftCoverage {
    shiftType: ShiftT;
    expectedColors: string[];
    coveredColors: string[];
    absentColors: string[];
    alreadyRedistributed: string[];
    uncoveredPatients: Array<{
        patientId: string;
        name: string;
        colorGroup: string;
        room: string | null;
        assignedTo: null;
    }>;
    activeOverrides: Array<{
        id: string;
        patientId: string;
        patientName: string;
        originalColor: string;
        assignedColor: string;
        caregiverId: string;
        caregiverName: string;
        reason: string;
        createdAt: Date;
    }>;
    activeCaregivers: Array<{
        userId: string;
        name: string;
        shiftSessionId: string;
        startTime: Date;
        color: string | null;
    }>;
    redistributionNeeded: boolean;
    minutesSinceShiftStart: number;
    shiftStartUtc: Date;
}

/**
 * Computa la cobertura de color de un turno en una sede dada.
 *
 * Misma lógica que GET /api/care/shift/coverage pero como función pura
 * para que el endpoint de redistribución y el cron la puedan reusar sin
 * hacer una llamada HTTP interna (que además no llevaría sesión).
 */
export async function computeShiftCoverage(params: {
    hqId: string;
    shiftType: ShiftT;
}): Promise<ShiftCoverage> {
    const { hqId, shiftType } = params;

    // todayStart (10am UTC = 6am AST): para timestamps reales como
    //   ShiftPatientOverride.shiftDate (que ya se guardaba con esta convención).
    // scheduledDayRange (00:00 UTC del día calendar): para ScheduledShift.date
    //   que se guarda como medianoche UTC del día calendario correspondiente.
    //   ANTES este archivo filtraba ScheduledShift.date con todayStart, lo que
    //   excluía los shifts del día (00:00 < 10:00) — bug raíz de "imposible
    //   redistribuir" y "sin grupo asignado" en piso.
    const todayStart = todayStartAST();
    const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const scheduledDayRange = clinicalDayCalendarUTCRange();
    const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);

    // FIX: pre-fetch scheduleIds en paralelo con las otras queries para evitar el JOIN
    // implícito que Prisma genera con `schedule: { headquartersId }` — ese JOIN sin índice
    // causaba timeouts en Neon cold start (835ms warm → >5000ms frío → 500).
    // Patrón: Schedule + shiftSession + shiftPatientOverride corren en paralelo (warm-up
    // de la conexión Neon); luego scheduledShift usa los IDs en memoria, sin JOIN.
    const oneWeekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [recentSchedules, activeSessions, activeOverrides] = await Promise.all([
        prisma.schedule.findMany({
            where: { headquartersId: hqId, weekStartDate: { gte: oneWeekAgo } },
            select: { id: true },
        }),
        prisma.shiftSession.findMany({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: fourteenHrsAgo },
            },
            include: { caregiver: { select: { id: true, name: true } } },
        }),
        prisma.shiftPatientOverride.findMany({
            where: {
                headquartersId: hqId,
                shiftType,
                shiftDate: { gte: todayStart, lt: tomorrow },
                isActive: true,
            },
            include: {
                patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true } },
                caregiver: { select: { id: true, name: true } },
            },
        }),
    ]);

    const scheduleIds = recentSchedules.map(s => s.id);
    const scheduledShifts = scheduleIds.length === 0 ? [] : await prisma.scheduledShift.findMany({
        where: {
            scheduleId: { in: scheduleIds },
            shiftType: shiftType as any,
            date: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
            isAbsent: false,
            colorGroup: { not: null },
        },
        select: { id: true, userId: true, colorGroup: true },
    });

    const expectedColorsSet = new Set<string>();
    for (const s of scheduledShifts) {
        if (s.colorGroup && s.colorGroup !== 'UNASSIGNED') expectedColorsSet.add(s.colorGroup);
    }
    const expectedColors = Array.from(expectedColorsSet).sort();

    const activeUserIds = activeSessions.map(s => s.caregiverId);

    // FIX: usar scheduledShiftId explícito en lugar del nested relation filter
    // `scheduledShift: { shiftType, date }` que generaba JOINs ineficientes y
    // 500s intermitentes en producción. Los IDs ya están en memoria del query anterior.
    const activeUserShiftIds = scheduledShifts
        .filter(s => activeUserIds.includes(s.userId))
        .map(s => s.id);

    let colorAssignments: Array<{ userId: string; color: string }> = [];
    if (activeUserShiftIds.length > 0) {
        try {
            colorAssignments = await prisma.shiftColorAssignment.findMany({
                where: { scheduledShiftId: { in: activeUserShiftIds } },
                select: { userId: true, color: true },
            });
        } catch (e) {
            // Fallback: sin asignaciones manuales → se usa colorGroup del ScheduledShift
            console.warn('[shift-coverage] ShiftColorAssignment query failed, fallback a colorGroup:', e);
        }
    }

    const coveredByUser = new Map<string, Set<string>>();
    for (const a of colorAssignments) {
        if (!coveredByUser.has(a.userId)) coveredByUser.set(a.userId, new Set());
        coveredByUser.get(a.userId)!.add(a.color);
    }
    for (const s of scheduledShifts) {
        if (!activeUserIds.includes(s.userId)) continue;
        if (coveredByUser.has(s.userId)) continue;
        if (!s.colorGroup || s.colorGroup === 'UNASSIGNED') continue;
        coveredByUser.set(s.userId, new Set([s.colorGroup]));
    }

    const coveredColorsSet = new Set<string>();
    for (const colors of coveredByUser.values()) {
        for (const c of colors) coveredColorsSet.add(c);
    }
    const coveredColors = Array.from(coveredColorsSet).sort();

    const absentColors = expectedColors.filter(c => !coveredColorsSet.has(c));

    const redistributedSet = new Set<string>();
    for (const ov of activeOverrides) redistributedSet.add(ov.originalColor);
    const alreadyRedistributed = absentColors.filter(c => redistributedSet.has(c)).sort();

    const overriddenPatientIds = new Set(activeOverrides.map(o => o.patientId));
    let uncoveredPatients: ShiftCoverage['uncoveredPatients'] = [];
    if (absentColors.length > 0) {
        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                colorGroup: { in: absentColors as any[] },
            },
            select: { id: true, name: true, colorGroup: true, roomNumber: true },
            orderBy: [{ colorGroup: 'asc' }, { name: 'asc' }],
        });
        uncoveredPatients = patients
            .filter(p => !overriddenPatientIds.has(p.id))
            .map(p => ({
                patientId: p.id,
                name: p.name,
                colorGroup: p.colorGroup,
                room: p.roomNumber,
                assignedTo: null,
            }));
    }

    const activeCaregivers = activeSessions.map(s => {
        const colors = coveredByUser.get(s.caregiverId);
        const firstColor = colors ? Array.from(colors)[0] : null;
        return {
            userId: s.caregiverId,
            name: s.caregiver?.name || 'Cuidador',
            shiftSessionId: s.id,
            startTime: s.startTime,
            color: firstColor,
        };
    });

    const shiftStartUtc = canonicalShiftStartUtc(shiftType);
    const minutesSinceShiftStart = Math.max(
        0,
        Math.round((Date.now() - shiftStartUtc.getTime()) / 60000),
    );

    return {
        shiftType,
        expectedColors,
        coveredColors,
        absentColors,
        alreadyRedistributed,
        uncoveredPatients,
        activeOverrides: activeOverrides.map(ov => ({
            id: ov.id,
            patientId: ov.patientId,
            patientName: ov.patient?.name || '—',
            originalColor: ov.originalColor,
            assignedColor: ov.assignedColor,
            caregiverId: ov.caregiverId,
            caregiverName: ov.caregiver?.name || '—',
            reason: ov.reason,
            createdAt: ov.createdAt,
        })),
        activeCaregivers,
        redistributionNeeded: uncoveredPatients.length > 0,
        minutesSinceShiftStart,
        shiftStartUtc,
    };
}

// ════════════════════════════════════════════════════════════════════════════
// resolveCaregiverCurrentColors — qué colores cubre un caregiver AHORA
// ────────────────────────────────────────────────────────────────────────────
// Devuelve los colores efectivos del caregiver para el shiftType actual.
// Anclar al turno ACTUAL es la diferencia crítica: una caregiver pautada NIGHT
// (10pm-6am) que hace clock-in a las 6pm (4h antes) NO es dueña de NIGHT-BLUE
// hasta que efectivamente comience NIGHT. Antes de las 10pm, esta función
// devuelve [] para ella — su pauta no aplica todavía.
//
// Esto bloquea el bug "Brendalis clock-in 6pm → Mariangelie pierde cobertura
// del AZUL prematuramente". Ver shift/start Sprint N.3 Parte C.
//
// Fuentes consultadas, en orden de precedencia:
//   1. ShiftColorAssignment del día (coberturas explícitas — SUMAN al base).
//   2. ScheduledShift CON shiftType === inferShiftTypeFromAST(at) (color base).
//   3. Fallback overtime: si el caregiver tiene session activa y su pauta del
//      día NO coincide con el shiftType actual, NO cae a "tomar cualquier
//      pauta del día" — devuelve []. La lógica de turnos largos (FULL_DAY,
//      FULL_NIGHT) sí matchea porque esos shiftTypes representan ventanas
//      completas que sí abarcan el reloj actual.
//
// La función es PURA respecto a entradas (caregiverId, hqId, at) y queries
// Prisma — no lee session ni headers. Testeable en aislamiento.
//
// Devuelve los colores como string[] (ej. ['BLUE'], [], ['BLUE','YELLOW']).
// ════════════════════════════════════════════════════════════════════════════
export async function resolveCaregiverCurrentColors(params: {
    caregiverId: string;
    hqId: string;
    /** Hora a evaluar. Por defecto: now. Pasar `shiftSession.startTime` si
     *  quieres anclar al momento del clock-in en vez del momento actual. */
    at?: Date;
}): Promise<string[]> {
    const { caregiverId, hqId, at } = params;
    const dayStart = todayStartAST();

    // 1. ShiftColorAssignments del día — coberturas adicionales explícitas
    const colorAssignments = await prisma.shiftColorAssignment.findMany({
        where: {
            headquartersId: hqId,
            userId: caregiverId,
            assignedAt: { gte: dayStart },
        },
        select: { color: true },
    });
    const overrideColors = colorAssignments.map(a => a.color).filter(Boolean);

    // 2. ScheduledShift del caregiver cuya ventana CONTIENE la hora `at`.
    //    Una pauta NIGHT (22–06) no aplica a las 6pm. Una pauta FULL_NIGHT
    //    (18–06) sí aplica a las 6pm porque su ventana incluye esa hora.
    //    Evaluación por hora exacta (no por bucket) para no incluir turnos
    //    futuros — el bug Brendalis era exactamente esto.
    const compatibleShiftTypes = compatibleShiftTypesAt(at);

    const scheduledNow = await prisma.scheduledShift.findFirst({
        where: {
            userId: caregiverId,
            date: { gte: dayStart },
            isAbsent: false,
            shiftType: { in: compatibleShiftTypes as any[] },
            colorGroup: { not: null },
            schedule: { headquartersId: hqId, status: 'PUBLISHED' },
        },
        select: { colorGroup: true },
    });
    const baseColor = scheduledNow?.colorGroup && scheduledNow.colorGroup !== 'UNASSIGNED'
        ? [scheduledNow.colorGroup]
        : [];

    // Unión deduplicada
    return Array.from(new Set([...baseColor, ...overrideColors]));
}

/**
 * Devuelve los `ScheduledShift.shiftType` cuya ventana AST contiene la hora
 * `at`. La diferencia con `inferShiftTypeFromAST` es que aquella devuelve
 * UN bucket (MORNING/EVENING/NIGHT), mientras que esta devuelve TODOS los
 * shiftTypes activos en ese minuto — incluyendo turnos largos (FULL_DAY,
 * FULL_NIGHT) que coexisten con los regulares.
 *
 * Ventanas AST:
 *   MORNING:    06–14
 *   EVENING:    14–22
 *   NIGHT:      22–06
 *   FULL_DAY:   06–18
 *   FULL_NIGHT: 18–06
 *
 * Edge cases:
 *   - A las 14:30 (early EVENING): EVENING + FULL_DAY (no FULL_NIGHT, no MORNING).
 *   - A las 18:30 (late EVENING):  EVENING + FULL_NIGHT (FULL_DAY ya terminó).
 *   - A las 22:00 (NIGHT start):   NIGHT + FULL_NIGHT.
 *
 * Esta precisión por hora evita que una caregiver pautada FULL_NIGHT (18–06)
 * aparezca como "cubriendo EVENING" a las 14:30 — su turno no inicia hasta
 * las 18:00.
 */
export function compatibleShiftTypesAt(at?: Date): ShiftT[] {
    const astFmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico',
    });
    const hAst = parseInt(astFmt.format(at ?? new Date()), 10) % 24;
    const out: ShiftT[] = [];
    if (hAst >= 6 && hAst < 14)  out.push('MORNING');
    if (hAst >= 14 && hAst < 22) out.push('EVENING');
    if (hAst >= 22 || hAst < 6)  out.push('NIGHT');
    if (hAst >= 6 && hAst < 18)  out.push('FULL_DAY');
    if (hAst >= 18 || hAst < 6)  out.push('FULL_NIGHT');
    return out;
}
