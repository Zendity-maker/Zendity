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
 * ═══ LAS MARCAS AFINAN EL HORARIO (02-oct-2026) ═══
 *
 * Desde hoy el piso puede marcar la llegada y la salida de verdad
 * (`JornadaDiurna`). El horario NO deja de existir: pasa a ser el valor por
 * defecto y las marcas lo corrigen.
 *
 *     llegada efectiva = llegadaAt ?? las 7:00 de ese día
 *     salida  efectiva = salidaAt  ?? las 18:00 de ese día
 *
 * Lo importante es la asimetría: **olvidarse de marcar no cuesta nada**. Sin
 * marcas el sistema se comporta exactamente igual que antes de que la tabla
 * existiera. No es un fichaje —donde no marcar te deja fuera—; es una
 * corrección opcional sobre una regla que ya acertaba casi siempre.
 *
 * Y por eso una marca nunca se inventa. Si se va y nadie lo marca, `salidaAt`
 * queda null y se usan las 18:00, igual que `FamilyVisit.departedAt`.
 *
 * ═══ UN LÍMITE CONOCIDO ═══
 *
 * `estaEnElEdificio` mira la modalidad TAL COMO ESTÁ HOY. Si dentro de un año
 * se queda a vivir y alguien audita octubre, verá huecos de noche sin saber que
 * entonces era diurno. Arreglarlo pide anotar la modalidad en cada evento en
 * vez de deducirla, y eso solo hace falta si de verdad se va a mirar atrás.
 */

import { astDateTime, fechaCalendarioAST } from '@/lib/dates';

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

/**
 * Lo mínimo que hay que saber de alguien para decidir si está.
 *
 * `esDiurno` es OBLIGATORIO, no opcional, y es a propósito. Si falta en el
 * `select` de Prisma llega `undefined`, y `!undefined` es `true`: la función
 * contesta «sí, está» para TODAS las filas y no hay forma de notarlo mirando el
 * resultado — se lee igual que «ninguno es diurno». Es el antipatrón 9 de
 * CLAUDE.md, y pasó el 02-oct-2026 en el propio script que validaba esto: la
 * auditoría decía que el diurno estuvo en el turno de noche.
 *
 * Con el campo obligatorio, pasar un objeto que no lo trae es un error de
 * compilación en vez de una respuesta tranquilizadora. Por eso tampoco hay que
 * escribir `patient as any` en los call sites: ese cast apaga justo esta
 * protección.
 */
export interface ModalidadResidente {
    esDiurno: boolean | null;
}


/**
 * ═══ LO QUE ESTUVO AQUÍ Y YA NO ═══
 *
 * `estaEnElEdificio(residente, instante)` y `soloLosQueEstan(instante)` —la
 * versión del horario a secas, sin marcas— se borran el 02-oct-2026, el mismo
 * día que se escribieron sus sustitutas.
 *
 * No se dejan «por si acaso». Hacían exactamente lo mismo que
 * `estaEnElEdificioConMarcas` y `presenciaDeHoy` pero IGNORANDO las marcas, y
 * las dos seguían exportadas sin un solo llamador. Una copia viva de una regla
 * que ya cambió no es inofensiva: es la que alguien va a importar sin saber que
 * es la vieja, y entonces una pantalla deja de ver las marcas sin que nada
 * falle. Es la forma por defecto de equivocarse en este repo y está escrita en
 * CLAUDE.md.
 *
 * Lo que las sustituye:
 *     estaEnElEdificio(r, t)   →  estaEnElEdificioConMarcas(r, t, marcas)
 *     soloLosQueEstan(t)       →  presenciaDeHoy(t)
 */


// ════════════════════════════════════════════════════════════════════════════
// LAS MARCAS DE LLEGADA Y SALIDA
// ════════════════════════════════════════════════════════════════════════════

/** Lo que hace falta saber de la jornada de alguien para decidir si está. */
export interface MarcasDeJornada {
    llegadaAt?: Date | null;
    salidaAt?: Date | null;
}

/**
 * La fecha con la que se guarda y se busca una jornada.
 *
 * Es el día NATURAL de Puerto Rico a medianoche UTC, no el día clínico. Una
 * jornada de 7 a 18 no cruza la medianoche, así que su día es el del
 * calendario; y a las 3 de la mañana «hoy» es hoy, no ayer.
 *
 * Existe para que NADIE componga esta fecha a mano. El 21-sep-2026 una consulta
 * comparó un campo guardado a 00:00 UTC contra el ancla de las 10:00 UTC: la
 * condición nunca se cumplía para el día en curso y, sin cota superior, devolvía
 * el futuro bajo el rótulo «hoy». No dio error ni dio cero.
 */
export function fechaDeLaJornada(instante: Date = new Date()): Date {
    return fechaCalendarioAST(instante);
}

/**
 * ¿CUADRAN LAS MARCAS?
 *
 * Una marca suelta puede dejar la jornada INVERTIDA. El caso real: nadie marcó
 * la salida de ayer, y a las 06:30 alguien pulsa «Se fue» en la tarjeta. Queda
 * `salidaAt = 06:30` y `llegadaAt = null`, o sea una ventana de 7:00 a 06:30:
 * vacía. Y una ventana vacía, leída a secas, dice «no está» las 24 horas del
 * día — el residente desaparece del denominador de la ronda, su color deja de
 * esperarse cubierto y la auditoría tampoco levanta «sin actividad». Nadie lo
 * visita y nadie se entera, por un toque.
 *
 * Eso NO es «no está»: es «estas dos marcas no pueden ser las dos ciertas».
 * Son dos cosas distintas y no pueden pintarse igual.
 */
export function marcasCuadran(
    instante: Date = new Date(),
    marcas?: MarcasDeJornada | null,
): boolean {
    if (!marcas?.llegadaAt && !marcas?.salidaAt) return true;
    const desde = marcas?.llegadaAt ?? astDateTime(instante, HORARIO_DIURNO.entra, 0);
    const hasta = marcas?.salidaAt ?? astDateTime(instante, HORARIO_DIURNO.sale, 0);
    return desde < hasta;
}

/**
 * Los dos extremos de la jornada: la marca si la hay, el horario si no.
 *
 * ⚠️ `astDateTime` recibe el INSTANTE, no `fechaDeLaJornada(instante)`.
 *
 * Las dos son «la fecha de hoy» y NO son intercambiables, que es el aviso de
 * las tres anclas de CLAUDE.md:
 *
 *   · `fechaCalendarioAST()` devuelve medianoche **UTC** del día de PR
 *     (02-oct → 2026-10-02T00:00Z). Es la llave con la que se GUARDA.
 *   · `astDateTime(d, h, m)` espera una fecha cuyo **día de pared AST** sea el
 *     que se quiere: le resta 4 h para leerlo. Restarle 4 h a medianoche UTC
 *     cae en las 20:00 del día ANTERIOR.
 *
 * Escrito como `astDateTime(fechaDeLaJornada(x), 7, 0)` —que es lo natural—
 * la jornada se componía el 1 de octubre y un diurno no estaba nunca. No daba
 * error: daba `false` a mediodía.
 *
 * Y si las marcas no cuadran, **se ignoran y vale el horario**. Es la dirección
 * segura: ante un registro que no puede ser cierto, el residente sigue
 * contando para el cuidado. Quien tiene que enterarse es la pantalla, y para
 * eso está `marcasCuadran`.
 */
export function jornadaEfectiva(
    instante: Date = new Date(),
    marcas?: MarcasDeJornada | null,
): { desde: Date; hasta: Date } {
    const porHorario = {
        desde: astDateTime(instante, HORARIO_DIURNO.entra, 0),
        hasta: astDateTime(instante, HORARIO_DIURNO.sale, 0),
    };
    if (!marcasCuadran(instante, marcas)) return porHorario;
    return {
        desde: marcas?.llegadaAt ?? porHorario.desde,
        hasta: marcas?.salidaAt ?? porHorario.hasta,
    };
}

/**
 * EL `where` DE PRISMA PARA «RESIDENTES QUE ESTÁN AHORA», MARCAS INCLUIDAS.
 *
 * Sustituye a `soloLosQueEstan()` en toda consulta que pregunte por presencia.
 * Es la misma regla que `estaEnElEdificioConMarcas`, escrita en el otro idioma:
 *
 *     está ⟺ ahora >= llegada efectiva  Y  ahora < salida efectiva
 *     llegada efectiva = llegadaAt ?? las 7:00      salida efectiva = salidaAt ?? las 18:00
 *
 * ═══ POR QUÉ SON TRES CASOS Y NO DOS ═══
 *
 * La primera versión tenía dos —«dentro del horario» y «fuera»— y estaba mal.
 * «Fuera» no es una situación: son dos, y lo que falla en cada una es distinto.
 *
 *   · ANTES de las 7 falla el valor por defecto de la ENTRADA; el de la salida
 *     (18:00) sigue siendo bueno.
 *   · DESPUÉS de las 18 falla el de la SALIDA; el de la entrada sigue bueno.
 *
 * Tratarlas igual exigía marca de salida también a las 6:30 de la mañana, así
 * que quien llegaba temprano y aún no se había ido figuraba como ausente.
 * Nadie lo habría notado: solo pasa fuera del horario, que es cuando nadie
 * mira. Lo cazó `scripts/verificar-presencia-diurno.ts`.
 *
 * Los `OR: [{ campo: null }, ...]` no son defensivos: dicen «si esa marca no
 * está, vale el valor por defecto», que es la mitad de la regla.
 *
 * `esDiurno: false` sale siempre por delante — a un residente regular no le
 * aplica nada de esto.
 */
export function presenciaDeHoy(instante: Date = new Date()): Record<string, unknown> {
    const hora = horaAST(instante);
    const fecha = fechaDeLaJornada(instante);

    const antesDeAbrir = hora < HORARIO_DIURNO.entra;
    const despuesDeCerrar = hora >= HORARIO_DIURNO.sale;

    const noEsDiurno = { esDiurno: false };

    /**
     * SE DEVUELVE BAJO `AND`, NO BAJO `OR`.
     *
     * Esto se usa con spread —`{ ...otrosFiltros, ...presenciaDeHoy() }`— y un
     * `OR` de primer nivel BORRA el `OR` que el llamador ya tuviera. No da error
     * de tipos ni de Prisma: la consulta corre y devuelve mas filas de las
     * pedidas, con el filtro de negocio evaporado. Comprobado.
     *
     * `AND` es una lista, asi que aunque alguien tenga la suya se nota al
     * leerlo, y Prisma admite `AND` junto a los demas campos sin problema.
     */
    const envuelve = (alternativas: unknown[]) => ({ AND: [{ OR: alternativas }] });

    // Dentro del horario: está, SALVO que una marca diga lo contrario.
    if (!antesDeAbrir && !despuesDeCerrar) {
        return envuelve([
                noEsDiurno,
                {
                    jornadasDiurnas: {
                        none: {
                            fecha,
                            OR: [
                                { llegadaAt: { gt: instante } },   // todavía no ha llegado
                                { salidaAt: { lte: instante } },   // ya se fue
                            ],
                        },
                    },
                },
        ]);
    }

    // Antes de las 7: hace falta una llegada marcada; la salida por defecto
    // (18:00) todavía no ha pasado, así que null vale.
    if (antesDeAbrir) {
        return envuelve([
                noEsDiurno,
                {
                    jornadasDiurnas: {
                        some: {
                            fecha,
                            llegadaAt: { lte: instante },
                            OR: [{ salidaAt: null }, { salidaAt: { gt: instante } }],
                        },
                    },
                },
        ]);
    }

    // Desde las 18: hace falta una salida marcada POSTERIOR a ahora; la llegada
    // por defecto (7:00) ya pasó, así que null vale.
    return envuelve([
            noEsDiurno,
            {
                jornadasDiurnas: {
                    some: {
                        fecha,
                        salidaAt: { gt: instante },
                        OR: [{ llegadaAt: null }, { llegadaAt: { lte: instante } }],
                    },
                },
            },
    ]);
}

/**
 * ¿Está esta persona en el edificio, sabiendo sus marcas de hoy?
 *
 * La versión en memoria de `presenciaDeHoy`, para cuando ya tienes la fila
 * delante. Pasar `marcas` sin fila (undefined) da exactamente el comportamiento
 * anterior a que existieran las marcas, que es lo que se quiere por defecto.
 */
export function estaEnElEdificioConMarcas(
    residente: ModalidadResidente | null | undefined,
    instante: Date = new Date(),
    marcas?: MarcasDeJornada | null,
): boolean {
    if (!residente?.esDiurno) return true;
    const { desde, hasta } = jornadaEfectiva(instante, marcas);
    return instante >= desde && instante < hasta;
}

/**
 * ¿ESTUVO EN EL EDIFICIO EN ALGÚN MOMENTO DE ESTA VENTANA?
 *
 * La tercera forma de la misma regla, y la que necesita una AUDITORÍA. Las
 * otras dos responden «¿está ahora?»; esta responde «¿estuvo durante este
 * turno?», que no es lo mismo y da respuestas distintas.
 *
 * Por qué hizo falta: la auditoría de turno llamaba a `estaEnElEdificio(patient)`
 * sin instante, o sea con la hora de AHORA. Mientras se mire el turno que acaba
 * de cerrar, cuela. Pero la auditoría se abre cuando se abre: mirar a las 10 de
 * la mañana el turno de noche de ayer preguntaba «¿está el diurno a las 10?» —
 * sí, son las 10 de la mañana— y concluía que debió haber sido atendido entre
 * las 22:00 y las 06:00. La respuesta correcta no depende de cuándo se mire.
 *
 * ═══ POR QUÉ RECORRE LOS DÍAS Y NO LOS DOS EXTREMOS ═══
 *
 * La primera versión era `for (const ancla of [desde, hasta])`, y este mismo
 * comentario ya decía «cada día natural que toca». El comentario tenía razón y
 * el código no: con una ventana de más de un día, los días de EN MEDIO no se
 * miraban nunca.
 *
 * Medido con un barrido de 57.600 ventanas contra la verdad minuto a minuto:
 * **2.196 divergencias, todas falsos negativos** — decía «no estuvo» de alguien
 * que sí estuvo. Ninguna ventana de 24 h o menos falla; la firma del fallo es
 * la guardia nocturna: empieza entre las 18 y las 23, acaba a las 07 o antes, y
 * deja un día entero dentro.
 *
 * Y se alcanza de verdad: ningún cron cierra las sesiones de turno, y
 * `force-close` estampa `actualEndTime` a la hora que el supervisor actúe. Un
 * ponche de las 22:00 cerrado a mano dos días después deja una ventana fija de
 * 31 h, y esa auditoría decía «estaba fuera del hogar» a cualquier hora que se
 * mirase — saltándose el bloque entero de brechas: sin actividad, baño, comida,
 * medicamento omitido, úlcera sin rotaciones.
 *
 * `marcasPorFecha` se indexa por `fechaDeLaJornada(x).getTime()`. Sin marcas
 * para un día, ese día usa el horario, igual que en todas partes.
 */
export function estuvoEnElEdificioDurante(
    residente: ModalidadResidente | null | undefined,
    desde: Date,
    hasta: Date,
    marcasPorFecha?: Map<number, MarcasDeJornada> | null,
): boolean {
    if (!residente?.esDiurno) return true;
    if (!(desde < hasta)) return false;

    const UN_DIA = 24 * 60 * 60 * 1000;
    const primero = fechaDeLaJornada(desde).getTime();
    const ultimo = fechaDeLaJornada(hasta).getTime();

    for (let t = primero; t <= ultimo; t += UN_DIA) {
        /**
         * El ancla es MEDIODIA de ese dia, no su medianoche: `jornadaEfectiva`
         * llama a `astDateTime`, que lee el dia de PARED AST del instante que
         * se le pase, y la medianoche UTC de un dia de PR es las 20:00 del dia
         * anterior. Es la cuarta trampa de las anclas; a mediodia no hay forma
         * de equivocarse de dia.
         */
        const ancla = new Date(t + 12 * 60 * 60 * 1000);
        const marcas = marcasPorFecha?.get(t) ?? null;
        const jornada = jornadaEfectiva(ancla, marcas);
        // Se solapan si cada una empieza antes de que la otra acabe.
        if (jornada.desde < hasta && jornada.hasta > desde) return true;
    }
    return false;
}
