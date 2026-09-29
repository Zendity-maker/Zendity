import { NextResponse } from 'next/server';
import { materializarDosisDelDia } from '@/lib/emar-schedule';
import { requireCronSecret } from '@/lib/cron-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * CRON — Materializar las dosis del día, A LAS 04:00 AST (08:00 UTC).
 *
 * ═══ POR QUÉ EXISTE, Y POR QUÉ A LAS CUATRO DE LA MAÑANA ═══
 *
 * Hasta hoy las dosis del día las creaba `clinical-day-start`, que corre a las
 * 06:00 AST. Para casi todas las franjas eso está bien: la fila nace horas
 * antes de que toque la dosis.
 *
 * Para UNA no. El pack de las **05:00 AM** nacía SESENTA Y UN MINUTOS DESPUÉS
 * de su propia hora. Y el barrido que marca las omisiones cierra el turno de
 * noche a las 06:00 más 30 minutos de relevo: `finDelTurnoDe(05:00)` = 06:30.
 * O sea que la fila vivía **veintinueve minutos**, y esa ventana abría cuando
 * el turno de noche (22–06) ya se había ido a casa.
 *
 * Medido contra producción el 21-sep-2026, desde el 15-sep:
 *
 *   quién creó la fila           administradas   omitidas
 *   ─────────────────────────────────────────────────────
 *   el cron, a las 06:00:37            20            25   (56%)
 *   la tableta, antes de las 06:01     26             0
 *
 * La ronda SE HACE. Neylianne Torres, Carlos Negrón y Yedaira González firman
 * entre las 04:37 y las 05:58 y sus dosis salen administradas — porque la
 * tableta crea la fila al firmar. A quien el cron le gana la mano, el sistema
 * lo acusa de una omisión que no ocurrió. Ese pack arrastraba el turno NOCHE
 * entero al 36,8% de omisión mientras el resto del hogar iba al 4-8%.
 *
 * LAS CUATRO SALEN DE LOS DATOS, no de un número redondo: la firma más
 * temprana de toda la historia del pack es a las **04:37**, y no hay ni una
 * antes de las 04:00 (0 de 46). A las cuatro la fila existe una hora antes de
 * que toque la dosis y antes que cualquier firma registrada jamás.
 *
 * ═══ QUÉ HAY EN ESE PACK, QUE ES LO QUE LO HACE GRAVE ═══
 *
 * Las diez recetas de las 05:00 son **levotiroxina** (nueve) y un **alendronato
 * semanal**. Las dos cosas se dan EN AYUNAS, media hora antes del desayuno: la
 * hora no es un capricho de horario, es la indicación. Marcar como omitido el
 * 56% de ese pack no es un error de contabilidad, es un expediente clínico que
 * dice que no se dio una medicación que sí se dio.
 *
 * ═══ POR QUÉ UN CRON APARTE Y NO MOVER EL DE LAS 6 ═══
 *
 * `clinical-day-start` hace algo más que materializar: compila las últimas 24 h
 * del día clínico que TERMINA y escribe el prólogo para el turno de la mañana.
 * A las 04:00 el día clínico no ha terminado —acaba a las 06:00— así que ese
 * resumen saldría con la ventana equivocada y saludaría dos horas antes a quien
 * todavía no ha llegado. Se separan las dos cosas.
 *
 * `materializarDosisDelDia` sigue llamándose también desde las 06:00, a
 * propósito: es un `upsert` por (receta, instante), así que correrlo dos veces
 * no duplica nada, y si esta pasada de las cuatro falla, la de las seis crea
 * igual el resto del día. Red de seguridad, no duplicado.
 */
/**
 * ⚠ ESTUVO DESPROGRAMADO UNAS HORAS EL 21-sep-2026, Y POR QUÉ IMPORTA SABERLO.
 *
 * Al crearlo, una revisión adversarial encontró que adelantar la creación de
 * las filas APAGABA el eMAR de todas las pantallas de "hoy": siete sitios
 * acotaban el día con `createdAt >= todayStartAST()` —las 06:00 AST— y las
 * filas entraban en esa ventana por TREINTA Y SIETE SEGUNDOS. Creadas a las
 * 04:00 quedaban fuera el día entero. Medido: 271 filas visibles → 0.
 *
 * Se desprogramó el mismo día, antes de su primera corrida, y se reactivó
 * cuando esas siete lecturas pasaron a anclarse a la FECHA DE LA DOSIS
 * (src/lib/emar-dia.ts). Comprobado después del cambio: con el ancla nueva se
 * ven las 271 del día **corra el cron a la hora que corra**.
 *
 * La lección, que es la que hay que conservar: la hora a la que se escribe y la
 * ventana con la que se lee eran la misma cosa sin que nadie lo hubiera
 * decidido. Mientras el lector se anclaba a `createdAt`, mover este cron —un
 * minuto o dos horas— rompía cuatro pantallas. Ahora no: lector y escritor usan
 * la misma definición de día.
 */
export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        const r = await materializarDosisDelDia();
        console.log(
            `[materializar-dosis 04:00] creadas: ${r.creadas} · ` +
            `PRN/semanales fuera: ${r.noProgramables} · sin formato: ${r.omitidas} · ` +
            `recetas sin programar: ${r.sinProgramar.length}`,
        );

        /**
         * UNA RECETA QUE NO SE PUEDE PROGRAMAR TIENE QUE VERSE.
         *
         * El contador existía desde siempre y solo iba a un `console.log`. Nadie
         * lee los logs de Vercel a diario, así que la Vitamina D3 de Isidra E.
         * Beaton Rosales lleva 131 días recetada con CERO administraciones y sin
         * que nada lo dijera.
         *
         * No se puede arreglar sola: «08:00 AM (Semanal)» no dice QUÉ DÍA, y el
         * cron hace bien en no inventarse seis dosis de siete. Lo que hace falta
         * es que alguien ponga el día en `scheduleDays` — y para eso primero
         * tiene que enterarse.
         *
         * Mismo patrón que el aviso de úlcera sin plan: se repite a diario
         * mientras la receta siga rota, y la forma de callarlo es arreglarla.
         */
        if (r.sinProgramar.length > 0) {
            const hqIds = [...new Set(r.sinProgramar.map(x => x.headquartersId).filter(Boolean))];
            const [staff, avisadosHoy] = await Promise.all([
                prisma.user.findMany({
                    where: {
                        headquartersId: { in: hqIds },
                        isActive: true, isDeleted: false,
                        OR: [
                            { role: { in: ['NURSE', 'SUPERVISOR', 'DIRECTOR'] as any } },
                            { secondaryRoles: { hasSome: ['NURSE', 'SUPERVISOR'] } },
                        ],
                    },
                    select: { id: true, headquartersId: true },
                }),
                prisma.notification.findMany({
                    where: {
                        type: 'SHIFT_ALERT',
                        title: { startsWith: 'Receta sin programar' },
                        createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
                    },
                    select: { userId: true, title: true },
                }),
            ]);
            const yaAvisado = new Set(avisadosHoy.map(n => `${n.userId}|${n.title}`));
            const avisos: { userId: string; type: string; title: string; message: string; link: string; isRead: boolean }[] = [];

            for (const rec of r.sinProgramar) {
                const title = `Receta sin programar — ${rec.residente}`;
                const message = `${rec.medicamento} tiene el horario escrito como «${rec.scheduleTimes}», que no dice qué día de la semana toca. El sistema no puede crear la dosis, así que no aparece en la tableta y nadie la está dando. Hay que ponerle el día en el expediente.`;
                for (const u of staff.filter(s => s.headquartersId === rec.headquartersId)) {
                    if (yaAvisado.has(`${u.id}|${title}`)) continue;
                    avisos.push({ userId: u.id, type: 'SHIFT_ALERT', title, message, link: '/corporate/medical/patients', isRead: false });
                }
            }
            if (avisos.length > 0) await prisma.notification.createMany({ data: avisos });
            console.log(`[materializar-dosis 04:00] avisos de receta sin programar: ${avisos.length}`);
        }

        return NextResponse.json({ success: true, ...r });
    } catch (e: any) {
        // Se devuelve 500 A PROPÓSITO, en vez de tragárselo: si esta pasada
        // falla, el pack de las 5 AM vuelve a nacer tarde y a morir en media
        // hora. Un cron que falla en silencio es como este fallo llegó a durar
        // cinco días sin que nadie lo viera. Que se note en el log de Vercel.
        console.error('[materializar-dosis 04:00] FALLÓ:', e);
        return NextResponse.json({ success: false, error: 'Fallo materializando dosis' }, { status: 500 });
    }
}
