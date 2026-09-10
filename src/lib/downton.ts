/**
 * ÍNDICE DE DOWNTON — riesgo de caída.
 *
 * Escogido por Celia y Andrés el 10-sep-2026, sobre Morse y sobre "solo el
 * nivel". Pesó que la app ya lo nombraba (la pantalla de inicio muestra una
 * métrica llamada "Downton Risk") y que en tableta un sí/no se contesta y un
 * juicio se pospone.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LOS ÍTEMS SON LOS DEL ÍNDICE PUBLICADO, NO LOS DEL HOGAR TODAVÍA.
 *
 * Andrés dijo "adelante" sin pasarme la hoja del hogar, así que aquí están los
 * del instrumento estándar. Son los que se usan en geriatría y los que casi
 * seguro Celia tiene en papel — pero CASI SEGURO no es lo mismo que
 * confirmado, y una escala mal transcrita es peor que ninguna.
 *
 * Cuando Celia los revise: corregir esta lista y poner
 * `CONFIRMADA_POR_ENFERMERIA = true`. Es un archivo, una lista, un booleano.
 * Mientras sea false, el formulario se lo dice a quien evalúa.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * DÓNDE SE GUARDA. En FallRiskAssessment, que ya existía:
 *
 *   riskLevel     LOW | MODERATE | HIGH   ← derivado del puntaje
 *   factors       el JSON de esta evaluación (ver EvaluacionDownton)
 *   nextReviewAt  a 6 meses (decisión de Celia y Andrés)
 *   morseScore    SE QUEDA NULL, a propósito.
 *
 * Ese último punto importa. `morseScore` es un campo que dice Morse; meterle
 * un puntaje de Downton sería exactamente el fallo de la temperatura —el campo
 * se llama una cosa y guarda otra— y eso costó 1,751 lecturas mal leídas
 * durante cuatro meses. El puntaje va dentro del JSON de `factors`, con el
 * nombre de la escala al lado, hasta que haya una columna propia.
 */

export const CONFIRMADA_POR_ENFERMERIA = false;

/** A los 6 meses toca repetirla. Decidido el 10-sep-2026. */
export const MESES_ENTRE_EVALUACIONES = 6;

/** Desde este puntaje, riesgo alto. Es el corte del índice publicado. */
export const CORTE_RIESGO_ALTO = 3;

export interface ItemDownton {
    clave: string;
    grupo: string;
    texto: string;
    /** Casi todos valen 1. Se deja explícito para no suponerlo al sumar. */
    puntos: number;
}

/**
 * Los once ítems, agrupados como en la hoja. El grupo se enseña como
 * encabezado; dentro, cada ítem es un sí/no.
 */
export const ITEMS: ItemDownton[] = [
    { clave: 'caidas_previas', grupo: 'Caídas previas', texto: 'Ha tenido caídas antes', puntos: 1 },

    { clave: 'med_tranquilizantes', grupo: 'Medicamentos', texto: 'Tranquilizantes o sedantes', puntos: 1 },
    { clave: 'med_diureticos', grupo: 'Medicamentos', texto: 'Diuréticos', puntos: 1 },
    { clave: 'med_hipotensores', grupo: 'Medicamentos', texto: 'Hipotensores (que no sean diuréticos)', puntos: 1 },
    { clave: 'med_antiparkinson', grupo: 'Medicamentos', texto: 'Antiparkinsonianos', puntos: 1 },
    { clave: 'med_antidepresivos', grupo: 'Medicamentos', texto: 'Antidepresivos', puntos: 1 },

    { clave: 'def_visual', grupo: 'Déficits sensoriales', texto: 'Alteraciones visuales', puntos: 1 },
    { clave: 'def_auditivo', grupo: 'Déficits sensoriales', texto: 'Alteraciones auditivas', puntos: 1 },
    { clave: 'def_extremidades', grupo: 'Déficits sensoriales', texto: 'Extremidades afectadas (ictus, amputación…)', puntos: 1 },

    { clave: 'estado_confuso', grupo: 'Estado mental', texto: 'Confuso o desorientado', puntos: 1 },

    { clave: 'deambulacion_insegura', grupo: 'Deambulación', texto: 'Camina inseguro, con ayuda o sin ella', puntos: 1 },
];

export const GRUPOS = [...new Set(ITEMS.map(i => i.grupo))];

export type Respuestas = Record<string, boolean>;

export interface EvaluacionDownton {
    escala: 'DOWNTON';
    /** Para saber, dentro de un año, con qué versión de la hoja se evaluó. */
    confirmadaPorEnfermeria: boolean;
    respuestas: Respuestas;
    puntaje: number;
    nivel: 'LOW' | 'MODERATE' | 'HIGH';
    nota?: string;
}

export function puntuar(respuestas: Respuestas): number {
    return ITEMS.reduce((suma, i) => suma + (respuestas[i.clave] ? i.puntos : 0), 0);
}

/**
 * El índice solo separa alto de no-alto (corte en 3). MODERATE existe porque
 * el modelo ya lo tenía y porque un 1-2 no es lo mismo que un 0: es alguien a
 * quien mirar, aunque no dispare protocolo.
 */
export function nivelDe(puntaje: number): 'LOW' | 'MODERATE' | 'HIGH' {
    if (puntaje >= CORTE_RIESGO_ALTO) return 'HIGH';
    if (puntaje >= 1) return 'MODERATE';
    return 'LOW';
}

export function construirEvaluacion(respuestas: Respuestas, nota?: string): EvaluacionDownton {
    const puntaje = puntuar(respuestas);
    return {
        escala: 'DOWNTON',
        confirmadaPorEnfermeria: CONFIRMADA_POR_ENFERMERIA,
        respuestas,
        puntaje,
        nivel: nivelDe(puntaje),
        nota: nota?.trim() || undefined,
    };
}

export function proximaRevision(desde = new Date()): Date {
    const d = new Date(desde);
    d.setMonth(d.getMonth() + MESES_ENTRE_EVALUACIONES);
    return d;
}

/** Lee lo guardado en `factors`. Devuelve null si no es una evaluación Downton. */
export function leerEvaluacion(factors: string | null | undefined): EvaluacionDownton | null {
    if (!factors) return null;
    try {
        const j = JSON.parse(factors);
        return j && j.escala === 'DOWNTON' ? j as EvaluacionDownton : null;
    } catch {
        return null;   // Las viejas guardaban texto plano ("Post-caída: …")
    }
}
