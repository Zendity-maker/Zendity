/**
 * POR QUÉ NO SE ADMINISTRÓ
 * ────────────────────────
 * Catálogo de motivos de omisión del eMAR.
 *
 * MEDIDO EN CUPEY EL 05-sep-2026: 24 534 administraciones registradas contra
 * TRES omisiones. Cero `MISSED`, cero `REFUSED`, cero `HELD` — la mitad del
 * enum `MedStatus` no se ha usado nunca. Eso no es un hogar con 99.99 % de
 * cumplimiento; es un eMAR que solo sabe decir que sí.
 *
 * Y de las tres omisiones que existen, DOS están mal clasificadas porque la
 * opción correcta no estaba en la lista:
 *
 *     "Residente lo rechazó"  →  el texto decía "Paciente ya no está en el hogar"
 *     "Otro"                  →  el texto decía "Residente murió"
 *
 * La lista era: rechazó · en procedimiento · no disponible · indicación médica ·
 * otro. Ni "fuera del hogar" ni "falleció". Dos de tres.
 *
 * Y HABÍA ALGO PEOR QUE LA LISTA CORTA: el desplegable venía preseleccionado en
 * `OMIT_REASONS[0]`, o sea en "Residente lo rechazó". Quien no tocaba el
 * desplegable culpaba al residente sin querer. Un valor por defecto que reparte
 * culpa no es un valor por defecto, es una acusación silenciosa. Aquí no hay
 * ninguno: hay que elegir.
 *
 * EL ESTADO CORRECTO, NO SIEMPRE "OMITTED". Un rechazo del residente es
 * `REFUSED` y una indicación médica es `HELD`; llamarlos a todos `OMITTED`
 * borraba la diferencia entre "no quiso", "el médico lo suspendió" y "no había".
 * Con esto, "¿cuántas veces lo rechazó?" pasa a tener respuesta.
 */

export interface MotivoOmision {
    codigo: string;
    etiqueta: string;
    /** El estado real en el eMAR. Ver enum MedStatus. */
    estado: 'REFUSED' | 'HELD' | 'OMITTED';
    /** Si es cierto, enfermería y supervisión se enteran hoy. */
    avisa?: boolean;
}

export const MOTIVOS_OMISION: MotivoOmision[] = [
    { codigo: 'RECHAZO',        etiqueta: 'Residente lo rechazó',      estado: 'REFUSED' },
    { codigo: 'NO_DISPONIBLE',  etiqueta: 'Medicamento no disponible', estado: 'OMITTED', avisa: true },
    { codigo: 'EN_PROCEDIMIENTO', etiqueta: 'Residente en procedimiento', estado: 'HELD' },
    { codigo: 'INDICACION_MEDICA', etiqueta: 'Indicación médica',      estado: 'HELD' },
    // Los dos que faltaban. Sin ellos, una cita médica se registraba como
    // rechazo del residente y un fallecimiento como "otro".
    { codigo: 'FUERA_DEL_HOGAR', etiqueta: 'Fuera del hogar (hospital, cita, salida)', estado: 'OMITTED' },
    { codigo: 'FALLECIO',       etiqueta: 'Residente falleció',        estado: 'OMITTED', avisa: true },
    // La salida honesta va de última, y exige el texto libre.
    { codigo: 'OTRO',           etiqueta: 'Otro',                      estado: 'OMITTED' },
];

const PORCODIGO = new Map(MOTIVOS_OMISION.map(m => [m.codigo, m]));
/** Compatibilidad con lo ya escrito: las filas viejas guardan la etiqueta. */
const POR_ETIQUETA = new Map(MOTIVOS_OMISION.map(m => [m.etiqueta, m]));

export function esMotivoOmisionValido(codigo: string | null | undefined): boolean {
    return !!codigo && PORCODIGO.has(codigo);
}

export function motivoOmision(codigo: string | null | undefined): MotivoOmision | null {
    if (!codigo) return null;
    return PORCODIGO.get(codigo) ?? POR_ETIQUETA.get(codigo) ?? null;
}

export function etiquetaOmision(codigo: string | null | undefined): string | null {
    return motivoOmision(codigo)?.etiqueta ?? null;
}

/**
 * El estado del eMAR que corresponde al motivo. Ante un código desconocido
 * devuelve OMITTED, que es lo que se hacía siempre: fallar hacia el
 * comportamiento anterior y no hacia un estado que nadie pidió.
 */
export function estadoParaOmision(codigo: string | null | undefined): 'REFUSED' | 'HELD' | 'OMITTED' {
    return motivoOmision(codigo)?.estado ?? 'OMITTED';
}

export function omisionAvisa(codigo: string | null | undefined): boolean {
    return motivoOmision(codigo)?.avisa === true;
}
