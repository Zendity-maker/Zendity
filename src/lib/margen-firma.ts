/**
 * CUÁNTO ANTES DE SU HORA SE PUEDE FIRMAR UNA DOSIS. UNA SOLA DEFINICIÓN.
 *
 * ═══ POR QUÉ ESTE FICHERO EXISTE ═══
 *
 * La regla nació el 21-sep-2026 dentro de `src/app/care/page.tsx` y se quedó
 * ahí: una constante y una comparación, en la pantalla. Funcionaba —la tableta
 * deja el pack visible pero desactivado, diciendo a qué hora se abre— y por eso
 * nadie volvió a mirarla.
 *
 * Pero una regla que solo vive en la pantalla no es una guarda. El servidor
 * aceptaba lo mismo que rechazaba la tableta: un `POST /api/care/meds/bulk` con
 * `scheduleTime: "8:00 PM"` a las nueve de la mañana se escribía sin una queja.
 * Es exactamente el patrón que costó las coberturas y el «mirar vs cubrir»: la
 * misma regla escrita dos veces, arreglada en una sola copia — salvo que aquí
 * la segunda copia ni siquiera se había escrito.
 *
 * ═══ QUÉ SE MIDIÓ, 29-SEP-2026, CONTRA PRODUCCIÓN ═══
 *
 *     ADMINISTERED con hora en 60 días ........ 3.872
 *     firmadas >30 min ANTES de su franja .....    36   (todas del 21-sep)
 *     la peor ................................. −348 min — el pack de las
 *                                                8:00 PM firmado a las 14:12
 *     en los últimos 7 días ...................     0   de 1.846
 *
 * O sea: exposición, no hemorragia. La pantalla lo tapa desde el 21-sep. Lo que
 * falta es que el servidor diga lo mismo que la pantalla.
 *
 * ═══ POR QUÉ 30 MINUTOS, Y POR QUÉ SOLO ADMINISTERED ═══
 *
 * Ni cero ni libre. En el piso se empieza a repartir antes de la hora en punto,
 * y bloquear hasta el minuto exacto empuja a firmar después «de memoria», que
 * es el problema contrario y el que costó las 62 horas falsas del mismo día.
 *
 * Y el bloqueo es solo para `ADMINISTERED`, que es el daño concreto: un
 * expediente que AFIRMA un acto que todavía no ocurrió, y que si luego no se da
 * nadie descubre nunca —la fila ya dice ADMINISTERED y ningún barrido la mira—.
 * Marcar por adelantado que una dosis se va a retener (HELD, porque el
 * residente estará ingresado) es un acto clínico legítimo aunque hoy nadie lo
 * use: medido el 29-sep, CERO dosis resueltas antes de su hora en toda la
 * historia, y HELD/REFUSED sin un solo uso. No se prohíbe lo que nadie hace y
 * podría querer hacerse bien.
 *
 * ═══ LO QUE ESTA REGLA NO ATRAPA — Y NO SE DISIMULA ═══
 *
 * `instanteDeLaFranja` compone la franja sobre la FECHA DE CALENDARIO AST del
 * `ahora` del servidor. Así que en el turno de noche, a las 22:05, la franja
 * «5:00 AM» resuelve a las 5 de la mañana de HOY — diecisiete horas en el
 * PASADO, no siete en el futuro. El servidor no puede verlo como anticipado.
 *
 * Ese caso —el que dejó 5 Levothyroxine firmadas a las diez de la noche sobre
 * la dosis de la mañana siguiente— lo sigue cubriendo SOLO el cliente, con
 * `alContinuoDeNoche` en care/page.tsx. Esta guarda cubre la franja futura del
 * día en curso, que es la de las 36 filas medidas. Arreglarlo entero pide que
 * el pack mande su identidad (el instante, o el id de la fila) en vez de una
 * etiqueta de reloj que el servidor tiene que reconstruir a ciegas.
 */

/** Minutos de gracia antes de la hora pautada. */
export const MARGEN_ANTES_MIN = 30;

/**
 * ¿Esta franja está tan por delante del reloj que firmarla sería afirmar el
 * futuro? Devuelve los minutos de adelanto, o `null` si está dentro del margen.
 *
 * `null` también cuando no hay instante que comparar (un PRN, un semanal que no
 * toca hoy): sin franja pautada no hay nada que adelantar.
 */
export function minutosDeAdelanto(instante: Date | null | undefined, ahora: Date): number | null {
    if (!instante) return null;
    const adelantoMin = Math.round((instante.getTime() - ahora.getTime()) / 60000);
    return adelantoMin > MARGEN_ANTES_MIN ? adelantoMin : null;
}

/**
 * El texto que ve quien firmó demasiado pronto.
 *
 * Dice la hora a la que se abre, no solo que está cerrado: un «no puedes» sin
 * cuándo empuja a buscar otro camino, que es como se acaba firmando de memoria.
 */
export function avisoDeAdelanto(franja: string, adelantoMin: number): string {
    const horas = Math.floor(adelantoMin / 60);
    const min = adelantoMin % 60;
    const falta = horas > 0 ? `${horas} h ${min} min` : `${min} min`;
    return `El pack de las ${franja} todavía no toca — faltan ${falta}. Se abre ${MARGEN_ANTES_MIN} minutos antes de su hora.`;
}
