import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay, todayStartAST } from '@/lib/dates';
import { MedStatus, MedActiveStatus } from '@prisma/client';
import { notifyUser } from '@/lib/notifications';
import { logWarn } from '@/lib/logger';

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
/** Una receta que el cron NO puede programar y que alguien tiene que arreglar. */
export interface RecetaSinProgramar {
    patientMedicationId: string;
    residente: string;
    medicamento: string;
    scheduleTimes: string;
    headquartersId: string;
}

export async function materializarDosisDelDia(): Promise<{
    creadas: number;
    omitidas: number;
    noProgramables: number;
    /**
     * LAS QUE HAY QUE ARREGLAR, SEPARADAS DE LAS QUE ESTÁN BIEN.
     *
     * `noProgramables` sumaba TRES cosas distintas y solo una es un problema:
     *
     *   · una pauta semanal que hoy no toca ....... correcto, es el diseño
     *   · una PRN ................................. correcto, se dan cuando hacen falta
     *   · «08:00 AM (Semanal)», el formato viejo .. ROTO: no dice qué día, así que
     *                                               no se materializa nunca
     *
     * Medido el 29-sep-2026: de 255 recetas activas hay UNA en formato viejo —
     * la Vitamina D3 de Isidra E. Beaton Rosales, recetada hace 131 días y con
     * CERO administraciones. El cron hace bien en saltarla; lo que faltaba es
     * que alguien se enterara. `noProgramables` solo iba a un `console.log`.
     */
    sinProgramar: RecetaSinProgramar[];
}> {
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
        select: {
            id: true, scheduleTimes: true, frequency: true, scheduleDays: true,
            // Para poder decir DE QUIÉN es la receta que no se puede programar.
            patient: { select: { name: true, headquartersId: true } },
            medication: { select: { name: true } },
        },
    });

    const ahora = new Date();
    let creadas = 0;
    let omitidas = 0;
    let noProgramables = 0;
    const sinProgramar: RecetaSinProgramar[] = [];

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
            if (NO_PROGRAMABLE.test(txt)) {
                noProgramables++;
                /**
                 * Una PRN está bien así: se da cuando hace falta. Lo que NO está
                 * bien es el formato viejo —«08:00 AM (Semanal)»—, que no dice
                 * qué día y por eso no se materializa NUNCA. Esa se separa para
                 * que alguien pueda arreglarla.
                 */
                if (!/\bPRN\b/i.test(txt) && !sinProgramar.some(s => s.patientMedicationId === pm.id)) {
                    sinProgramar.push({
                        patientMedicationId: pm.id,
                        residente: pm.patient?.name?.trim() ?? '—',
                        medicamento: pm.medication?.name ?? '—',
                        scheduleTimes: pm.scheduleTimes,
                        headquartersId: pm.patient?.headquartersId ?? '',
                    });
                }
                continue;
            }

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
                        //
                        // `origen: CRON` dice que esta fila la creó la máquina y
                        // no la tocó nadie todavía. Quien la firme despues lo
                        // sobrescribe con el suyo. Ver RegistroOrigen.
                        origen: 'CRON',
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

    return { creadas, omitidas, noProgramables, sinProgramar };
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
export async function marcarDosisVencidas(): Promise<{ falladas: number; anuladas: number }> {
    const ahora = Date.now();

    const pendientes = await prisma.medicationAdministration.findMany({
        where: { status: MedStatus.PENDING, scheduledTime: { not: null } },
        /**
         * El estado del residente viaja ahora. Sin el, este barrido acusaba a
         * quien ya no estaba — ver abajo.
         */
        select: {
            id: true,
            scheduledTime: true,
            patientMedication: { select: { patient: { select: { status: true } } } },
        },
        orderBy: { scheduledTime: 'asc' },
        take: 5000,
    });

    const vencidas = pendientes.filter(
        d => ahora >= finDelTurnoDe(d.scheduledTime!).getTime() + GRACIA_RELEVO_MS,
    );
    if (vencidas.length === 0) return { falladas: 0, anuladas: 0 };

    /**
     * ═══ A QUIEN YA NO ESTA NO SE LE ACUSA DE NADA ═══
     *
     * El cron que MATERIALIZA las dosis solo las crea para residentes ACTIVE
     * (`materializarDosisDelDia`, mas arriba). Este barrido no miraba al
     * residente: convertia en MISSED por la hora y nada mas. La asimetria
     * fabricaba omisiones solas.
     *
     * El dia que alguien se va al hospital o fallece a media jornada, las dosis
     * que el cron ya le habia creado esa manana vencen igual, y la pantalla de
     * direccion las pintaba en negrita rosa —«N medicamentos sin administrar»—
     * al lado de la linea «Un residente al hospital» de esa misma persona.
     *
     * Medido el 03-oct-2026 en produccion: de las 273 MISSED de TODA la
     * historia, **109 eran de residentes DISCHARGED o DECEASED**. El 40%.
     *
     * Van a VOIDED y no a MISSED porque no describen un fallo de nadie: la fila
     * sobra. VOIDED ya existia para las duplicadas y tiene justo la propiedad
     * que hace falta —no entra en el numerador ni en el denominador de ninguna
     * metrica, porque todas usan listas explicitas—. Ver el enum en el schema.
     *
     * TEMPORARY_LEAVE NO entra aqui a proposito. Ahi caben una dialisis de
     * cuatro horas y una visita con la familia: el residente vuelve, y que una
     * dosis no se diera mientras estaba fuera SI es algo que el hogar tiene que
     * saber. Solo se anula a quien ya no vuelve.
     */
    const seFue = (d: typeof vencidas[number]) => {
        const st = d.patientMedication?.patient?.status;
        return st === 'DISCHARGED' || st === 'DECEASED';
    };

    const aAnular = vencidas.filter(seFue).map(d => d.id);
    const aFallar = vencidas.filter(d => !seFue(d)).map(d => d.id);

    const [anuladas, falladas] = await Promise.all([
        aAnular.length
            ? prisma.medicationAdministration.updateMany({
                where: { id: { in: aAnular } }, data: { status: MedStatus.VOIDED },
            })
            : Promise.resolve({ count: 0 }),
        aFallar.length
            ? prisma.medicationAdministration.updateMany({
                where: { id: { in: aFallar } }, data: { status: MedStatus.MISSED },
            })
            : Promise.resolve({ count: 0 }),
    ]);

    // Y se le dice a quien acaba de cerrar turno. Ver abajo.
    if (aFallar.length > 0) await avisarDeLoQueQuedoSinFirmar(aFallar);

    return { falladas: falladas.count, anuladas: anuladas.count };
}

/**
 * «ESTAS QUEDARON SIN FIRMAR. SI LAS DISTE, FIRMALAS.»
 *
 * ═══ POR QUE HACIA FALTA ═══
 *
 * Andres, 03-oct-2026: «¿Zendi le pregunta si los medicamentos fueron
 * administrados antes de declararlos missing?».
 *
 * No. El barrido era un `updateMany` mudo. La cuidadora NO se enteraba de que
 * una dosis suya acababa de quedar como no administrada, y habia una asimetria
 * sin defensa: si ella marca una dosis como omitida A MANO, el sistema notifica
 * a supervision y enfermeria con un EMAR_ALERT (`/api/care/meds`). Si la marca
 * el cron, no se entera NADIE — ni ella, ni enfermeria, ni supervision. El caso
 * que mas importa era justo el que iba en silencio.
 *
 * ═══ POR QUE DESPUES Y NO ANTES ═══
 *
 * Preguntar ANTES de marcar seria un interrogatorio a destiempo: la dosis vence
 * media hora despues de cerrar el turno, cuando ella ya se fue a su casa. Y
 * dejar la fila sin resolver esperando respuesta devolveria el problema que el
 * barrido vino a arreglar — el cumplimiento sin significado.
 *
 * Asi que se marca, y se avisa: la via para corregirlo ya existe —la tarjeta
 * ensena «Ya consta sin dar» y firmar la devuelve a ADMINISTERED— pero nadie
 * sabia que habia algo que corregir.
 *
 * ═══ EL TEXTO NO ACUSA ═══
 *
 * No dice «fallaste N dosis». Dice que quedaron sin firmar y que si se dieron,
 * se firmen. Es la regla de [[veracidad-no-puntuacion]]: ante un problema de
 * REGISTRO, hacer el dato veraz, no crear una metrica que castigue la conducta.
 * Una cuidadora a la que el sistema acusa aprende a no registrar.
 */
async function avisarDeLoQueQuedoSinFirmar(ids: string[]): Promise<void> {
    try {
        const dosis = await prisma.medicationAdministration.findMany({
            where: { id: { in: ids } },
            select: {
                scheduledTime: true,
                patientMedication: {
                    select: { patient: { select: { headquartersId: true, colorGroup: true } } },
                },
            },
        });

        /**
         * A quien se le dice: a quien tenia turno ABIERTO cuando vencio la
         * dosis. No se busca por color ni por pauta a proposito — un relevo, una
         * sustituta o una redistribucion cambian quien cubria a quien, y errar
         * el destinatario convierte un aviso util en una acusacion a la persona
         * equivocada. Quien estaba en el piso lo sabe; quien no, ignora el aviso.
         */
        const porSede = new Map<string, { cuantas: number; desde: Date; hasta: Date }>();
        for (const d of dosis) {
            const hq = d.patientMedication?.patient?.headquartersId;
            if (!hq || !d.scheduledTime) continue;
            const fin = finDelTurnoDe(d.scheduledTime);
            const prev = porSede.get(hq);
            porSede.set(hq, {
                cuantas: (prev?.cuantas ?? 0) + 1,
                desde: prev && prev.desde < d.scheduledTime ? prev.desde : d.scheduledTime,
                hasta: prev && prev.hasta > fin ? prev.hasta : fin,
            });
        }

        for (const [hqId, info] of porSede) {
            const enPiso = await prisma.shiftSession.findMany({
                where: {
                    headquartersId: hqId,
                    startTime: { lte: info.hasta },
                    OR: [{ actualEndTime: null }, { actualEndTime: { gte: info.desde } }],
                },
                select: { caregiverId: true },
                distinct: ['caregiverId'],
                take: 20,
            });

            const cuantas = info.cuantas;
            const mensaje = cuantas === 1
                ? 'Una dosis del turno que acaba de cerrar quedó sin firmar. Si se dio, fírmala en la tableta y deja de contar como fallada.'
                : `${cuantas} dosis del turno que acaba de cerrar quedaron sin firmar. Si se dieron, fírmalas en la tableta y dejan de contar como falladas.`;

            for (const s of enPiso) {
                await notifyUser(s.caregiverId, {
                    type: 'EMAR_ALERT',
                    title: 'Dosis sin firmar',
                    message: mensaje,
                    link: '/care',
                });
            }
        }
    } catch (e) {
        /**
         * Un fallo avisando NO puede tumbar el barrido: marcar las dosis es lo
         * que sostiene que el cumplimiento signifique algo, y el aviso es la
         * mejora de encima. Se nombra, eso si — el fallo mudo es lo que
         * escondio este modulo cinco meses.
         */
        logWarn('emar.aviso_dosis_sin_firmar', e);
    }
}
