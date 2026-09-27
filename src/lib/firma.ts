/**
 * ¿ESTO ES UNA FIRMA, O ES UN TOQUE?
 *
 * ═══ EL PROBLEMA ═══
 *
 * Todos los sitios del repo que piden firma la validan igual:
 *
 *     if (!canvas.current || canvas.current.isEmpty()) return;
 *
 * Y `isEmpty()` no dice lo que parece. En signature_pad 2.3.2 devuelve
 * `_isEmpty`, y esa bandera pasa a `false` dentro de `_drawPoint`
 * (node_modules/signature_pad/dist/signature_pad.js:437) — o sea al dibujar UN
 * PUNTO. Un dedo que toca el canvas y no se mueve ya cuenta como firma.
 *
 * ═══ QUE PASÓ DE VERDAD ═══
 *
 * Medido el 27-sep-2026 sobre las 14.426 dosis firmadas de Cupey en 60 días,
 * leyendo el tamaño del PNG (se guarda recortado, así que el tamaño ES el
 * trazo):
 *
 *     área mediana del trazo ........ 27.965 px²
 *     lado mayor, percentil 1 ....... 75 px
 *     la más pequeña ................ 4 × 4 px
 *
 * 227 dosis se firmaron con menos de 1.000 px², en 90 eventos distintos y por
 * varias personas. Una firma clínica de 4×4 píxeles es un expediente que dice
 * que alguien certificó las cinco categorías correctas, y nadie lo hizo.
 *
 * ═══ POR QUE EL LADO Y NO EL ÁREA ═══
 *
 * Porque un trazo fino y largo —una raya de 200 × 4— tiene poca área y SÍ es un
 * trazo. Por área se rechazarían 227; por caja delimitadora, 60. Los 167 de
 * diferencia son rayas de verdad, y rechazarlas sería castigar a quien firma
 * rápido, que es justo lo que este proyecto no hace.
 *
 * ═══ POR QUE 30 PÍXELES ═══
 *
 * No es un número elegido a ojo: es el centro de una banda vacía. Medido sobre
 * las 14.426, la regla «ambos lados por debajo de N» rechaza EXACTAMENTE lo
 * mismo para N = 10, 15, 20, 25 y 30 — las mismas 60 filas (0,42 %). No hay ni
 * una firma con lados entre 10 y 30 px. Los puntos están todos por debajo de
 * 10, y el siguiente trazo real empieza muy por encima.
 *
 * Un umbral que cae en un hueco no discrimina a nadie: separa dos poblaciones
 * que ya estaban separadas.
 */

/** Por debajo de esto en AMBOS lados, no hay trazo: hay un punto. */
export const LADO_MINIMO_FIRMA_PX = 30;

export interface VeredictoFirma {
    /** ¿Se puede aceptar como firma? */
    valida: boolean;
    /** Qué decirle a quien firmó. Vacío si es válida. */
    motivo: string;
    ancho: number;
    alto: number;
}

/**
 * Juzga el canvas recortado de una firma.
 *
 * Recibe el canvas de `getTrimmedCanvas()` —o cualquier cosa con `width` y
 * `height`— para no atar esta función a la librería de firma.
 */
export function juzgarFirma(recortado: { width: number; height: number } | null | undefined): VeredictoFirma {
    const ancho = Math.max(0, Math.round(recortado?.width ?? 0));
    const alto = Math.max(0, Math.round(recortado?.height ?? 0));

    if (ancho === 0 || alto === 0) {
        return { valida: false, ancho, alto, motivo: 'Falta la firma.' };
    }
    if (ancho < LADO_MINIMO_FIRMA_PX && alto < LADO_MINIMO_FIRMA_PX) {
        return {
            valida: false, ancho, alto,
            /**
             * Se dice lo que pasó y qué hacer, sin acusar de nada. Lo más
             * probable es que el dedo rozara el recuadro sin querer — no que
             * alguien intentara firmar con un punto.
             */
            motivo: 'Eso quedó como un punto, no como una firma. Traza tu firma sobre el recuadro.',
        };
    }
    return { valida: true, ancho, alto, motivo: '' };
}
