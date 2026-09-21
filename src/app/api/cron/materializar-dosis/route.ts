import { NextResponse } from 'next/server';
import { materializarDosisDelDia } from '@/lib/emar-schedule';
import { requireCronSecret } from '@/lib/cron-auth';

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
 * ⚠ DESPROGRAMADO EL 21-sep-2026, EL MISMO DÍA, ANTES DE SU PRIMERA CORRIDA.
 *
 * La ruta se queda; la entrada de vercel.json se quitó. Motivo: una revisión
 * adversarial del cambio encontró que adelantar la creación de las filas a las
 * 04:00 APAGA EL eMAR DE TODAS LAS PANTALLAS DE "HOY".
 *
 * Siete sitios acotan el eMAR del día con `createdAt >= todayStartAST()`, y
 * `todayStartAST()` son las 06:00 AST. Las filas nacían a las 06:00:0x y
 * entraban en la ventana POR TREINTA Y SIETE SEGUNDOS. Creadas a las 04:00
 * quedan fuera el día entero — y nada vuelve a tocar `createdAt` después, ni el
 * upsert de la segunda pasada (`update: {}`) ni la firma (un `updateMany` que
 * no lo incluye).
 *
 * Medido simulando las filas reales: 270 de 273 visibles el 20-sep → 0.
 * 262 de 271 hoy → 0. Se quedarían en blanco la pizarra de la pared, el panel
 * del supervisor ("6 sin dar de 271" → "0 de 0"), facility-health y el portal
 * de la familia, que volvería al "—" que se arregló el 11-sep.
 *
 * O sea: el arreglo era peor que el fallo. Mejor romper el ritmo que romper
 * producción.
 *
 * QUÉ FALTA PARA REACTIVARLO: anclar esas siete lecturas al DÍA DE CALENDARIO
 * AST de `scheduledTime` (`fechaCalendarioAST()`), que es el mismo día con el
 * que `materializarDosisDelDia` construye la fila — lector y escritor usando la
 * misma definición de día. `createdAt` dejó de servir para esto el 15-sep, en
 * cuanto la fila pasó a nacer ANTES del acto; de hecho ya se pierden 3-9 filas
 * al día por esto, las que firma la tableta de madrugada. El `where` tiene que
 * llevar un OR para las filas sin `scheduledTime` (los PRN nunca lo llevan).
 *
 * Mientras tanto el pack de las 5:00 AM sigue naciendo tarde. Es el fallo
 * conocido y medido, y lleva así desde el 15-sep: una noche más no lo empeora.
 */
export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        const r = await materializarDosisDelDia();
        console.log(
            `[materializar-dosis 04:00] creadas: ${r.creadas} · ` +
            `PRN/semanales fuera: ${r.noProgramables} · sin formato: ${r.omitidas}`,
        );
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
