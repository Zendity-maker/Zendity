import { prisma } from '@/lib/prisma';
import { todayStartAST, clinicalDayCalendarUTCRange, clinicalDay } from '@/lib/dates';

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

// ════════════════════════════════════════════════════════════════════════════
// Fail-safe del censo (Rama B) — helpers puros + derivePopulatedColors
// ────────────────────────────────────────────────────────────────────────────
// Antes: expectedColors se derivaba SOLO de scheduledShifts no-absent. Si la
// pauta del color X estaba marcada como absent, X desaparecía de expectedColors
// → absentColors no lo veía → uncoveredPatients=[] → residentes huérfanos.
//
// Ahora: expectedColors = UNION(scheduledColors, populatedColors), donde
// populatedColors viene de `Patient.colorGroup DISTINCT WHERE status='ACTIVE'`.
// Cualquier color con residentes activos entra en expectedColors aun si no
// hay pauta no-absent — la pregunta correcta es "¿hay residentes con este
// color?", no "¿hay pauta para este color?".
//
// Adicionalmente: activeOverrides retornado al consumer se filtra para incluir
// SOLO overrides cuyo caregiver tiene session activa (no huérfanos de cuidadores
// clocked-out). El supervisor ve solo cobertura real.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Devuelve los colores distintos con residentes ACTIVE en una sede. Útil
 * como fuente del fail-safe del censo — no depende de pautas.
 */
export async function derivePopulatedColors(hqId: string): Promise<Set<string>> {
    const rows = await prisma.patient.findMany({
        where: { headquartersId: hqId, status: 'ACTIVE' },
        select: { colorGroup: true },
        distinct: ['colorGroup'],
    });
    const out = new Set<string>();
    for (const r of rows) {
        if (r.colorGroup && r.colorGroup !== 'UNASSIGNED') out.add(r.colorGroup);
    }
    return out;
}

/**
 * Une los colores derivados de pautas con los colores poblados (residentes
 * con `Patient.colorGroup=X`). Helper puro.
 *
 * `scheduledColors`: derivados de scheduledShifts NO marcados absent.
 * `populatedColors`: derivados de `Patient.colorGroup DISTINCT` (status ACTIVE).
 *
 * Retorna la unión: cualquier color en cualquiera de los dos cuenta como
 * "esperado". Esto cierra el silent-drop cuando una pauta queda absent.
 */
export function augmentExpectedColors(
    scheduledColors: Set<string>,
    populatedColors: Set<string>,
): Set<string> {
    return new Set([...scheduledColors, ...populatedColors]);
}

/**
 * Filtra una lista de overrides para retornar solo aquellos cuyo caregiver
 * tiene session activa. Helper puro.
 *
 * Los overrides huérfanos (caregiver clocked-out pero `isActive=true` por
 * falta del cleanup en shift/end — rama C) NO cuentan como cobertura real.
 * Quitarlos del retorno evita el falso positivo "Mariangelie cubre BLUE"
 * en el wall del supervisor cuando Mariangelie ya se fue.
 *
 * Tipo genérico: cualquier objeto con `caregiverId: string`.
 */
export function filterRealOverrides<T extends { caregiverId: string }>(
    overrides: T[],
    activeUserIds: Set<string> | string[],
): T[] {
    const active = activeUserIds instanceof Set ? activeUserIds : new Set(activeUserIds);
    return overrides.filter((o) => active.has(o.caregiverId));
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

    const [recentSchedules, activeSessions, activeOverridesRaw, populatedColors] = await Promise.all([
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
        // Fail-safe del censo — fuente de verdad: colores con residentes
        // ACTIVE en la sede, no las pautas. Garantiza que si una pauta queda
        // marcada absent, el color con residentes igual entra en expectedColors.
        derivePopulatedColors(hqId),
    ]);

    // Filtrar overrides huérfanos (caregiver clocked-out). El supervisor solo
    // ve cobertura real — los huérfanos no engañan al wall hasta que C los limpie.
    const activeUserIdsSet = new Set(activeSessions.map(s => s.caregiverId));
    const activeOverrides = filterRealOverrides(activeOverridesRaw, activeUserIdsSet);

    const scheduleIds = recentSchedules.map(s => s.id);
    const scheduledShifts = scheduleIds.length === 0 ? [] : await prisma.scheduledShift.findMany({
        where: {
            scheduleId: { in: scheduleIds },
            shiftType: shiftType as any,
            date: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
            isAbsent: false,
            releasedAt: null,                   // FASE 82: ignorar pautas liberadas manualmente
            colorGroup: { not: null },
        },
        select: { id: true, userId: true, colorGroup: true },
    });

    const scheduledColorsSet = new Set<string>();
    for (const s of scheduledShifts) {
        // 'ALL' NO es un color literal — significa "cubre todos los colores"
        // (cuidadora solitaria / guardia que ve todo el piso). Si entra a
        // expectedColors, luego cae en absentColors y la query
        // `patient.findMany({ colorGroup: { in: [...,'ALL'] } })` CRASHEA
        // porque 'ALL' no es un valor del enum ColorGroup. Se excluye como
        // UNASSIGNED; su efecto de cobertura se maneja abajo (cubre todo).
        if (s.colorGroup && s.colorGroup !== 'UNASSIGNED' && s.colorGroup !== 'ALL') scheduledColorsSet.add(s.colorGroup);
    }
    // Fail-safe: expectedColors = UNION(pautas no-absent, colores con residentes
    // activos). Si EmpX BLUE está absent, BLUE no entra por scheduledColorsSet
    // pero sí entra vía populatedColors → absentColors lo detecta como uncovered.
    const expectedColorsSet = augmentExpectedColors(scheduledColorsSet, populatedColors);
    const expectedColors = Array.from(expectedColorsSet).sort();

    // FIX (2026-06-14): query por userId + assignedAt en lugar de
    // scheduledShiftId. Motivo operacional descubierto en prod:
    //
    //   Mariangelie no tenía ScheduledShift hoy (sábado, fuera de pauta) pero
    //   el supervisor le creó ShiftColorAssignment color=RED para que cubriera
    //   como sustituta. El filtro anterior (scheduledShiftId ∈ activeUserShiftIds)
    //   solo recogía assignments LIGADOS a un shift activo del día, así que el
    //   ColorAssignment de Mariangelie quedaba huérfano → RED entraba a
    //   absentColors aunque ella estuviera en piso con asignación explícita.
    //
    //   El fix usa la semántica real de ColorAssignment: "esta cuidadora cubre
    //   este color HOY", independiente de si tiene pauta hoy. Tomamos el más
    //   reciente por userId del día clínico actual.
    const activeUserIds = Array.from(activeUserIdsSet);

    let colorAssignments: Array<{ userId: string; color: string }> = [];
    if (activeUserIds.length > 0) {
        try {
            const rawAssignments = await prisma.shiftColorAssignment.findMany({
                where: {
                    headquartersId: hqId,
                    userId: { in: activeUserIds },
                    assignedAt: { gte: todayStart, lt: tomorrow },
                },
                select: { userId: true, color: true, assignedAt: true },
                orderBy: { assignedAt: 'desc' },
            });
            // Dedupe: una sola asignación por userId (la más reciente del día).
            const seen = new Set<string>();
            colorAssignments = rawAssignments.filter(a => {
                if (seen.has(a.userId)) return false;
                seen.add(a.userId);
                return true;
            }).map(a => ({ userId: a.userId, color: a.color }));
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
        if (!activeUserIdsSet.has(s.userId)) continue;
        if (coveredByUser.has(s.userId)) continue;
        if (!s.colorGroup || s.colorGroup === 'UNASSIGNED') continue;
        coveredByUser.set(s.userId, new Set([s.colorGroup]));
    }

    const coveredColorsSet = new Set<string>();
    for (const colors of coveredByUser.values()) {
        for (const c of colors) {
            if (c === 'ALL') {
                // Una cuidadora pautada/asignada 'ALL' cubre TODOS los colores
                // esperados (ve todo el piso). Marcamos cada expectedColor como
                // cubierto — así una sola en guardia con ALL no genera huérfanos
                // falsos. Con varias en colores específicos, ALL no aplica y los
                // huérfanos se detectan normal.
                for (const ec of expectedColors) coveredColorsSet.add(ec);
            } else {
                coveredColorsSet.add(c);
            }
        }
    }

    // Punto de partida — colores que NINGÚN caregiver activo lleva por pauta
    // ni por ShiftColorAssignment. Esto NO es la respuesta final: aún falta
    // ver si la cobertura existe a nivel paciente (vía overrides).
    const absentColorsRaw = expectedColors.filter(c => !coveredColorsSet.has(c));

    const overriddenPatientIds = new Set(activeOverrides.map(o => o.patientId));

    // PROMOCIÓN POR OVERRIDES — un color "absent" en pauta/asignación se
    // considera covered si TODOS sus pacientes ACTIVE tienen override activo
    // a una caregiver también activa. `activeOverrides` ya está filtrado por
    // `filterRealOverrides(... activeUserIdsSet)` arriba (línea 206), así que
    // los overrides huérfanos (caregiver clocked-out) NO cuentan aquí.
    //
    // Por qué: tras `redistributeUncoveredColors`, los pacientes BLUE quedan
    // con override activo a, p.ej., Brenda (pautada YELLOW). Nadie "es" de
    // BLUE a nivel pauta — pero los pacientes BLUE sí tienen cuidadora. El
    // override ES el mecanismo de cobertura por paciente; la cobertura por
    // color se deriva de él. Sin esta promoción, `absentColors` reportaba
    // BLUE eternamente y el wall mostraba el banner aunque no quedara nadie
    // descubierto.
    let absentColorPatients: Array<{
        id: string;
        name: string;
        colorGroup: string | null;
        roomNumber: string | null;
    }> = [];
    if (absentColorsRaw.length > 0) {
        absentColorPatients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                colorGroup: { in: absentColorsRaw as any[] },
            },
            select: { id: true, name: true, colorGroup: true, roomNumber: true },
            orderBy: [{ colorGroup: 'asc' }, { name: 'asc' }],
        });
    }

    const patientsByAbsentColor = new Map<string, typeof absentColorPatients>();
    for (const p of absentColorPatients) {
        if (!p.colorGroup) continue;
        if (!patientsByAbsentColor.has(p.colorGroup)) patientsByAbsentColor.set(p.colorGroup, []);
        patientsByAbsentColor.get(p.colorGroup)!.push(p);
    }
    const derivedCoveredSet = new Set<string>();
    for (const color of absentColorsRaw) {
        const ps = patientsByAbsentColor.get(color) || [];
        // Sin pacientes ACTIVE de ese color → no se "deriva" cobertura.
        // (Caso raro: color en expectedColors por populatedColors, todos en
        // HOSPITAL. Mantener el comportamiento previo — sigue en absent.)
        if (ps.length === 0) continue;
        const allCovered = ps.every(p => overriddenPatientIds.has(p.id));
        if (allCovered) derivedCoveredSet.add(color);
    }
    for (const c of derivedCoveredSet) coveredColorsSet.add(c);

    const coveredColors = Array.from(coveredColorsSet).sort();
    const absentColors = absentColorsRaw.filter(c => !derivedCoveredSet.has(c));

    const redistributedSet = new Set<string>();
    for (const ov of activeOverrides) redistributedSet.add(ov.originalColor);
    const alreadyRedistributed = absentColors.filter(c => redistributedSet.has(c)).sort();

    // uncoveredPatients reutiliza la query ya hecha — filtra a los colores que
    // siguen en absentColors después de la promoción (los derivados covered ya
    // no aportan pacientes "uncovered").
    let uncoveredPatients: ShiftCoverage['uncoveredPatients'] = [];
    if (absentColors.length > 0) {
        const absentSet = new Set(absentColors);
        uncoveredPatients = absentColorPatients
            .filter((p): p is typeof p & { colorGroup: string } =>
                !!p.colorGroup && absentSet.has(p.colorGroup),
            )
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
// resolveCaregiverCurrentColors — wrapper de compat sobre resolveCaregiverColors
// ────────────────────────────────────────────────────────────────────────────
// Mantiene la firma anterior para no romper callers (claim-coverage, etc).
// Comportamiento idéntico: unión de (ScheduledShift compatible con `at`) +
// (ShiftColorAssignments del día), sin overtime fallback, sin source.
//
// NUEVOS callers — usar `resolveCaregiverColors({ mode:'single', ... })` o
// `resolveCaregiverColors({ mode:'batch', ... })` directamente.
// ════════════════════════════════════════════════════════════════════════════
export function resolveCaregiverCurrentColors(params: {
    caregiverId: string;
    hqId: string;
    /** Hora a evaluar. Por defecto: now. Pasar `shiftSession.startTime` si
     *  quieres anclar al momento del clock-in en vez del momento actual. */
    at?: Date;
}): Promise<string[]> {
    return resolveCaregiverColors({
        mode: 'single',
        caregiverId: params.caregiverId,
        hqId: params.hqId,
        at: params.at,
    });
}

// ════════════════════════════════════════════════════════════════════════════
// (Cuerpo histórico — referencia inline, no se ejecuta. Borrar tras migración
//  completa de callers en PASO 2.)
// ────────────────────────────────────────────────────────────────────────────
// async function resolveCaregiverCurrentColors_legacy(params: {
//     caregiverId: string; hqId: string; at?: Date;
// }): Promise<string[]> {
//     const { caregiverId, hqId, at } = params;
//     const dayStart = todayStartAST();
//
//     // 1. ShiftColorAssignments del día — coberturas adicionales explícitas
//     const colorAssignments = await prisma.shiftColorAssignment.findMany({
//         where: { headquartersId: hqId, userId: caregiverId, assignedAt: { gte: dayStart } },
//         select: { color: true },
//     });
//     const overrideColors = colorAssignments.map(a => a.color).filter(Boolean);
//     // 2. ScheduledShift cuya ventana CONTIENE `at`.
//     const compatibleShiftTypes = compatibleShiftTypesAt(at);
//     const scheduledNow = await prisma.scheduledShift.findFirst({
//         where: {
//             userId: caregiverId, date: { gte: dayStart }, isAbsent: false,
//             shiftType: { in: compatibleShiftTypes as any[] },
//             colorGroup: { not: null },
//             schedule: { headquartersId: hqId, status: 'PUBLISHED' },
//         },
//         select: { colorGroup: true },
//     });
//     const baseColor = scheduledNow?.colorGroup && scheduledNow.colorGroup !== 'UNASSIGNED'
//         ? [scheduledNow.colorGroup] : [];
//     return Array.from(new Set([...baseColor, ...overrideColors]));
// }

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

// ════════════════════════════════════════════════════════════════════════════
// CONSOLIDATED COLOR RESOLVER — el chokepoint canónico
// ────────────────────────────────────────────────────────────────────────────
// Reemplaza la lógica DUPLICADA que vivía inline en:
//   - GET /api/hr/schedule/my-color (un cuidador, con `source` semántico)
//   - shift/start.resolveAssignedPatients (un cuidador, con overtime fallback
//     y solo-mode)
//   - GET /api/care/supervisor/caregiver-rounds (batch, con overtime fallback)
//
// Reglas (decisiones cerradas con el dueño, ver CLAUDE.md):
//
//   D1 ADITIVO — el color de una cuidadora es la UNIÓN deduplicada de
//      (base pautado del Builder) ∪ (ShiftColorAssignments del día). Nunca
//      "el primero". El wall muestra TODOS sus colores.
//
//   D2 VENTANA — el matching de turno usa `compatibleShiftTypesAt(at)`
//      (ventanas con FULL_DAY/FULL_NIGHT), nunca `inferShiftTypeFromAST(at)`
//      (bucket único). Una pauta FULL_NIGHT (18–06) ENTRA al resolver a las
//      19:00; con bucket único no entraba.
//
//   D3 BOUNDARIES — `clinicalDay(at?)` es el único source-of-truth para
//      "qué día clínico" y devuelve ambas anclas:
//        - `calendarStartUtc/End` (00:00–24:00 UTC del calendar AST day) para
//          filtros sobre `ScheduledShift.date`.
//        - `boundary6amUtc` (10:00 UTC = 6 AM AST) para `gte` sobre
//          timestamps reales como `ShiftColorAssignment.assignedAt`.
//      Ambas anclas comparten el rollback antes-de-6am.
//
//   D4 OVERTIME FALLBACK — flag opt-in. Cuando hay sesión activa pero
//      ninguna pauta del día tiene shiftType compatible con `at`, busca la
//      pauta MÁS RECIENTE de cualquier shiftType del día y la usa como
//      base. Útil en paths que filtran pacientes (shift/start, caregiver-
//      rounds). my-color no debería activarlo: ahí "no hay pauta ahora"
//      es señal semántica (`shift_not_current`).
// ════════════════════════════════════════════════════════════════════════════

/** Source semántico devuelto cuando `includeSource: true`. */
export type ColorSource =
    | 'assignment'         // hay ShiftColorAssignment hoy (con o sin roster)
    | 'roster'             // solo color base del Builder (sin assignments)
    | 'no_color_assigned'  // hay shift hoy compatible con `at` pero colorGroup=null (ej. KITCHEN)
    | 'shift_not_current'  // hay shift hoy con color pero NO compatible con `at` (ej. NIGHT a las 18:00)
    | 'none';              // no hay shift hoy ni assignments

export interface ResolverResultWithSource {
    colors: string[];
    source: ColorSource;
    shiftNotes: string | null;
}

/**
 * Cap de antigüedad de una sesión para que cuente como "presencia en piso".
 *
 * Justificación: el turno más largo modelado es FULL_DAY/FULL_NIGHT (12h).
 * Damos 4h de holgura por overtime razonable (caregiver cubriendo hasta
 * que llegue la siguiente). Sesiones abiertas > 16h son casi seguro
 * zombies (caregiver olvidó clock-out) — health-monitor las marca como
 * anomalía a partir de 14h pero NO auto-cierra; este cap evita que una
 * zombie engañe al conteo de presencia.
 *
 * NO usar boundary6amUtc del día clínico como ancla — eso rompe a una
 * caregiver NIGHT real que cruza las 6am en overtime (caso #7 del spec).
 *
 * **Source of truth del cap de PRESENCIA**. Usar en:
 *   - isSoloCaregiver (lib/shift-coverage)
 *   - GET /api/care (solo-mode count del caregiver-self)
 *   - GET /api/care/supervisor/caregiver-rounds (presencia del wall)
 *   - POST /api/care/supervisor/assign-color (lookup del target)
 *
 * NO usar para:
 *   - health-monitor (umbral de zombie = otro propósito, queda en 14h)
 *   - shift/start auto-cerrar zombies del mismo caregiver (defensa
 *     anti-doble-sesión = otro propósito, queda en 14h)
 *   - shift/start GET recovery de sesión activa del caregiver-self
 *     (lookup individual, no presencia)
 */
export const ACTIVE_PRESENCE_MAX_HOURS = 16;

/**
 * ¿La cuidadora es la única en piso AHORA? Determina si escalar a 'ALL'.
 *
 * Cuenta sesiones activas con role CAREGIVER o NURSE. KITCHEN /
 * MAINTENANCE / SUPERVISOR / DIRECTOR / etc. NO cuentan — son roles no
 * clínicos para el cómputo del solitario.
 *
 * Helper compartido por my-color y shift/start.resolveAssignedPatients.
 * Cap sliding desde `at ?? now`: cualquier sesión más vieja que 16h se
 * considera zombie y se excluye del conteo, preservando a la caregiver
 * real en overtime que cruza el rollback de las 6am AST.
 */
export async function isSoloCaregiver(params: {
    hqId: string;
    at?: Date;
}): Promise<boolean> {
    const { hqId, at } = params;
    const baseTime = (at ?? new Date()).getTime();
    const cap = new Date(baseTime - ACTIVE_PRESENCE_MAX_HOURS * 60 * 60 * 1000);
    const count = await prisma.shiftSession.count({
        where: {
            headquartersId: hqId,
            actualEndTime: null,
            startTime: { gte: cap },
            caregiver: { role: { in: ['CAREGIVER', 'NURSE'] } },
        },
    });
    return count <= 1;
}

/** Input común a single y batch. */
interface ResolverParamsBase {
    hqId: string;
    /** Instante a evaluar. Por defecto: now. Pasar `session.startTime` para
     *  anclar la resolución al inicio de turno (cruce de límite de turno). */
    at?: Date;
    /** Si true, busca un ScheduledShift de hoy (cualquier shiftType) cuando
     *  ningún shiftType compatible con `at` matchea. Útil en paths que
     *  filtran pacientes; en my-color queda OFF por default. */
    overtimeFallback?: boolean;
}

interface ResolverParamsSingle extends ResolverParamsBase {
    caregiverId: string;
    caregiverIds?: never;
    mode: 'single';
    includeSource?: boolean;
}

interface ResolverParamsBatch extends ResolverParamsBase {
    caregiverId?: never;
    caregiverIds: string[];
    mode: 'batch';
    includeSource?: boolean;
}

// Overloads — el TS de los call-sites discrimina por `mode` + `includeSource`.
export function resolveCaregiverColors(
    p: ResolverParamsSingle & { includeSource?: false | undefined },
): Promise<string[]>;
export function resolveCaregiverColors(
    p: ResolverParamsSingle & { includeSource: true },
): Promise<ResolverResultWithSource>;
export function resolveCaregiverColors(
    p: ResolverParamsBatch & { includeSource?: false | undefined },
): Promise<Map<string, string[]>>;
export function resolveCaregiverColors(
    p: ResolverParamsBatch & { includeSource: true },
): Promise<Map<string, ResolverResultWithSource>>;
export async function resolveCaregiverColors(
    p: ResolverParamsSingle | ResolverParamsBatch,
): Promise<string[] | ResolverResultWithSource | Map<string, string[]> | Map<string, ResolverResultWithSource>> {
    const hqId = p.hqId;
    const at = p.at;
    const includeSource = !!p.includeSource;
    const overtimeFallback = !!p.overtimeFallback;
    const userIds: string[] = p.mode === 'single' ? [p.caregiverId] : p.caregiverIds;

    if (userIds.length === 0) {
        if (p.mode === 'batch') {
            return new Map() as Map<string, string[]> | Map<string, ResolverResultWithSource>;
        }
        // single con caregiverId vacío — no debería pasar; defensivo
        return includeSource
            ? { colors: [], source: 'none' as const, shiftNotes: null }
            : [];
    }

    const { calendarStartUtc, calendarEndUtc, boundary6amUtc } = clinicalDay(at);
    const compatibleShiftTypes = compatibleShiftTypesAt(at);

    // ── 1) ShiftColorAssignments del día clínico ──────────────────────────
    // assignedAt es un timestamp real → boundary 6am AST (con rollback).
    const assignments = await prisma.shiftColorAssignment.findMany({
        where: {
            userId: { in: userIds },
            headquartersId: hqId,
            assignedAt: { gte: boundary6amUtc },
        },
        select: { userId: true, color: true, assignedAt: true },
        orderBy: { assignedAt: 'desc' },
    });

    // ── 2) ScheduledShift con ventana compatible con `at` (D2) ────────────
    // ScheduledShift.date es medianoche calendar UTC → rango [start, end).
    const rosterCompatible = await prisma.scheduledShift.findMany({
        where: {
            userId: { in: userIds },
            date: { gte: calendarStartUtc, lt: calendarEndUtc },
            shiftType: { in: compatibleShiftTypes as any[] },
            isAbsent: false,
            releasedAt: null,                   // FASE 82: pautas liberadas no cuentan como color base
            schedule: { headquartersId: hqId, status: 'PUBLISHED' },
        },
        select: { userId: true, colorGroup: true, shiftType: true, notes: true, date: true },
    });

    // ── 3) Si includeSource O overtimeFallback, también necesitamos saber
    //      qué pautas del día hay aunque NO sean compatibles con `at`.
    //      Esto cubre 'shift_not_current' (source) y el fallback de overtime.
    let rosterAnyToday: Array<{
        userId: string; colorGroup: string | null; shiftType: string; notes: string | null; date: Date;
    }> = [];
    if (includeSource || overtimeFallback) {
        rosterAnyToday = await prisma.scheduledShift.findMany({
            where: {
                userId: { in: userIds },
                date: { gte: calendarStartUtc, lt: calendarEndUtc },
                isAbsent: false,
                releasedAt: null,               // FASE 82: pautas liberadas no son fallback overtime
                schedule: { headquartersId: hqId, status: 'PUBLISHED' },
            },
            select: { userId: true, colorGroup: true, shiftType: true, notes: true, date: true },
            orderBy: { date: 'desc' },
        });
    }

    // Indexar por userId
    const assignByUser = new Map<string, string[]>();
    for (const a of assignments) {
        if (!a.color) continue;
        if (!assignByUser.has(a.userId)) assignByUser.set(a.userId, []);
        assignByUser.get(a.userId)!.push(a.color);
    }
    const rosterCompatByUser = new Map<string, typeof rosterCompatible>();
    for (const r of rosterCompatible) {
        if (!rosterCompatByUser.has(r.userId)) rosterCompatByUser.set(r.userId, []);
        rosterCompatByUser.get(r.userId)!.push(r);
    }
    const rosterAnyByUser = new Map<string, typeof rosterAnyToday>();
    for (const r of rosterAnyToday) {
        if (!rosterAnyByUser.has(r.userId)) rosterAnyByUser.set(r.userId, []);
        rosterAnyByUser.get(r.userId)!.push(r);
    }

    // ── Por usuario: armar la unión + (opcional) source ───────────────────
    const perUser = new Map<string, ResolverResultWithSource>();
    for (const uid of userIds) {
        const assignmentColors = (assignByUser.get(uid) ?? [])
            .filter(c => c && c !== 'UNASSIGNED');

        const compatRows = rosterCompatByUser.get(uid) ?? [];
        const rosterColors = compatRows
            .map(r => r.colorGroup)
            .filter((c): c is string => !!c && c !== 'UNASSIGNED');

        // Fallback overtime — solo si NO hay compat y el flag está ON.
        let fallbackColors: string[] = [];
        let fallbackUsed = false;
        if (rosterColors.length === 0 && overtimeFallback) {
            const anyRows = rosterAnyByUser.get(uid) ?? [];
            // El más reciente con colorGroup definido
            const first = anyRows.find(r => r.colorGroup && r.colorGroup !== 'UNASSIGNED');
            if (first?.colorGroup) {
                fallbackColors = [first.colorGroup];
                fallbackUsed = true;
            }
        }

        // D1: UNIÓN deduplicada
        const colors = Array.from(new Set([...rosterColors, ...fallbackColors, ...assignmentColors]));

        // Source semantics — solo si includeSource. Aún sin includeSource,
        // calculamos `shiftNotes` (barato) y los descartamos al retornar.
        let source: ColorSource = 'none';
        let shiftNotes: string | null = null;
        if (includeSource) {
            // shiftNotes: prefiero la pauta compatible más reciente, sino
            // cualquier pauta hoy (consistencia con my-color actual).
            const noteSource = compatRows[0] ?? (rosterAnyByUser.get(uid) ?? [])[0];
            shiftNotes = noteSource?.notes ?? null;

            if (assignmentColors.length > 0) {
                source = 'assignment';
            } else if (rosterColors.length > 0 || fallbackUsed) {
                source = 'roster';
            } else {
                // No hubo compat ni fallback útil. ¿Por qué?
                const anyRows = rosterAnyByUser.get(uid) ?? [];
                // ¿Había shift hoy compatible pero SIN colorGroup? (ej. KITCHEN)
                const hadCompatNoColor = compatRows.some(r => !r.colorGroup);
                // ¿Había shift hoy con colorGroup pero NO compatible? (ej. NIGHT a las 18:00)
                const hadIncompatWithColor = anyRows.some(
                    r => r.colorGroup && r.colorGroup !== 'UNASSIGNED'
                        && !compatibleShiftTypes.includes(r.shiftType as ShiftT),
                );
                if (hadCompatNoColor)        source = 'no_color_assigned';
                else if (hadIncompatWithColor) source = 'shift_not_current';
                else                         source = 'none';
            }
        }

        perUser.set(uid, { colors, source, shiftNotes });
    }

    // ── Retorno tipado según mode + includeSource ─────────────────────────
    if (p.mode === 'single') {
        const entry = perUser.get(p.caregiverId) ?? { colors: [], source: 'none' as const, shiftNotes: null };
        return includeSource ? entry : entry.colors;
    }
    // batch
    if (includeSource) {
        return perUser;
    }
    const colorsOnly = new Map<string, string[]>();
    for (const [uid, r] of perUser) colorsOnly.set(uid, r.colors);
    return colorsOnly;
}
