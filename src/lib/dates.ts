/**
 * Helpers de fecha timezone-safe para queries de "hoy" en backend.
 *
 * Contexto: Vercel corre en UTC. El patrón `new Date().setHours(0,0,0,0)`
 * ancla a medianoche UTC, no al día local de la sede. En Puerto Rico (AST,
 * UTC-4), cada noche a las 8 PM el "hoy" del servidor salta al día siguiente
 * UTC y deja fuera los turnos activos, baños, comidas, etc.
 *
 * Solución pragmática: ventana rodante de 24h en vez de "hoy calendario".
 * Semánticamente el dashboard "vivo" debe mostrar las últimas 24h de actividad,
 * no el "día calendario" — es más útil operacionalmente y evita el bug.
 */

/**
 * Retorna el inicio del "día actual" para queries de actividad reciente.
 * Ventana rodante de 24 horas hacia atrás.
 * Usar en todos los filtros `gte: todayStartAST()` de APIs backend.
 */
export function todayStartAST(): Date {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

/**
 * Retorna el fin del "día actual" (ahora mismo).
 * Usar como `lte: todayEndAST()` en rangos temporales.
 */
export function todayEndAST(): Date {
    return new Date();
}
