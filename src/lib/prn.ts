/**
 * EL PRN Y SU RESULTADO
 * ─────────────────────
 * Un medicamento por razón necesaria se da PARA algo —dolor, agitación,
 * diarrea— y la pregunta que sigue decide qué pasa después: ¿funcionó? Si no,
 * se repite, se cambia o se llama al médico. Si sí, eso también es información:
 * la próxima vez se sabe qué usar.
 *
 * NADA HACÍA ESA PREGUNTA, así que la respuesta vivía en las notas de turno
 * cuando alguien se acordaba de escribirla. Ejemplos reales de Cupey:
 *
 *     "Se administró 50 mg de Seroquel, pero no se ha logrado estabilizar."
 *     "Se le administró su medicación sin observarse efecto, lo que sugiere
 *      una posible ineficacia."
 *     "Se le administró clonazepam de 1 mg, lo cual lo tranquilizó en 45 minutos."
 *     "Glucosa de 300, se administró Humulin, ahora 162."
 *
 * Las cuatro son información clínica de primer orden. Ninguna llegó al eMAR.
 *
 * PEOR QUE ESO. Medido el 05-sep-2026 en Cupey: 4 medicamentos con frecuencia
 * PRN activos y CERO administraciones registradas — nunca, ninguna. Contra 27
 * notas de turno en 120 días que dicen que se administró algo, varias de ellas
 * benzodiacepinas. El PRN no es que se registrara mal: es que no se registraba.
 *
 * Y hay una razón mecánica. El flujo de PRN de la tableta no deja elegir QUÉ
 * medicamento se dio: manda `getMedsForCurrentShift(...)` entero, o sea marca
 * como administrados TODOS los medicamentos del turno, con una nota de texto
 * libre. Quien sabe lo que está haciendo no usa un botón así. Se usó una vez en
 * toda la historia del sistema, y esa vez cayó sobre un medicamento cuya
 * frecuencia no es PRN.
 *
 * Por eso este archivo va junto al arreglo del flujo: registrar el efecto de un
 * PRN que nadie registra no habría servido de nada.
 */

export interface EfectoPRN {
    codigo: string;
    etiqueta: string;
    descripcion: string;
    /** Si es cierto, enfermería debería mirarlo: se dio algo y no sirvió. */
    requiereSeguimiento?: boolean;
}

export const EFECTOS_PRN: EfectoPRN[] = [
    {
        codigo: 'RESUELTO', etiqueta: 'Resolvió',
        descripcion: 'El síntoma cedió. No hizo falta nada más.',
    },
    {
        codigo: 'PARCIAL', etiqueta: 'Mejoró en parte',
        descripcion: 'Bajó pero no cedió del todo.',
        requiereSeguimiento: true,
    },
    {
        codigo: 'SIN_EFECTO', etiqueta: 'Sin efecto',
        descripcion: 'Se dio y el síntoma siguió igual.',
        requiereSeguimiento: true,
    },
    // La salida honesta: el residente se durmió, cambió el turno, o simplemente
    // no hubo forma de saberlo. Sin esta opción, "no lo pude evaluar" se
    // registra como "resolvió", que es una mentira cómoda.
    {
        codigo: 'NO_EVALUABLE', etiqueta: 'No se pudo evaluar',
        descripcion: 'No hubo forma de saberlo: se durmió, cambió el turno, salió.',
    },
];

const PORCODIGO = new Map(EFECTOS_PRN.map(e => [e.codigo, e]));

export function esEfectoValido(codigo: string | null | undefined): boolean {
    return !!codigo && PORCODIGO.has(codigo);
}

export function etiquetaEfecto(codigo: string | null | undefined): string | null {
    return (codigo && PORCODIGO.get(codigo)?.etiqueta) || null;
}

export function requiereSeguimiento(codigo: string | null | undefined): boolean {
    return !!codigo && PORCODIGO.get(codigo)?.requiereSeguimiento === true;
}

/**
 * Horas tras las que un PRN sin resultado deja de ser "todavía es pronto" y pasa
 * a ser un hueco. Doce cubre el turno completo más el relevo: quien lo dio pudo
 * irse a casa, y entonces le toca al siguiente cerrar lo que vio.
 */
export const HORAS_PARA_EXIGIR_EFECTO = 12;
