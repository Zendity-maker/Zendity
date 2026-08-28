/**
 * Cuidado de final de vida — hospicio y paliativo.
 *
 * POR QUE ESTE ARCHIVO EXISTE. La primera version trataba PALLIATIVE y HOSPICE
 * como cosas distintas: hospicio apagaba la encuesta y la redaccion automatica,
 * paliativo no apagaba nada. Andres lo corrigio el 28-ago-2026:
 *
 *   "para efectos de la comunicacion en el hogar y en Puerto Rico
 *    paliativo es hospicio."
 *
 * Es la distincion de un libro de texto, no la de este hogar ni la de esta
 * isla. Las dos modalidades reciben exactamente las mismas protecciones. Se
 * conservan los dos valores porque el expediente si debe poder decir cual es
 * —un residente puede estar en paliativo sin agencia certificada— pero ningun
 * automatismo puede volver a tratarlos distinto.
 *
 * Cualquier consumidor nuevo usa esCuidadoDeFinal(). Nunca comparar contra
 * 'HOSPICE' a mano: asi fue como paliativo se quedo sin proteccion.
 */
import type { CareModality } from '@prisma/client';

export function esCuidadoDeFinal(m: CareModality | null | undefined): boolean {
    return m === 'HOSPICE' || m === 'PALLIATIVE';
}

/** Modalidades que reciben las protecciones. Para filtros de Prisma. */
export const MODALIDADES_FINALES: CareModality[] = ['HOSPICE', 'PALLIATIVE'];

/** Como se nombra en pantalla. */
export function etiquetaModalidad(m: CareModality | null | undefined): string | null {
    if (m === 'HOSPICE') return 'Hospicio';
    if (m === 'PALLIATIVE') return 'Paliativo';
    return null;
}

/**
 * Linea para papeles que salen del hogar — tarjeta de emergencia, PDF de
 * continuidad. Lleva el proveedor cuando lo hay: en una sala de emergencias el
 * nombre de la agencia es a quien llamar.
 */
export function lineaModalidad(
    m: CareModality | null | undefined,
    proveedor?: string | null,
): string | null {
    const base = etiquetaModalidad(m);
    if (!base) return null;
    return proveedor?.trim() ? `${base} — ${proveedor.trim()}` : base;
}
