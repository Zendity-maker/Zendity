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
 * Retorna el inicio del "día clínico actual" en hora UTC.
 * El día clínico inicia a las 6:00 AM AST (10:00 UTC).
 */
export function todayStartAST(): Date {
    const now = new Date();
    // Convertir "ahora" a reloj de pared AST (como si AST fuera UTC)
    const nowAST = new Date(now.getTime() - AST_OFFSET_MIN * 60 * 1000);

    const y = nowAST.getUTCFullYear();
    const m = nowAST.getUTCMonth();
    const d = nowAST.getUTCDate();
    const h = nowAST.getUTCHours();

    let clinicalDayStartAST: Date;

    if (h >= 6) {
        // Día clínico inicia a las 6 AM AST de hoy
        clinicalDayStartAST = new Date(Date.UTC(y, m, d, 6, 0, 0, 0));
    } else {
        // Antes de las 6 AM AST → turno noche, día clínico anterior
        clinicalDayStartAST = new Date(Date.UTC(y, m, d - 1, 6, 0, 0, 0));
    }

    // Convertir ese "6 AM AST" a instante real UTC (sumar 4h)
    return new Date(clinicalDayStartAST.getTime() + AST_OFFSET_MIN * 60 * 1000);
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
    const now = new Date();
    const nowAST = new Date(now.getTime() - AST_OFFSET_MIN * 60 * 1000);
    const y = nowAST.getUTCFullYear();
    const m = nowAST.getUTCMonth();
    const d = nowAST.getUTCDate();
    const h = nowAST.getUTCHours();
    const calendarDay = h >= 6 ? d : d - 1;
    return new Date(Date.UTC(y, m, calendarDay, 0, 0, 0, 0));
}

/**
 * Rango completo del día calendar AST en UTC — útil cuando una query
 * combina `gte` y `lt`/`lte` sobre ScheduledShift.date.
 */
export function clinicalDayCalendarUTCRange(): { start: Date; end: Date } {
    const start = clinicalDayCalendarUTC();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
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
