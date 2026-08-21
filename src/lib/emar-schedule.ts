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
 * Dos horas cubre el desfase real de un turno sin volver "perdida" una dosis
 * que se dio con retraso normal. No penaliza a nadie —nada descuenta puntos
 * por MISSED— pero sí hace visible lo que hoy es invisible.
 */
const GRACIA_MS = 2 * 60 * 60 * 1000;

/**
 * Crea las filas PENDING de todas las dosis programadas para hoy.
 *
 * Idempotente por el unique (patientMedicationId, scheduledTime): correrlo dos
 * veces no duplica. Devuelve cuántas creó.
 */
export async function materializarDosisDelDia(): Promise<{ creadas: number; omitidas: number }> {
    const meds = await prisma.patientMedication.findMany({
        where: { status: MedActiveStatus.ACTIVE, isActive: true },
        select: { id: true, scheduleTimes: true },
    });

    const ahora = new Date();
    let creadas = 0;
    let omitidas = 0;

    for (const pm of meds) {
        if (!pm.scheduleTimes) { omitidas++; continue; }

        for (const raw of pm.scheduleTimes.split(',')) {
            const txt = raw.trim();
            if (!txt) continue;

            let hora: { hour: number; minute: number };
            try {
                hora = parseTimeOfDay(txt);
            } catch {
                // Formato que no parsea: se cuenta y se sigue. Reventar aquí
                // dejaría al hogar sin el resto de sus dosis del día.
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
                        administeredById: 'SYSTEM',
                    },
                });
                creadas++;
            } catch {
                omitidas++;
            }
        }
    }

    return { creadas, omitidas };
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
