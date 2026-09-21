import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay, todayStartAST } from '@/lib/dates';
import { MedStatus, MedActiveStatus } from '@prisma/client';

/**
 * Materialización de las dosis del día y barrido de las vencidas.
 *
 * Hallazgo del 21-ago-2026. El "Cumplimiento eMAR" del dashboard mostraba
 * 100% siempre, y no porque el hogar fuera perfecto: la fila de
 * MedicationAdministration se creaba EN EL MOMENTO de administrar. Una dosis
 * que nadie tocó no dejaba rastro, así que el cálculo dividía
 * administradas / administradas.
 *
 * Los números: 309 medicamentos activos con 366 dosis programadas al día, 91
 * días de operación → unas 33,300 dosis esperadas. Filas existentes: 21,004.
 * El 37% de las dosis nunca existió para el sistema.
 *
 * Existía `executeDailyCronExpansion` en src/actions/emar — con "Cron" en el
 * nombre y sin que ningún cron lo llamara. Nunca corrió. Además componía la
 * hora con `setHours`, que sobre Vercel aplica el reloj UTC y deja las dosis
 * corridas cuatro horas respecto a AST.
 *
 * Y nada marcaba MISSED jamás, aunque el briefing del director, las tendencias
 * y el calendario lean ese estado. Tres pantallas leyendo un estado imposible.
 */

/**
 * UNA DOSIS SE PIERDE CUANDO CIERRA SU TURNO, NO CUANDO PASA UN RELOJ.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE ESTA REGLA
 *
 * Aquí había una constante: primero dos horas, luego seis. Las dos eran
 * inventadas — un número igual para el pack de las 8 de la mañana y para el de
 * las 8 de la noche, que no se parecen en nada.
 *
 * Medido el 15-sep-2026 sobre 10.608 firmas de 45 días, comparando la hora de
 * registro con la hora programada:
 *
 *     8:00 AM   n=5864   26% se registran pasadas 2 h
 *     5:00 PM   n= 833   36%
 *     2:00 PM   n= 132   92%
 *     8:00 PM   n=3425    0%
 *     5:00 AM   n= 325    0%
 *
 * Ningún número fijo sirve para esas cinco a la vez. Dos horas acusaba a una de
 * cada cuatro dosis del pack de la mañana; seis horas daba ocho horas de manga
 * al pack de la noche, que se firma entero en hora y media.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE LAS MISMAS 10.608 FIRMAS DICEN CONTRA EL CIERRE DE TURNO
 *
 * Turnos de la casa: MAÑANA 06–14, TARDE 14–22, NOCHE 22–06.
 *
 *     firmadas DESPUÉS de cerrar su turno:  6 de 10.608  =  0,1%
 *
 * Y el detalle importa más que el total: el percentil 99 del margen es de
 * **dos minutos antes del cierre** en el pack de las 8 AM, cuatro minutos antes
 * en el de las 5 PM, dos en el de las 8 PM. O sea que el piso no firma "dentro
 * de X horas": firma ANTES DE ENTREGAR EL TURNO. La frontera real del hogar es
 * el relevo, y siempre lo fue — lo que faltaba era que el sistema la usara.
 *
 * Por franja, el porcentaje que se pasa del cierre es 0,0% en todas menos la de
 * las 5:00 AM, donde son 6 dosis de 325 (1,8%) y el percentil 99 está en +16 h:
 * esas seis son retrasos de verdad, no ruido de la regla.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Y POR QUÉ MEDIA HORA DE RELEVO
 *
 * El turno no termina en un filo: el relevo se solapa. Como el percentil 99
 * roza el cierre por abajo, sin margen habría parpadeos —una dosis marcada
 * perdida a las 14:00 y firmada a las 14:05— que ahora se corrigen solos
 * (la tableta firma sobre la fila, ver emar-conciliar.ts) pero que no hay
 * ninguna razón para producir. Media hora los quita y no cuesta sensibilidad:
 * de las 6 que se pasan, 5 lo hacen por más de dos horas.
 */
const GRACIA_RELEVO_MS = 30 * 60 * 1000;

/** El desfase de Puerto Rico. Sin horario de verano: es constante todo el año. */
const AST_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * El instante en que cierra el turno al que pertenece una dosis.
 *
 * MAÑANA 06–14 → cierra a las 14:00 del mismo día.
 * TARDE  14–22 → cierra a las 22:00 del mismo día.
 * NOCHE  22–06 → cierra a las 06:00. Si la dosis es de las 22 en adelante, ese
 *                cierre es el del día SIGUIENTE; si es de madrugada, el de hoy.
 */
export function finDelTurnoDe(scheduledTime: Date): Date {
    const horaAST = new Date(scheduledTime.getTime() - AST_OFFSET_MS).getUTCHours();

    if (horaAST >= 6 && horaAST < 14) return astDateTime(scheduledTime, 14, 0);
    if (horaAST >= 14 && horaAST < 22) return astDateTime(scheduledTime, 22, 0);

    // Noche. Las de después de las 22:00 cierran en la madrugada siguiente.
    const diaDelCierre = horaAST >= 22
        ? new Date(scheduledTime.getTime() + 24 * 60 * 60 * 1000)
        : scheduledTime;
    return astDateTime(diaDelCierre, 6, 0);
}

/**
 * Horarios que NO se materializan, y por qué.
 *
 * Al conectar esto aparecieron 17 entradas que no parsean como hora. No son
 * datos rotos: son dos conceptos clínicos que `scheduleTimes` no sabe expresar.
 *
 * PRN (pro re nata, "según se necesite") — Pepcid, Clonidine. No tienen hora
 *   porque se dan cuando hacen falta. Una dosis PRN que no se dio NO es una
 *   dosis perdida, y materializarla a diario haría que el cumplimiento
 *   castigue al hogar por no medicar a quien no lo necesitaba.
 *
 * SEMANAL escrito a mano — "08:00 AM (Semanal)", la forma vieja, de cuando no
 *   había dónde poner el día. Sigue sin decir QUÉ DÍA, así que no se puede
 *   materializar sin inventarse seis dosis de siete.
 *
 * Ambos se cuentan aparte para que se vean, en vez de desaparecer en un catch.
 *
 * YA NO ES LA ÚNICA GUARDA. Desde el 11-sep-2026 los días viven en la columna
 * `scheduleDays` y el horario queda limpio ("05:00 AM"), así que este regex no
 * las reconoce — quien decide qué días toca es `tocaHoyAST`, arriba. Este regex
 * se queda para las que todavía llevan el texto viejo.
 */
const NO_PROGRAMABLE = /\b(PRN|semanal|weekly|mensual|monthly)\b/i;

/**
 * ¿Toca hoy esta receta? Misma regla que `tocaHoy` de src/lib/receta.ts, pero
 * recibiendo el día ya resuelto en hora de Puerto Rico en vez de leerlo del
 * reloj del proceso — que en Vercel es UTC y adelanta el día a las 8 PM de aquí.
 */
function tocaHoyAST(
    med: { frequency?: string | null; scheduleDays?: number[] | null },
    diaAST: number,
): boolean {
    if ((med.frequency ?? '').toUpperCase().includes('PRN')) return false;
    const dias = med.scheduleDays ?? [];
    if (dias.length === 0) return true; // sin días marcados = todos los días
    return dias.includes(diaAST);
}

/**
 * Crea las filas PENDING de todas las dosis programadas para hoy.
 *
 * Idempotente por el unique (patientMedicationId, scheduledTime): correrlo dos
 * veces no duplica. Devuelve cuántas creó.
 */
export async function materializarDosisDelDia(): Promise<{ creadas: number; omitidas: number; noProgramables: number }> {
    const meds = await prisma.patientMedication.findMany({
        /**
         * SOLO A QUIEN ESTÁ EN EL EDIFICIO.
         *
         * Aquí se filtraba la RECETA —activa y no descontinuada— y nunca al
         * RESIDENTE. Es el antipatrón 2 de CLAUDE.md, el que aparece cuatro
         * veces en sitios sin relación: una consulta que lista personas y no
         * filtra a quien ya no está.
         *
         * Medido el 15-sep-2026, el primer día que el cron escribió de verdad:
         * de las 359 dosis que creó, **90 eran de 12 personas que no estaban en
         * el hogar** — nueve fallecidos, dos dados de alta y una de permiso.
         * Carlos I. Aponte murió el 10 de junio y el sistema le programó 20
         * dosis esa mañana; a las 14:30 marcó 11 como omitidas. Wilfredo Matos,
         * fallecido en junio, otras 3.
         *
         * O sea que el primer número de cumplimiento de la historia del hogar
         * salía en 81,9% cuando el real era 95,9%: **54 de las 65 omisiones
         * eran de residentes ausentes**. Un número que acusa al piso de no
         * medicar a gente que no está no es un número duro, es una calumnia
         * con decimales.
         *
         * TEMPORARY_LEAVE también queda fuera: el residente está fuera del
         * edificio —hospital, casa de familia— y el hogar no puede medicarlo.
         *
         * Queda pendiente la otra mitad, que no es de este fichero: hay 74
         * recetas en estado ACTIVE colgando de residentes que ya no están. El
         * alta y el fallecimiento no las descontinúan.
         */
        where: {
            status: MedActiveStatus.ACTIVE,
            isActive: true,
            patient: { status: 'ACTIVE' },
        },
        // frequency y scheduleDays se piden porque SIN ELLOS no se puede saber
        // qué días toca una pauta semanal. Ver el bloque de abajo.
        select: { id: true, scheduleTimes: true, frequency: true, scheduleDays: true },
    });

    const ahora = new Date();
    let creadas = 0;
    let omitidas = 0;
    let noProgramables = 0;

    /**
     * EL DÍA DE LA SEMANA, EN HORA DE PUERTO RICO — Y DEL DÍA DE CALENDARIO.
     *
     * `getDay()` a secas lee el reloj local, que en Vercel es UTC: entre las
     * 8 de la noche y la medianoche de aquí, UTC ya está en el día siguiente.
     * Un cron que depende de la hora a la que se le llama es un cron roto
     * esperando — y este dejó de correr solo a las 6:01, así que ya muerde.
     *
     * ANTES SALÍA DE `todayStartAST()`, el arranque del DÍA CLÍNICO, que son
     * las 6:00 AM. Y eso es correcto solo si el cron corre después de esa hora.
     * Desde el 21-sep-2026 hay una pasada a las 04:00 AST —ver
     * /api/cron/materializar-dosis y el porqué abajo— y a esa hora
     * `todayStartAST()` todavía devuelve el día clínico de AYER: el alendronato
     * semanal de los viernes no se habría materializado nunca.
     *
     * Lo correcto para materializar es el día de CALENDARIO de `ahora` en hora
     * de aquí, porque `scheduleTimes` son horas de reloj de un día natural
     * ("05:00 AM", "08:00 PM"), no posiciones dentro del día clínico. A las
     * 6:01 las dos formas dan lo mismo; entre medianoche y las 6 no, y la
     * buena es esta.
     */
    const diaDeLaSemanaAST = new Date(ahora.getTime() - 4 * 60 * 60 * 1000).getUTCDay();

    for (const pm of meds) {
        if (!pm.scheduleTimes) { omitidas++; continue; }

        /**
         * UNA PAUTA SEMANAL SOLO SE MATERIALIZA EL DÍA QUE TOCA.
         *
         * Esto ya estaba previsto —el comentario de NO_PROGRAMABLE dice que
         * materializar semanales a diario "hundiría el cumplimiento por un
         * medicamento que se está dando bien"— pero la guarda era un REGEX
         * SOBRE EL TEXTO DEL HORARIO, buscando la palabra "Semanal" dentro de
         * "08:00 AM (Semanal)".
         *
         * Y el 11-sep-2026 se arregló justamente eso: los días pasaron a su
         * propia columna `scheduleDays` y el horario quedó limpio, "05:00 AM".
         * Así que la guarda dejó de reconocerlas y desde entonces las semanales
         * se materializan LOS SIETE DÍAS.
         *
         * Medido el 15-sep-2026, un martes: 7 dosis semanales materializadas,
         * y NINGUNA de las 7 tocaba ese día — todas son de viernes o domingo.
         * Una ya había pasado a MISSED: el Alendronate 70mg de Hugo Ventura,
         * acusado de no darse un día en que no había que darlo. A seis días
         * falsos por semana eso son ~42 omisiones inventadas cada semana, cada
         * una con su aviso en el calendario.
         *
         * `tocaHoy` vive en src/lib/receta.ts y ya sabe esto; lo que faltaba era
         * llamarlo. Se le pasa el día de aquí, no el del servidor.
         */
        if (!tocaHoyAST(pm, diaDeLaSemanaAST)) { noProgramables++; continue; }

        for (const raw of pm.scheduleTimes.split(',')) {
            const txt = raw.trim();
            if (!txt) continue;

            // PRN y semanales quedan fuera a propósito — ver NO_PROGRAMABLE.
            if (NO_PROGRAMABLE.test(txt)) { noProgramables++; continue; }

            let hora: { hour: number; minute: number };
            try {
                hora = parseTimeOfDay(txt);
            } catch {
                // Formato inesperado de verdad. Se cuenta y se sigue: reventar
                // aquí dejaría al hogar sin el resto de sus dosis del día.
                omitidas++;
                continue;
            }

            // astDateTime, no setHours: en Vercel el reloj es UTC y la dosis
            // quedaría cuatro horas corrida respecto al turno real.
            const scheduledTime = astDateTime(ahora, hora.hour, hora.minute);

            try {
                await prisma.medicationAdministration.upsert({
                    where: { patientMedicationId_scheduledTime: { patientMedicationId: pm.id, scheduledTime } },
                    update: {},
                    create: {
                        patientMedicationId: pm.id,
                        scheduledFor: txt,
                        scheduledTime,
                        status: MedStatus.PENDING,
                        // Sin firmar: nadie la ha dado todavía. Aquí ponía el id
                        // literal 'SYSTEM', un usuario que no existe, así que
                        // CADA create violaba la llave foránea y el catch de
                        // abajo se lo tragaba. Cinco meses creando cero dosis.
                    },
                });
                creadas++;
            } catch (e) {
                /**
                 * El catch ya no es mudo.
                 *
                 * Era `catch { omitidas++ }` a secas, y eso fue lo que escondió
                 * durante cinco meses que el 100% de las escrituras fallaba: el
                 * cron corría puntual a las 6:01, devolvía `creadas: 0,
                 * omitidas: N` y nadie mira un contador que siempre dice lo
                 * mismo. Un fallo que se cuenta pero no se nombra es un fallo
                 * invisible.
                 */
                console.error('[emar-schedule] no se pudo materializar la dosis', {
                    patientMedicationId: pm.id,
                    scheduledFor: txt,
                    error: e instanceof Error ? e.message : String(e),
                });
                omitidas++;
            }
        }
    }

    return { creadas, omitidas, noProgramables };
}

/**
 * Marca MISSED las dosis PENDING cuyo turno ya cerró.
 *
 * Sin esto, materializar solo acumularía PENDING para siempre y el cumplimiento
 * seguiría sin significar nada.
 *
 * El corte se calcula fila por fila y no con un `lt` sobre `scheduledTime`,
 * porque el límite depende de la HORA DEL DÍA de cada dosis: las 8:00 AM cierran
 * a las 14:00 y las 8:00 PM a las 22:00, seis horas y dos horas de margen
 * respectivamente. Eso no se expresa en un solo `where`.
 *
 * El coste es leer las pendientes antes de escribir. Son ~360 al día, más las
 * rezagadas de días anteriores que siguen abiertas; el `take` está para que un
 * día raro no se traiga la tabla entera.
 *
 * Lo llaman dos crones: /api/cron/dispatch-frequent cada 15 minutos y
 * /api/cron/operational cada hora. Con el de 15 minutos, el cierre de un turno
 * se detecta como mucho un cuarto de hora tarde.
 */
export async function marcarDosisVencidas(): Promise<number> {
    const ahora = Date.now();

    const pendientes = await prisma.medicationAdministration.findMany({
        where: { status: MedStatus.PENDING, scheduledTime: { not: null } },
        select: { id: true, scheduledTime: true },
        orderBy: { scheduledTime: 'asc' },
        take: 5000,
    });

    const vencidas = pendientes
        .filter(d => ahora >= finDelTurnoDe(d.scheduledTime!).getTime() + GRACIA_RELEVO_MS)
        .map(d => d.id);

    if (vencidas.length === 0) return 0;

    const r = await prisma.medicationAdministration.updateMany({
        where: { id: { in: vencidas } },
        data: { status: MedStatus.MISSED },
    });
    return r.count;
}
