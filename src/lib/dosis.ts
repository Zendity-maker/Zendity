/**
 * "POR DEFINIR" NO ES UNA DOSIS
 * ─────────────────────────────
 * El catálogo de fármacos trae un campo `dosage` aparte del nombre. Casi nadie
 * lo llena, porque la dosis se escribe donde se lee: dentro del nombre.
 *
 * Medido en Cupey el 06-sep-2026, sobre 261 medicamentos activos:
 *
 *   246  tienen `dosage` = "Por Definir"
 *   230  de esos 246 llevan la dosis EN EL NOMBRE — "Atenolol 50mg"
 *    16  no la llevan en ningún sitio
 *
 * Así que el papel que se le entrega a un médico salía con una columna DOSIS
 * repitiendo "Por Definir" quince veces al lado de nombres que ya decían la
 * dosis. Un médico que lee eso entiende que el hogar no sabe cuánto le da a su
 * paciente, y no es cierto: la dosis está, en la columna de al lado.
 *
 * Se imprime una raya. La raya dice "este campo está vacío" — que es la verdad—
 * sin gritar que la dosis es desconocida. Y no se extrae la dosis del nombre a
 * la fuerza: adivinar un número en un papel clínico es peor que dejar el hueco.
 */
const VACIO = /^(por definir|por decidir|n\s*\/?\s*a|pendiente|-|—|\.|)$/i;

export function dosisODejarloEnBlanco(dosage: string | null | undefined): string {
    const t = (dosage ?? '').trim();
    return VACIO.test(t) ? '—' : t;
}
