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
 * Gracia después de la hora programada antes de dar una dosis por perdida.
 *
 * ERAN DOS HORAS, Y ESE NÚMERO NO SALÍA DE NINGÚN SITIO. El comentario decía
 * que "dos horas cubre el desfase real de un turno". Hasta hoy nadie podía
 * comprobarlo, porque el cron no escribía y `MISSED` no existía en toda la
 * historia de la base.
 *
 * MEDIDO EL 15-SEP-2026 sobre 10.571 firmas de 45 días con franja conocida,
 * comparando la hora de registro con la hora programada:
 *
 *     mediana  +1h08      p90  +3h56      p95  +4h44
 *
 *     más de 2h después:  1.962 de 10.571  =  18,6%
 *     más de 4h después:    974            =   9,2%
 *     más de 6h después:     57            =   0,5%
 *
 * Y por franja, el pack grande es el peor: de las 5.827 firmas de las 8:00 AM,
 * el 26% se registran pasadas las dos horas. Las 5:00 PM, el 36%.
 *
 * O sea que la ventana de dos horas no medía omisiones: fabricaba una cada
 * cuatro dosis del pack de la mañana. El primer día que el cron funcionó —hoy—
 * iba a marcar como perdidas 208 dosis a las 10:00 que se estaban dando.
 *
 * SEIS HORAS deja fuera el 0,5%. Sigue siendo el mismo día y sigue siendo
 * accionable: una dosis de las 8:00 AM se señala a las 2:00 PM, con turno de
 * tarde todavía por delante. Lo que ya no hace es acusar al piso de no dar algo
 * que estaba dando.
 *
 * La regla de fondo —una dosis es perdida cuando termina el TURNO al que
 * pertenece, no cuando pasa un reloj fijo— es mejor y está pendiente de
 * decisión. Esto es lo honesto que cabe en una constante.
 */
const GRACIA_MS = 6 * 60 * 60 * 1000;

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
        where: { status: MedActiveStatus.ACTIVE, isActive: true },
        // frequency y scheduleDays se piden porque SIN ELLOS no se puede saber
        // qué días toca una pauta semanal. Ver el bloque de abajo.
        select: { id: true, scheduleTimes: true, frequency: true, scheduleDays: true },
    });

    const ahora = new Date();
    let creadas = 0;
    let omitidas = 0;
    let noProgramables = 0;

    /**
     * EL DÍA DE LA SEMANA, EN HORA DE PUERTO RICO.
     *
     * `getDay()` a secas lee el reloj local, que en Vercel es UTC: entre las
     * 8 de la noche y la medianoche de aquí, UTC ya está en el día siguiente.
     * El cron corre a las 6:01 AM así que hoy no muerde, pero un cron que
     * depende de la hora a la que se le llama es un cron roto esperando.
     *
     * `todayStartAST()` devuelve el arranque del día clínico en UTC; su
     * `getUTCDay()` es el día de la semana de aquí.
     */
    const diaDeLaSemanaAST = todayStartAST().getUTCDay();

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
 * Marca MISSED las dosis PENDING cuya hora pasó hace más de la gracia.
 *
 * Sin esto, materializar solo acumularía PENDING para siempre y el
 * cumplimiento seguiría sin significar nada.
 */
export async function marcarDosisVencidas(): Promise<number> {
    const limite = new Date(Date.now() - GRACIA_MS);
    const r = await prisma.medicationAdministration.updateMany({
        where: { status: MedStatus.PENDING, scheduledTime: { lt: limite } },
        data: { status: MedStatus.MISSED },
    });
    return r.count;
}
