/**
 * ¿ESTE CAMPO DE ALERGIAS DICE ALGO?
 * ──────────────────────────────────
 * Una sola respuesta para los cuatro sitios que la necesitan: el chequeo de
 * verificaciones, la tarjeta de emergencia, el resumen impreso y el PDF de
 * traslado. Antes cada uno decidía por su cuenta y no coincidían.
 *
 * EL CASO QUE LO PIDIÓ. Paul Carnero Cabrera tiene el campo con el texto "N/A".
 * `verificaciones.ts` lo cuenta como sin documentar —tiene la expresión buena—
 * pero los tres caminos que producen el PAPEL solo miraban si el texto estaba
 * vacío. O sea que su formulario de traslado imprimía "N/A" dentro de la caja
 * ROJA de alergias, con el mismo peso visual que "Penicilina".
 *
 * Alguien leyendo eso en urgencias ve una alerta y encuentra dos letras que no
 * significan nada. Peor: aprende a no fiarse de esa caja.
 *
 * Medido el 06-sep-2026 en Cupey: 28 de 33 residentes activos no tienen
 * alergias documentadas de verdad. De los cinco que sí, tres son alérgicos a
 * penicilina.
 */

/**
 * Formas de escribir "nada" que se han encontrado en producción. `nunguna` está
 * a propósito: es un typo real del expediente, y una lista de sinónimos que no
 * incluye los errores de tecleo no sirve para leer lo que la gente escribe.
 */
const VACIO = /^(n\s*\/?\s*a|nka|ninguna|nunguna|ningunas|no|none|sin alergias|sin alergia|desconocid[ao]s?|-|\.|—)?$/i;

/** El aviso, idéntico en los cuatro sitios. */
export const ALERGIAS_SIN_DOCUMENTAR = 'NO DOCUMENTADO — confirmar con el hogar antes de medicar';

/** Cierto cuando el campo no dice nada útil, esté vacío o diga "N/A". */
export function alergiasSinDocumentar(texto: string | null | undefined): boolean {
    return VACIO.test((texto ?? '').trim());
}

/**
 * Lo que se imprime. Devuelve el aviso cuando no hay dato — nunca inventa un
 * "ninguna conocida", que es una afirmación que el hogar no puede sostener.
 */
export function textoDeAlergias(texto: string | null | undefined): string {
    return alergiasSinDocumentar(texto) ? ALERGIAS_SIN_DOCUMENTAR : (texto ?? '').trim();
}
