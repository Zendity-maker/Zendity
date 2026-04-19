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
