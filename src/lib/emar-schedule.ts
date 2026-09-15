import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay } from '@/lib/dates';
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
 * SEMANAL — Alendronate 70mg, entre otros. Se dan una vez por semana, pero la
 *   cadena guarda "08:00 AM (Semanal)" sin decir QUÉ DÍA. Materializarlas a
 *   diario crearía siete veces las dosis reales y hundiría el cumplimiento por
 *   un medicamento que se está dando bien.
 *
 * Ambos se cuentan aparte para que se vean, en vez de desaparecer en un catch.
 * Rastrear los semanales de verdad necesita un campo de día de la semana en el
 * schema — hasta entonces, quedan fuera del cómputo a sabiendas.
 */
const NO_PROGRAMABLE = /\b(PRN|semanal|weekly|mensual|monthly)\b/i;

/**
 * Crea las filas PENDING de todas las dosis programadas para hoy.
 *
 * Idempotente por el unique (patientMedicationId, scheduledTime): correrlo dos
 * veces no duplica. Devuelve cuántas creó.
 */
export async function materializarDosisDelDia(): Promise<{ creadas: number; omitidas: number; noProgramables: number }> {
    const meds = await prisma.patientMedication.findMany({
        where: { status: MedActiveStatus.ACTIVE, isActive: true },
        select: { id: true, scheduleTimes: true },
    });

    const ahora = new Date();
    let creadas = 0;
    let omitidas = 0;
    let noProgramables = 0;

    for (const pm of meds) {
        if (!pm.scheduleTimes) { omitidas++; continue; }

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
