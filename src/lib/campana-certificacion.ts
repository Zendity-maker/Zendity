/**
 * Campaña de certificación geriátrica — fecha límite y curso.
 *
 * Vive en un solo sitio para que cambiar la fecha, o apagar la campaña cuando
 * termine, sea una línea y no una cacería por el repo.
 *
 * Pedida por Andrés el 21-ago-2026: todo el personal del hogar debe tomar y
 * aprobar "Cuidado Geriátrico General" antes del 31 de agosto. Es el curso que
 * acredita al cuidador ante el Departamento de la Familia.
 *
 * Para apagarla: poner CAMPANA_ACTIVA en false. El aviso desaparece de toda la
 * app sin tocar nada más.
 */

export const CAMPANA_ACTIVA = true;

/** Título exacto del curso — se busca por él, así que debe calzar. */
export const CURSO_CAMPANA = 'Cuidado Geriátrico General';

/**
 * Fin del 31 de agosto de 2026 en hora de Puerto Rico (AST = UTC−4).
 * Las 23:59 AST del 31 son las 03:59 UTC del 1 de septiembre.
 */
export const FECHA_LIMITE = new Date('2026-09-01T03:59:59.000Z');

/** Días completos que faltan. Negativo si ya venció. */
export function diasRestantes(desde: Date = new Date()): number {
    return Math.ceil((FECHA_LIMITE.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
}

/** "hoy", "mañana", "quedan 5 días" — para hablarle claro a la gente. */
export function textoPlazo(desde: Date = new Date()): string {
    const d = diasRestantes(desde);
    if (d < 0) return 'El plazo venció';
    if (d === 0) return 'Vence hoy';
    if (d === 1) return 'Vence mañana';
    return `Quedan ${d} días`;
}

export const FECHA_LIMITE_TEXTO = '31 de agosto de 2026';
