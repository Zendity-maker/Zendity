/**
 * Helpers de fecha timezone-safe para queries de "hoy" en backend.
 *
 * Contexto: Vercel corre en UTC. Puerto Rico = AST (UTC-4, sin DST).
 *
 * MODELO: "día clínico" anclado a 6:00 AM AST.
 * El día clínico inicia a las 6 AM AST (cuando comienza el turno MORNING)
 * y corre hasta las 6 AM AST del día siguiente. El turno NIGHT (22:00–06:00)
 * se queda en el día clínico anterior para evitar que la actividad nocturna
 * se "salte" al día siguiente en medio de un turno vivo.
 *
 * Ejemplos (AST):
 *   - 10:10 AM AST 19 abril  → día clínico inicia a las 6:00 AM AST 19 abril
 *   - 02:00 AM AST 19 abril  → día clínico inicia a las 6:00 AM AST 18 abril
 *   - 23:30 AST 18 abril     → día clínico inicia a las 6:00 AM AST 18 abril
 *
 * Usar en todos los filtros `gte: todayStartAST()` de APIs backend
 * (baños, comidas, vitales, rondas, administraciones de meds, etc.).
 */

const AST_OFFSET_MIN = 4 * 60; // AST = UTC-4 (sin DST en Puerto Rico)

/**
 * SINGLE SOURCE OF TRUTH para "qué día clínico es este momento".
 *
 * Computa las tres anclas que los queries del repo usan, todas para el MISMO
 * día clínico (día anclado a 6 AM AST con rollback antes-de-6am):
 *
 *   - calendarStartUtc  → 00:00 UTC del calendar AST day. Usar para queries
 *                         sobre `ScheduledShift.date` (que se persiste como
 *                         medianoche UTC del calendar day).
 *   - calendarEndUtc    → +24h respecto a calendarStartUtc. Usar como `lt`.
 *   - boundary6amUtc    → 10:00 UTC del calendar day AST = 6:00 AM AST. Usar
 *                         para filtros `gte` sobre timestamps reales como
 *                         `ShiftColorAssignment.assignedAt`, `createdAt`,
 *                         `performedAt`, `ShiftSession.startTime`, etc.
 *
 * Invariante: `boundary6amUtc === calendarStartUtc + 10h` siempre.
 *
 * Rollback antes-de-6am: si la hora AST de `at` es < 6, el día clínico es el
 * del calendar day AST anterior (un NIGHT activo entre 22:00 y 06:00 sigue
 * perteneciendo al día clínico del calendar day en que arrancó).
 *
 * `at` opcional para anclar a un instante distinto de `now` (ej.
 * `session.startTime` cuando se resuelve color de una sesión específica).
 */
export function clinicalDay(at?: Date): {
    calendarStartUtc: Date;
    calendarEndUtc: Date;
    boundary6amUtc: Date;
} {
    const now = at ?? new Date();
    // Convertir el instante a reloj-de-pared AST representado como UTC
    const nowAST = new Date(now.getTime() - AST_OFFSET_MIN * 60 * 1000);
    const y = nowAST.getUTCFullYear();
    const m = nowAST.getUTCMonth();
    const d = nowAST.getUTCDate();
    const h = nowAST.getUTCHours();
    // Rollback de 6am: antes de las 6 AM AST, día clínico = ayer
    const calendarDay = h >= 6 ? d : d - 1;
    const calendarStartUtc = new Date(Date.UTC(y, m, calendarDay, 0, 0, 0, 0));
    const calendarEndUtc = new Date(calendarStartUtc.getTime() + 24 * 60 * 60 * 1000);
    const boundary6amUtc = new Date(calendarStartUtc.getTime() + 10 * 60 * 60 * 1000);
    return { calendarStartUtc, calendarEndUtc, boundary6amUtc };
}

/**
 * Retorna el inicio del "día clínico actual" en hora UTC.
 * El día clínico inicia a las 6:00 AM AST (10:00 UTC).
 *
 * Wrapper de compatibilidad sobre `clinicalDay()` — preserva la firma sin
 * parámetro para los callers existentes. Nuevos callers deberían usar
 * `clinicalDay(at?)` directamente para soportar anclar a un instante dado.
 */
export function todayStartAST(): Date {
    return clinicalDay().boundary6amUtc;
}

/**
 * Retorna el fin del "día actual" (ahora mismo).
 * Usar como `lte: todayEndAST()` en rangos temporales.
 */
export function todayEndAST(): Date {
    return new Date();
}

/**
 * Retorna el `date` UTC midnight del día CALENDAR AST correspondiente al
 * día clínico actual. Útil para queries sobre ScheduledShift.date, que se
 * guarda como medianoche UTC del día calendar (ej. 2026-05-18T00:00:00.000Z
 * para shifts del 18 de mayo).
 *
 * NO confundir con todayStartAST() — ese retorna las 10am UTC (= 6am AST),
 * que se usa para filtrar timestamps reales (createdAt, performedAt, etc).
 *
 * Lógica:
 *   - Si hora actual AST >= 6 → día clínico = fecha AST hoy
 *   - Si hora actual AST < 6  → día clínico = fecha AST de ayer (turno noche
 *     se queda en el día clínico anterior)
 */
export function clinicalDayCalendarUTC(): Date {
    return clinicalDay().calendarStartUtc;
}

/**
 * Rango completo del día calendar AST en UTC — útil cuando una query
 * combina `gte` y `lt`/`lte` sobre ScheduledShift.date.
 */
export function clinicalDayCalendarUTCRange(): { start: Date; end: Date } {
    const { calendarStartUtc, calendarEndUtc } = clinicalDay();
    return { start: calendarStartUtc, end: calendarEndUtc };
}

/**
 * Combina una fecha (medianoche del día calendar AST, guardada como UTC) con
 * una hora de pared en AST y retorna el instante UTC correspondiente.
 *
 * Caso de uso: FamilyAppointment guarda `requestedDate` como medianoche AST
 * (ej. 2026-05-27T04:00:00.000Z = 27-may 00:00 AST) y `requestedTime` como
 * string "1:00 PM" (hora de pared AST). Para crear el HeadquartersEvent con
 * el startTime correcto, hay que componer ambos respetando que el servidor
 * corre en UTC, NO en AST.
 *
 * Ejemplo:
 *   astDateTime(new Date('2026-05-27T04:00:00.000Z'), 13, 0)
 *   → 2026-05-27T17:00:00.000Z   (= 1:00 PM AST = 17:00 UTC)
 *
 * NO usar `Date.setHours()` directamente sobre la fecha — eso aplica la hora
 * sobre el reloj del servidor (UTC en Vercel) y queda corrida −4h en AST.
 */
export function astDateTime(date: Date, hour: number, minute: number = 0): Date {
    // Leer la fecha calendar AST del input (subir 4h hacia atrás convierte el
    // instante UTC en "reloj de pared AST" representado como UTC).
    const astWall = new Date(date.getTime() - AST_OFFSET_MIN * 60 * 1000);
    const y = astWall.getUTCFullYear();
    const m = astWall.getUTCMonth();
    const d = astWall.getUTCDate();
    // Componer y/m/d hour:minute "como si AST fuera UTC", luego trasladar a UTC real.
    const composed = new Date(Date.UTC(y, m, d, hour, minute, 0, 0));
    return new Date(composed.getTime() + AST_OFFSET_MIN * 60 * 1000);
}

/**
 * Parser de strings tipo "1:00 PM" / "11:30 AM" → { hour: 0-23, minute: 0-59 }.
 * Tolerante con espacios extra y mayúsculas/minúsculas. Lanza si no parsea.
 */
export function parseTimeOfDay(raw: string): { hour: number; minute: number } {
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) throw new Error(`Hora inválida: "${raw}"`);
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error(`Hora fuera de rango: "${raw}"`);
    }
    return { hour, minute };
}

// ═════════════════════════════════════════════════════════════════════════════
// FORMATEO ANCLADO A AST — para el portal familiar (diáspora fuera de PR)
// ═════════════════════════════════════════════════════════════════════════════
// Toda hora visible para la familia debe mostrarse en hora de Vivid (AST),
// no en la TZ del browser. Estos helpers usan Intl.DateTimeFormat con
// timeZone: 'America/Puerto_Rico' para garantizar consistencia diáspora-Vivid.

const AST_TZ = 'America/Puerto_Rico';

/**
 * Día calendar AST como "27 MAY" (etiquetas en es-PR). Usar en card badges,
 * date headers, listas de citas. Reemplaza `new Date(iso).getDate()`/`getMonth()`
 * que leen TZ del browser y causan day-slip.
 */
export function formatASTDate(date: Date | string): { day: string; monthAbbr: string } {
    const d = typeof date === 'string' ? new Date(date) : date;
    const parts = new Intl.DateTimeFormat('es-PR', {
        timeZone: AST_TZ,
        day: 'numeric',
        month: 'short',
    }).formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    // Normalizar mes a 3 letras UPPER y sin punto (es-PR devuelve "may.", queremos "MAY").
    const monthRaw = parts.find((p) => p.type === 'month')?.value ?? '';
    const monthAbbr = monthRaw.replace(/\./g, '').slice(0, 3).toUpperCase();
    return { day, monthAbbr };
}

/**
 * Día calendar AST completo como "miércoles, 27 de mayo de 2026" — formal,
 * para emails de notificación y headers grandes.
 */
export function formatASTDateLong(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-PR', {
        timeZone: AST_TZ,
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(d);
}

/**
 * Hora de pared AST como "1:00 PM". Usar cuando solo hay un Date (ej.
 * HeadquartersEvent.startTime). NO usar sobre FamilyAppointment.requestedTime
 * que ya es string AST verbatim — para ese caso usar formatASTTimeLabel(raw).
 */
export function formatASTTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-PR', {
        timeZone: AST_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(d);
}

/**
 * Etiqueta canónica de zona para acompañar TODA hora visible a la familia.
 * Texto único — cambiar solo aquí si se reformula el copy.
 */
export const AST_TZ_LABEL = 'hora de Vivid · AST';

/**
 * Empaqueta una hora ya formateada (string como "1:00 PM" o el output de
 * formatASTTime) con la etiqueta canónica AST. Resultado: "1:00 PM (hora de Vivid · AST)".
 */
export function withASTLabel(timeStr: string): string {
    return `${timeStr} (${AST_TZ_LABEL})`;
}

/**
 * Compone la medianoche AST del día calendar (y, m, d) como instante UTC.
 * Usar al guardar fechas seleccionadas en pickers de cliente: en vez de
 * `new Date(y, m, d).toISOString()` (que ancla a medianoche local del browser y
 * cae en el día equivocado para diáspora europea/asiática), usar este helper
 * para forzar que "28-may" sea siempre 28-may AST sin importar dónde clickee.
 *
 * y, m (0-indexed), d son los enteros del día calendar AST que el usuario eligió.
 *
 * Ejemplo:
 *   astMidnightUTC(2026, 4, 28).toISOString()
 *   → "2026-05-28T04:00:00.000Z"   (siempre, sin importar process.env.TZ)
 */
export function astMidnightUTC(year: number, month: number, day: number): Date {
    // 00:00 AST = 04:00 UTC. Date.UTC ignora la TZ local del runtime.
    return new Date(Date.UTC(year, month, day, AST_OFFSET_MIN / 60, 0, 0, 0));
}
