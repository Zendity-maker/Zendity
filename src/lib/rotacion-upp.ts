/**
 * Umbrales de rotación para residentes con úlcera por presión.
 *
 * Existían tres números distintos para la misma regla: el cron
 * (/api/cron/upp-alerts) usaba 120 min, el feed del supervisor 150, y el
 * módulo de scoring (/api/care/postural) 135. Con tres umbrales, el badge
 * podía decir un número que la lista no mostraba — y el supervisor no tenía
 * forma de saber cuál de los dos mentía.
 *
 * Los canónicos son los del módulo de scoring:
 *
 *   OBJETIVO  120 min  — la meta clínica.
 *   BRECHA    135 min  — 120 más 15 de tolerancia legal. Pasado esto es
 *                        incidente, y solo aquí debe contar en el badge:
 *                        avisar a los 120 mete en la bandeja a quien todavía
 *                        está en regla.
 *
 * Un residente SIN ningún cambio postural registrado cuenta como vencido.
 * Es el caso peor y antes se caía silenciosamente de la lista, porque el
 * código pedía que existiera un último registro para poder compararlo.
 */
export const ROTACION_OBJETIVO_MIN = 120;
export const ROTACION_BRECHA_MIN = 135;
export const ROTACION_BRECHA_MS = ROTACION_BRECHA_MIN * 60 * 1000;

/** ¿La rotación de este residente está vencida? Sin registro = sí. */
export function rotacionVencida(ultimaRotacion: Date | null | undefined): boolean {
    if (!ultimaRotacion) return true;
    return Date.now() - ultimaRotacion.getTime() > ROTACION_BRECHA_MS;
}

/** Horas transcurridas, o null si nunca se registró una rotación. */
export function horasDesdeRotacion(ultimaRotacion: Date | null | undefined): number | null {
    if (!ultimaRotacion) return null;
    return (Date.now() - ultimaRotacion.getTime()) / 3600000;
}
