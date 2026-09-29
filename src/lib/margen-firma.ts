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

/* ──────────────────────────────────────────────────────────────────────────
 * QUÉ DOSIS SIGNIFICA UNA FRANJA — Y HASTA CUÁNDO SE PUEDE REGISTRAR
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * EL PACK DE LAS 8:00 PM DESAPARECÍA A MEDIANOCHE Y NO VOLVÍA NUNCA.
 *
 * El 21-sep-2026 se abrió el camino para registrar una dosis que se dio y no se
 * anotó a tiempo —«ellas sí dieron los medicamentos pero se les pasó la hora de
 * ponerlos en Zendity»—. Pero la condición que lo gobernaba era
 * `ahora.getHours() >= 6` y `min < ahoraMin`: minutos crudos contra la
 * MEDIANOCHE NATURAL, que no es una frontera de este sistema. Las fronteras de
 * este sistema son las 6:00 AM (jornada clínica) y los turnos.
 *
 * Efecto, medido sobre 45 días:
 *
 *     el pack de las 8:00 AM es recuperable ... 07:30 → 23:59  (16,5 h)
 *     el pack de las 8:00 PM ................... 19:30 → 23:59  ( 4,5 h)
 *     y a las 00:00 se cierra para SIEMPRE: a las 6 de la mañana ya no
 *     cumple `min < ahoraMin` y no vuelve a ofrecerse jamás.
 *
 * Una cuidadora de noche que a la una de la madrugada se da cuenta de que el
 * pack de las ocho no se firmó no tiene ningún camino. Y la pantalla no dice
 * que no lo haya: simplemente no está — el cero sin procedencia de CLAUDE.md.
 *
 * ═══ LO QUE NO SE PUEDE PRESUMIR, Y NO SE PRESUME ═══
 *
 * Esto NO está costando omisiones hoy. Medido el 29-sep, descontando las dosis
 * de hoy que aún no vencen: el pack de las 20:00 se omite MENOS que el de las
 * 8:00 —4,3 % (53 de 1.243) contra 6,7 % (162 de 2.422)—. Y de 1.190 dosis
 * firmadas del pack de las 20:00, CERO se firmaron a las 22:00 o más tarde: la
 * ventana tardía que ya existe no la usa nadie.
 *
 * Cero uso puede significar «no hace falta» o «no se sabe que está», y estos
 * datos no distinguen una cosa de la otra. Lo que sí es cierto sin interpretar
 * nada es que el camino se cierra a una hora que no significa nada aquí.
 *
 * ═══ CÓMO SE ARREGLÓ, EN DOS PASOS — 29-SEP-2026 ═══
 *
 * PRIMERO la identidad: el pack manda su INSTANTE y el servidor lo valida con
 * `instanteDeclaradoValido` en vez de reconstruir la franja desde su propio
 * reloj. Esa reconstrucción era la razón TÉCNICA del corte a medianoche: sin
 * ella el servidor no puede saber, a las 02:00, si "8:00 PM" son las de anoche
 * o las de esta noche.
 *
 * DESPUÉS la frontera, que es la razón de PRODUCTO: ver
 * `ventanaDeDosisDeLaTableta` más abajo. El primer intento fue llevarla a las
 * 19 h de `MAX_ATRAS_HORAS` y se revirtió, porque `/api/care` acotaba las
 * administraciones al día natural y el pack se habría ofrecido sin que la
 * tableta recibiera sus dosis — un pack zombi, imposible de dar por cerrado.
 * La ventana buena mueve las dos cosas a la vez y se define una sola vez.
 */
import { astDateTime } from '@/lib/dates';

/**
 * Qué instante significa esta franja ahora mismo.
 *
 *   · Una franja DEL TURNO es la de hoy, aunque caiga en el futuro — de eso se
 *     encarga el margen de arriba.
 *   · Una franja ATRASADA es su ocurrencia MÁS RECIENTE en el pasado. A las
 *     02:00, "8:00 PM" son las ocho de ANOCHE; a las 08:00, "5:00 AM" son las
 *     cinco de esta madrugada. Las dos son la misma regla.
 */
export function ocurrenciaDeLaFranja(hour: number, minute: number, ahora: Date, atrasada: boolean): Date {
    const deHoy = astDateTime(ahora, hour, minute);
    if (!atrasada || deHoy.getTime() <= ahora.getTime()) return deHoy;
    return new Date(deHoy.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * ¿El instante que manda la tableta es de verdad el de ESA franja?
 *
 * La tableta manda el instante exacto para que el servidor no tenga que
 * reconstruirlo desde su propio reloj —que es justo lo que no puede hacer bien
 * de madrugada—. Pero un instante que llega del cliente no se cree: tiene que
 * (1) ser una fecha, (2) dar la MISMA hora de pared que la franja, y (3) caer
 * dentro del alcance. Si falla algo, se devuelve null y quien llama reconstruye
 * como siempre — se falla hacia el comportamiento anterior, no hacia el error.
 */
export function instanteDeclaradoValido(
    crudo: unknown,
    hour: number,
    minute: number,
    ahora: Date,
    ventana: { desde: Date; hasta: Date },
): Date | null {
    if (typeof crudo !== 'string' || !crudo.trim()) return null;
    const instante = new Date(crudo);
    if (Number.isNaN(instante.getTime())) return null;
    // La hora de pared AST del instante tiene que ser la de la franja.
    if (astDateTime(instante, hour, minute).getTime() !== instante.getTime()) return null;
    const adelantoMin = (instante.getTime() - ahora.getTime()) / 60_000;
    if (adelantoMin > MARGEN_ANTES_MIN) return null;   // demasiado por delante
    /**
     * Y POR DETRÁS, EXACTAMENTE LA VENTANA DE LA TABLETA. NI UN MINUTO MENOS.
     *
     * Aquí había `MAX_ATRAS_HORAS` (19 h), que es el límite de la HORA
     * DECLARABLE en hora-real.ts — otra cosa. Con la ventana vieja nunca se
     * rozaban: el pack atrasado más viejo que la tableta podía ofrecer estaba a
     * 17 h 59 min, así que el 19 no se alcanzaba nunca. Con la ventana nueva se
     * cruzan, y el resultado era que la tableta ofrecía un pack que el servidor
     * no podía identificar.
     *
     * Medido minuto a minuto: **179 combinaciones** de minuto × franja en que el
     * servidor no hacía lo que la pantalla ofrecía. La primera, a las 03:01: el
     * pack de las 8:00 AM de AYER: la tableta lo ofrece y el servidor contesta
     * «todavía no toca, faltan 4 h 59 min» sobre una dosis de hace veinte horas.
     *
     * Si la tableta puede ofrecerlo, el servidor tiene que poder identificarlo.
     * La ventana se calcula con la MISMA función en los dos lados.
     */
    if (instante < ventana.desde) return null;
    return instante;
}

/* ──────────────────────────────────────────────────────────────────────────
 * LA VENTANA DE DOSIS DE LA TABLETA — DEFINIDA UNA VEZ
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * QUÉ DOSIS PUEDE VER Y TOCAR LA TABLETA DE PISO AHORA MISMO.
 *
 * ═══ POR QUÉ HACÍA FALTA MOVER ESTO ═══
 *
 * La tableta trabajaba con el DÍA NATURAL AST (00:00 a 00:00) y el resto del
 * sistema con la JORNADA CLÍNICA (06:00 a 06:00). De las dos fronteras, la
 * natural es la que no significa nada aquí: a nadie le cambia el turno a
 * medianoche. Y cortaba justo donde dolía — el pack de las 8:00 PM se podía
 * recuperar 4,5 h y a las 00:00 desaparecía PARA SIEMPRE, porque a las 06:00
 * ya no cumplía `min < ahoraMin` y no volvía a ofrecerse jamás.
 *
 * ═══ POR QUÉ NO ES, SIN MÁS, LA JORNADA CLÍNICA ═══
 *
 * Porque la jornada clínica parte en dos el pack de las 5:00 AM: la dosis de
 * las 5:00 del día D pertenece a la jornada D−1. Eso ya rompió la ronda de
 * tiroides del 16-sep-2026, y por eso `/api/care` se pasó al día natural.
 *
 * Y no es teórico: medido contra producción, **16 de las 126** dosis del pack
 * de las 5:00 AM se firman FUERA de su propia jornada, hacia las 3 de la tarde.
 * Un cierre por jornada las dejaría sin sitio.
 *
 * ═══ LA VENTANA QUE SIRVE PARA LAS DOS COSAS ═══
 *
 * Empieza en la MEDIANOCHE NATURAL DEL DÍA EN QUE ARRANCÓ LA JORNADA CLÍNICA
 * EN CURSO. Es decir, seis horas antes del arranque de la jornada.
 *
 *     a las 15:00 del día D → jornada D → [D 00:00, D+1 00:00)   24 h
 *     a la  01:00 del día D → jornada D−1 → [D−1 00:00, D+1 00:00)  48 h
 *
 * Las seis horas de más por debajo son exactamente las que contienen el pack
 * de las 5:00 AM de la jornada anterior. No son un margen: son ese pack.
 *
 * ═══ QUÉ CAMBIA Y QUÉ NO, MEDIDO EL 29-SEP-2026 ═══
 *
 *     hora simulada   filas de hoy   filas con esta ventana
 *     01:00 AST .............. 162 ... 439   (+277, ~33 kB)
 *     05:00 AST .............. 162 ... 439   (+277)
 *     09:00 AST .............. 162 ... 162   (+0)
 *     15:00 AST .............. 162 ... 162   (+0)
 *     23:00 AST .............. 162 ... 162   (+0)
 *
 * O sea: las ÚNICAS horas cuyo comportamiento cambia son las 00:00–05:59, que
 * son exactamente las que estaban rotas. El resto del día es idéntico.
 *
 * ═══ EL PRECIO, Y POR QUÉ SE PAGA EN OTRO SITIO ═══
 *
 * Con 48 h dentro, la etiqueta de reloj deja de identificar una dosis. Y el
 * fallo no es el obvio: casi nunca hay dos filas peleándose por la etiqueta —
 * hay UNA SOLA, y es la de la jornada de ayer. A las 02:00, el pack de las
 * 5:00 AM de esta madrugada se pintaría COMO YA DADO, con la firma de ayer.
 *
 * Medido sobre las 1.125 filas del 24 al 27-sep, reconstruyendo cada momento:
 * **360 minutos cada noche, de 00:00 a 05:55, y 792 casos de medicamento ×
 * minuto**. Por eso `slotStatusToday` casa por INSTANTE, y solo cae a la
 * etiqueta en filas sin `scheduledTime`.
 *
 * Eso es seguro porque el instante está al 100 % donde importa: de las 1.846
 * filas resueltas de los últimos 7 días, las 1.846 lo traen. (A 120 días solo
 * el 13,8 %, porque el cron empezó a escribirlo el 15-sep — pero esta ventana
 * nunca mira tan atrás.)
 */
export function ventanaDeDosisDeLaTableta(ahora: Date, inicioDeLaJornada: Date): { desde: Date; hasta: Date } {
    return {
        desde: astDateTime(inicioDeLaJornada, 0, 0),
        hasta: new Date(astDateTime(ahora, 0, 0).getTime() + 24 * 60 * 60 * 1000),
    };
}
