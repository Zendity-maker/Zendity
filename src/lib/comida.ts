/**
 * POR QUÉ NO COMIÓ
 * ────────────────
 * Catálogo de motivos de rechazo de una comida.
 *
 * POR QUÉ EXISTE. `MealLog` guardaba solo cuánto —todo, mitad, poco, nada— y en
 * Cupey hay 258 registros de "nada". Ninguno dice por qué. Un "no comió"
 * repetido y sin causa no le sirve a nadie: no se puede cocinar distinto, no se
 * puede llamar al médico, no se puede avisar a la familia. Es un dato que ocupa
 * espacio y no responde nada.
 *
 * Lo que sí se sabía estaba en las notas de turno, escrito a mano porque no
 * había dónde ponerlo:
 *
 *     "Se niega diariamente a desayunar tostadas, sándwiches, revueltos o
 *      panqueques. Solo acepta avena."
 *     "Se negó a comer la comida del hogar y solicitó albóndigas congeladas."
 *     "Lleva 3 días con ingesta insuficiente, consumiendo solo pequeñas porciones."
 *
 * La primera es una preferencia que la cocina puede resolver mañana. Estaba en
 * texto libre, y la cocina no lee notas de turno.
 *
 * LA REGLA DE LA SALIDA HONESTA. `RECHAZO_SIN_DECIR` no es relleno: es el motivo
 * más frecuente de verdad en un hogar con demencia, y sin él la lista obliga a
 * elegir algo que no pasó. Una lista cerrada sin escape no produce datos
 * limpios, produce datos falsos — es lo mismo que llevó a registrar un
 * fallecimiento como traslado al hospital, que era el único botón que existía.
 */

export interface MotivoRechazo {
    codigo: string;
    /** Lo que lee la cuidadora en el botón. */
    etiqueta: string;
    /** Si es cierto, el residente no estaba: no es un rechazo. */
    ausente?: boolean;
    /** Si es cierto, enfermería debe enterarse hoy, no en el resumen del turno. */
    avisaEnfermeria?: boolean;
    /**
     * Si es cierto, la cocina puede hacer algo con esto y le llega.
     *
     * Se deja fuera lo clínico —náusea, dolor, somnolencia, agitación— que no
     * se arregla cocinando y que además es información médica que la cocina no
     * necesita. "Dificultad para tragar" SÍ entra: cambia la textura, y la
     * textura la prepara la cocina.
     */
    leImportaALaCocina?: boolean;
}

export const MOTIVOS_RECHAZO: MotivoRechazo[] = [
    { codigo: 'NO_LE_GUSTO',       etiqueta: 'No le gustó el plato',        leImportaALaCocina: true },
    { codigo: 'SIN_APETITO',       etiqueta: 'Sin apetito',                 leImportaALaCocina: true },
    { codigo: 'SOMNOLIENTO',       etiqueta: 'Dormido o muy somnoliento' },
    { codigo: 'NAUSEA_VOMITO',     etiqueta: 'Náusea o vómito',            avisaEnfermeria: true },
    { codigo: 'DOLOR_MALESTAR',    etiqueta: 'Dolor o malestar',           avisaEnfermeria: true },
    { codigo: 'DIFICULTAD_TRAGAR', etiqueta: 'Dificultad para tragar',      avisaEnfermeria: true, leImportaALaCocina: true },
    { codigo: 'AGITADO',           etiqueta: 'Agitado, no colaboró' },
    // El residente no estaba. Sin esta opción, una cita médica se registraba
    // como "no comió nada", que se lee como problema clínico y no lo es.
    { codigo: 'FUERA_DEL_HOGAR',   etiqueta: 'Estaba fuera del hogar',     ausente: true },
    // La salida honesta. Va de última a propósito: no es la primera que se toca.
    { codigo: 'RECHAZO_SIN_DECIR', etiqueta: 'Rechazó y no dijo por qué',   leImportaALaCocina: true },
    { codigo: 'OTRO',              etiqueta: 'Otro',                        leImportaALaCocina: true },
];

const PORCODIGO = new Map(MOTIVOS_RECHAZO.map(m => [m.codigo, m]));

export function esMotivoValido(codigo: string | null | undefined): boolean {
    return !!codigo && PORCODIGO.has(codigo);
}

export function motivo(codigo: string | null | undefined): MotivoRechazo | null {
    return codigo ? PORCODIGO.get(codigo) ?? null : null;
}

export function etiquetaMotivo(codigo: string | null | undefined): string | null {
    return motivo(codigo)?.etiqueta ?? null;
}

/**
 * Motivos que enfermería tiene que ver hoy. Náusea, dolor y dificultad para
 * tragar no son preferencias: son síntomas, y uno de ellos —disfagia— es riesgo
 * de aspiración.
 */
export function requiereAvisoAEnfermeria(codigo: string | null | undefined): boolean {
    return motivo(codigo)?.avisaEnfermeria === true;
}

/**
 * Las calidades que piden explicación. "Mitad" no es un problema; "poco" y
 * "nada" sí, y son las dos que hoy se registran a ciegas.
 */
export const CALIDADES_QUE_PIDEN_MOTIVO = ['LITTLE', 'NONE'] as const;

export function pideMotivo(quality: string): boolean {
    return (CALIDADES_QUE_PIDEN_MOTIVO as readonly string[]).includes(quality);
}

/**
 * Lo que la cocina ve. El resto —náusea, dolor, agitación, somnolencia— es
 * clínico: va a enfermería y no a la cocina, que no puede hacer nada con eso.
 */
export const MOTIVOS_DE_COCINA = MOTIVOS_RECHAZO
    .filter(m => m.leImportaALaCocina)
    .map(m => m.codigo);
