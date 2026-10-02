/**
 * EL RESIDENTE DIURNO. UNA SOLA DEFINICIÓN DE CUÁNDO ESTÁ.
 *
 * ═══ QUÉ ES ═══
 *
 * Andrés, 01-oct-2026: «Tengo un residente diurno. No había pensado en los
 * diurnos cuando diseñé Zéndity. No le preparamos medicamentos, el familiar los
 * trae. La documentación de ellos es física, en expediente de papel. Los
 * horarios son de 7am a 6pm. Hacen las comidas en el centro. Eventualmente
 * serán residentes regulares del hogar.»
 *
 * Y una condición que no es configuración: **un diurno no puede ser encamado**.
 * Si alguien deja de poder caminar, deja de poder ser diurno. Por eso aquí
 * `necesitaRotacion` nunca aplica — no es una casilla que se pueda marcar por
 * error, es lo que hace que sea diurno.
 *
 * ═══ POR QUÉ HACE FALTA ESTE FICHERO ═══
 *
 * Zéndity se diseñó para gente que vive aquí. `status: 'ACTIVE'` acabó
 * significando «está en el edificio», escrito a mano en 38 consultas de cuido.
 * Un diurno es ACTIVE y de noche no está, así que sin esto el sistema le exige
 * trabajo que nadie puede hacer. Medido el 01-oct-2026 sobre 30 días:
 *
 *   · 15 de 105 ponches de tarde ocurren DESPUÉS de las 18:00, y abren una
 *     ventana de vitales de 4 h sobre alguien que ya se fue. Las 222 órdenes
 *     nacidas después de las 18:00 están vencidas las 222.
 *   · La ronda del turno no cierra NUNCA si falta uno del grupo: toast cada 3
 *     minutos con su nombre, barra congelada en 10/11, y las rondas 2 y 3 de
 *     la noche sin contarse. No molesta: BORRA el registro de 10 personas
 *     atendidas tres veces.
 *   · La auditoría escribe «Sin actividad registrada en este turno» con
 *     severidad crítica. ~365 críticas falsas al año sobre alguien
 *     perfectamente atendido.
 *   · Su color se cuenta como descubierto toda la noche.
 *
 * ═══ LA REGLA, UNA SOLA ═══
 *
 * A un diurno el sistema NO le abre trabajo automático. Lo que se le haga, se
 * registra; lo que no, no se le reclama. Lo que nace de una RECETA sigue igual
 * que para todos — los medicamentos se firman en /care como a cualquiera,
 * aunque los traiga el familiar (ver `PatientMedication.traeLaFamilia`), y una
 * orden de vitales de enfermería también es una receta.
 *
 * ═══ POR QUÉ EL HORARIO ESTÁ A MANO Y NO ES UN DATO ═══
 *
 * Hay un diurno y un horario. Mientras eso sea cierto, 7–18 es una REGLA del
 * hogar, no un campo. El día que aparezca alguien que venga tres días a la
 * semana o medias jornadas, ahí se convierte en dato y se sabrá por qué.
 * Modelarlo antes es construir de más.
 *
 * ═══ UN LÍMITE CONOCIDO ═══
 *
 * `estaEnElEdificio` mira la modalidad TAL COMO ESTÁ HOY. Si dentro de un año
 * se queda a vivir y alguien audita octubre, verá huecos de noche sin saber que
 * entonces era diurno. Arreglarlo pide anotar la modalidad en cada evento en
 * vez de deducirla, y eso solo hace falta si de verdad se va a mirar atrás.
 */

/** De 7 de la mañana a 6 de la tarde, hora de Puerto Rico. */
export const HORARIO_DIURNO = { entra: 7, sale: 18 } as const;

/**
 * La hora de pared de Puerto Rico. Es el MISMO camino que
 * `inferShiftTypeFromAST` en shift-coverage.ts, y no una resta de 4 horas: el
 * reloj del servidor es UTC en Vercel, y restar a mano es como se escriben los
 * fallos que solo aparecen de madrugada.
 */
function horaAST(instante: Date): number {
    const fmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico',
    });
    return parseInt(fmt.format(instante), 10) % 24;
}

/** Lo mínimo que hay que saber de alguien para decidir si está. */
export interface ModalidadResidente {
    esDiurno?: boolean | null;
}

/**
 * ¿Está esta persona en el edificio en este instante?
 *
 * Un residente regular siempre: vive aquí. Un diurno, solo dentro de su
 * horario.
 */
export function estaEnElEdificio(
    residente: ModalidadResidente | null | undefined,
    instante: Date = new Date(),
): boolean {
    if (!residente?.esDiurno) return true;
    const hora = horaAST(instante);
    return hora >= HORARIO_DIURNO.entra && hora < HORARIO_DIURNO.sale;
}

/**
 * El `where` de Prisma para «residentes que están en el edificio AHORA».
 *
 * Fuera del horario diurno excluye a los diurnos; dentro, no excluye a nadie.
 * Se escribe así —y no filtrando en memoria— porque las consultas que lo
 * necesitan ya traen miles de filas y no tiene sentido traerlas para tirarlas.
 *
 * Se usa junto al `status: 'ACTIVE'` que ya tenga la consulta, no en su lugar:
 * un diurno sigue siendo un residente activo.
 */
export function soloLosQueEstan(instante: Date = new Date()): { esDiurno?: boolean } {
    const hora = horaAST(instante);
    const esHorarioDiurno = hora >= HORARIO_DIURNO.entra && hora < HORARIO_DIURNO.sale;
    return esHorarioDiurno ? {} : { esDiurno: false };
}
