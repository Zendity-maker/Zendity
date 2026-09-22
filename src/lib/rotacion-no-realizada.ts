/**
 * CUANDO NO SE PUDO ROTAR.
 *
 * ═══ POR QUÉ HACE FALTA ═══
 *
 * Zendi lo encontró el 21-sep-2026 y lo marcó como CONTRADICCION:
 *
 *     Elisa Medina Maldonado — «El paciente se niega a la rotación postural,
 *     que es un requisito de su cuidado»
 *     evidencia: «paciente no quiere ser movida de posición»
 *
 * Y tenía razón, porque el sistema no le dejaba a la cuidadora decirlo de otra
 * forma. Medido sobre las 21.664 filas de `PosturalChangeLog`: los ÚNICOS
 * valores que existen son `Supino`, `Izquierdo`, `Derecho`, sus variantes en
 * mayúscula, y la genérica de las rondas. **No hay ninguna manera de registrar
 * que alguien rechazó.**
 *
 * Así que la cuidadora tiene tres salidas, y las tres son malas:
 *
 *   1. Firmar una rotación que no ocurrió — el expediente miente y el reloj de
 *      2 h se reinicia sobre una persona a la que nadie movió.
 *   2. No firmar nada — el SLA se pone rojo y la señala a ella.
 *   3. Escribirlo en texto libre, que es lo que hizo, y de ahí lo sacó Zendi.
 *
 * Es el patrón que el proyecto ya tiene anotado: una lista cerrada sin salida
 * honesta hace que el personal elija la opción menos equivocada, y entonces el
 * registro miente.
 *
 * ═══ POR QUÉ NO VA EN `PosturalChangeLog` ═══
 *
 * Porque un rechazo NO es un cambio postural, y meterlo ahí lo contaría como
 * si lo fuera. Catorce sitios del repo cuentan esa tabla y **cuatro lo hacen
 * con `count` a secas, sin filtro alguno** —exec-report, hr/performance ×2 y
 * shift-closure-report—, así que una fila de "no se pudo" inflaría el
 * cumplimiento de rotación de la persona y del hogar. Es exactamente la fuga
 * que `VOIDED` costó cerrar en cinco sitios el 22-sep.
 *
 * Tabla propia: cero riesgo sobre lo que ya se cuenta, y semánticamente
 * honesto.
 *
 * ═══ EL RELOJ SIGUE CORRIENDO, Y ESO ES CORRECTO ═══
 *
 * Registrar un rechazo NO reinicia el SLA de 2 horas. Si no se la movió, no se
 * la movió: el riesgo de úlcera es el mismo y la alarma tiene que seguir
 * sonando para que alguien vuelva a intentarlo o para que enfermería decida
 * otra cosa.
 *
 * Lo que sí cambia es DE QUIÉN es la culpa. Ver `huboRechazoEnElHueco`: la
 * siguiente rotación que llegue tarde sobre ese hueco no se le cobra a nadie.
 * Es "veracidad, no puntuación": el dato se queda verdadero —no se rotó— y lo
 * que se retira es el castigo.
 */
import { prisma } from '@/lib/prisma';

export interface MotivoNoRotacion {
    codigo: string;
    etiqueta: string;
    /** Enfermería se entera hoy, no en el resumen del turno. */
    avisa?: boolean;
}

/**
 * Los motivos, y por qué cada uno.
 *
 * Mismo criterio que `MOTIVOS_OMISION` de los medicamentos: la lista se escribe
 * desde lo que de verdad pasa en el piso, no desde lo que es cómodo de
 * clasificar. Y lleva salida honesta.
 */
export const MOTIVOS_NO_ROTACION: MotivoNoRotacion[] = [
    // El caso de Elisa y el de Iris Delia, los dos que Zendi encontró.
    { codigo: 'RECHAZO', etiqueta: 'No quiso que la movieran', avisa: true },
    // Rotar a alguien con dolor sin avisar a enfermería es hacerle daño.
    { codigo: 'DOLOR', etiqueta: 'Le dolía al moverla' , avisa: true },
    // No es un fallo: si está sentada en el sillón, no hay decúbito que cambiar.
    { codigo: 'FUERA_DE_CAMA', etiqueta: 'Estaba levantada o fuera de la cama' },
    { codigo: 'PROCEDIMIENTO', etiqueta: 'Estaba con visita o en un procedimiento' },
    // Una persona sola no debe mover a quien necesita dos. Decirlo es correcto.
    { codigo: 'HACEN_FALTA_DOS', etiqueta: 'Hacía falta otra persona y no había', avisa: true },
    /**
     * LA SALIDA HONESTA. Sin ella, quien tiene un motivo que no está en la
     * lista elige el que menos se le parece — y el registro miente con una
     * precisión que nadie pidió.
     */
    { codigo: 'OTRO', etiqueta: 'Otro motivo' },
];

const PORCODIGO = new Map(MOTIVOS_NO_ROTACION.map(m => [m.codigo, m]));

export function esMotivoNoRotacionValido(codigo: string | null | undefined): boolean {
    return !!codigo && PORCODIGO.has(codigo);
}

export function etiquetaNoRotacion(codigo: string | null | undefined): string | null {
    return (codigo && PORCODIGO.get(codigo)?.etiqueta) ?? null;
}

export function avisaAEnfermeria(codigo: string | null | undefined): boolean {
    return !!(codigo && PORCODIGO.get(codigo)?.avisa);
}

/**
 * ¿Hubo un intento fallido entre la rotación anterior y ésta?
 *
 * Lo usa `exento` de `evaluarRotacion`: si alguien lo intentó y no se pudo, el
 * hueco no se le cobra a quien llega después. Sin esto, la cuidadora que
 * registra el rechazo honestamente sale PEOR parada que la que firma una
 * rotación falsa — y entonces nadie vuelve a registrar un rechazo.
 */
export async function huboRechazoEnElHueco(
    patientId: string,
    desde: Date | null,
    hasta: Date,
): Promise<boolean> {
    if (!desde) return false;
    const r = await prisma.rotacionNoRealizada.findFirst({
        where: { patientId, momento: { gt: desde, lte: hasta } },
        select: { id: true },
    });
    return !!r;
}
