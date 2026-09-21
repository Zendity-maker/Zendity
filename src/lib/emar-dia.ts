import type { Prisma } from '@prisma/client';

/**
 * "LAS DOSIS DE HOY" — UNA SOLA DEFINICIÓN, SIETE PANTALLAS.
 *
 * ═══ POR QUÉ `createdAt` DEJÓ DE SERVIR ═══
 *
 * Siete sitios acotaban las dosis del día con `createdAt >= todayStartAST()`, y
 * `todayStartAST()` son las 06:00 AST. Eso fue una regla buena mientras la fila
 * nacía AL FIRMAR: entonces `createdAt` era la hora del acto.
 *
 * Dejó de serlo el 15-sep-2026, cuando `materializarDosisDelDia` empezó a
 * escribir de verdad y la fila pasó a nacer ANTES del acto, a las 06:00:37. Las
 * filas entraban en la ventana **por treinta y siete segundos**, y nadie se dio
 * cuenta porque el margen bastaba.
 *
 * Basta hasta que deja de bastar. Dos cosas lo destaparon el 21-sep:
 *
 *   · YA SE PIERDEN FILAS HOY. Lo que la tableta firma de madrugada nace antes
 *     de las 06:00 y cae fuera: 74 filas en 12 días, de las cuales 26 son el
 *     pack de las 5:00 AM ya administrado. El comentario de wall/dashboard
 *     decía que "la ronda de las 5:00 entra en el conteo aunque se firme a las
 *     04:4x" — y era falso desde hacía días.
 *
 *   · ADELANTAR EL CRON LO CONVERTÍA EN APAGÓN. Al mover la materialización a
 *     las 04:00 —para que el pack de las 5:00 dejara de nacer tarde— TODAS las
 *     filas del día caían fuera. Medido simulando las filas reales: 270 de 273
 *     visibles el 20-sep pasaban a 0. La pizarra de la pared, el panel del
 *     supervisor, facility-health y el portal de la familia, en blanco.
 *
 * ═══ EL ANCLA CORRECTA ═══
 *
 * El DÍA NATURAL AST de `scheduledTime`, que es el mismo día con el que
 * `materializarDosisDelDia` construye la fila (`astDateTime`, que usa la fecha
 * de calendario). Lector y escritor con la misma definición de día: mientras no
 * la compartan, cualquier cambio en la hora de escritura rompe la lectura.
 *
 * NO el día CLÍNICO (`clinicalDay`, con su retroceso a las 6 AM): el pack de
 * las 05:00 cae antes de las 06:00, así que por esa regla pertenecería al día
 * de ayer y ningún filtro anclado a las 6 lo vería nunca. Es justo el pack que
 * motivó todo esto.
 *
 * ═══ LA RAMA DE LOS QUE NO TIENEN HORA ═══
 *
 * Un PRN no lleva `scheduledTime` NUNCA, por diseño: se da cuando hace falta y
 * no pertenece a ninguna franja. Sin la segunda rama del OR desaparecería de
 * todas las pantallas. Hoy cuesta 0 —no hay ni una administración PRN desde el
 * 15-sep— pero el día que se registre una tiene que verse, y ese día nadie se
 * acordará de esto.
 */
export function eMARdeHoy(at: Date = new Date()): Prisma.MedicationAdministrationWhereInput {
    const { desde, hasta } = rangoDelDiaAST(at);
    return eMARentre(desde, hasta);
}

/**
 * Lo mismo para una ventana cualquiera: el prólogo del día clínico, el informe
 * ejecutivo por semana o por mes.
 *
 * `inclusivo` conserva el `lte` de quien ya lo usaba. La diferencia con `lt` es
 * un milisegundo en el borde y no cambia ningún número, pero cambiarlo de paso
 * sería meter una modificación que nadie pidió dentro de otra.
 */
export function eMARentre(
    desde: Date,
    hasta: Date,
    inclusivo = false,
): Prisma.MedicationAdministrationWhereInput {
    const tope = inclusivo ? { lte: hasta } : { lt: hasta };
    return {
        OR: [
            { scheduledTime: { gte: desde, ...tope } },
            // Sin franja: no hay otra fecha a la que anclarse que la de escritura.
            { scheduledTime: null, createdAt: { gte: desde, ...tope } },
        ],
    };
}

/**
 * El día natural de Puerto Rico como instantes UTC de verdad.
 *
 * OJO con `fechaCalendarioAST()` de dates.ts, que NO sirve aquí: devuelve la
 * LLAVE del día —medianoche UTC— porque es lo que `ScheduledShift.date` y el
 * menú guardan. `scheduledTime` no es una llave, es un instante real, y
 * medianoche AST son las 04:00 UTC. Compararlo contra la llave correría el día
 * cuatro horas.
 */
export function rangoDelDiaAST(at: Date = new Date()): { desde: Date; hasta: Date } {
    const pared = new Date(at.getTime() - 4 * 60 * 60 * 1000);
    const desde = new Date(Date.UTC(
        pared.getUTCFullYear(), pared.getUTCMonth(), pared.getUTCDate(), 4, 0, 0, 0,
    ));
    return { desde, hasta: new Date(desde.getTime() + 24 * 60 * 60 * 1000) };
}
