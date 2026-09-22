/**
 * EL PROTOCOLO DE OBSERVACIÓN DE 45 MINUTOS.
 *
 * ═══ LO QUE ESTABA PASANDO ═══
 *
 * Cuando unos vitales cruzan el umbral LLAMAR (ver vitals-thresholds.ts), la
 * tableta le dice a la cuidadora, con estas palabras:
 *
 *     «Zendity colocó al residente bajo protocolo de observación: hay una
 *      revisión obligatoria en 45 minutos.»
 *
 * Y hasta el 22-sep-2026 lo único que ocurría detrás de esa frase era una fila
 * en `HealthAppointment` con `type: 'OBSERVATION'`. Medido ese día sobre las
 * 578 que existían:
 *
 *   · resueltas .......................  0  — el campo `resolved` no lo escribe nadie
 *   · revisadas dentro de los 45 min ..  46 (8,0 %)
 *   · revisadas más tarde ............. 524 — casi todas, la ronda del día siguiente
 *   · nunca revisadas .................   8
 *
 * El único lector era `/api/care/briefing`, que a la mañana SIGUIENTE anunciaba
 * «hay una OBSERVATION programada» —en inglés, y de una revisión cuyo plazo
 * había vencido hacía horas—. Nadie recibía aviso, no salía en ninguna pantalla,
 * y no había forma de cerrarla.
 *
 * A las 18:11 de ese día había tres vencidas y sin revisar: 171, 75 y 71
 * minutos. Dos de ellas se habían disparado por FC 48 y una por 94.1 °F.
 *
 * ═══ POR QUÉ `VitalsOrder` Y NO UNA TABLA NUEVA ═══
 *
 * Porque el circuito ya existe entero y se usa. `VitalsOrder` ya tiene plazo,
 * recordatorio 20 min antes (cron `vitals-reminder`, cada 15 min vía
 * `dispatch-frequent`), vencimiento automático, cierre al registrar los
 * vitales, cuenta atrás en la tarjeta del residente y presencia en el panel del
 * supervisor. Una revisión de vitales a plazo ES una orden de vitales.
 *
 * Construir lo necesario, no de más: lo que faltaba no era un modelo, era
 * enchufar la promesa al mecanismo que ya la sabe cumplir.
 *
 * ═══ LAS TRES COSAS QUE HAY QUE VIGILAR AL REUSARLO ═══
 *
 * 1. NO SE PENALIZA. El bloque de penalidad del cron filtra `autoCreated: true`
 *    y estas órdenes se crean con `false`, así que quedan fuera por
 *    construcción. Y en la ruta de vitales se exime explícitamente de la
 *    justificación de 20 caracteres: bloquear el registro de una revisión
 *    —de alguien que está en observación justamente por estar mal— hasta que
 *    la cuidadora escriba un párrafo sería el peor sitio posible para cobrar
 *    un plazo. Veracidad, no puntuación.
 *
 * 2. SOBREVIVE AL CIERRE DE TURNO. El barrido de `shift/end` filtra
 *    `autoCreated: true` Y `shiftSessionId`; esta orden lleva `false` y `null`,
 *    así que no la barre. Es deliberado: la revisión no es de un turno, es del
 *    residente, y si el turno cierra a los 20 minutos la obligación pasa a
 *    quien entra.
 *
 * 3. NO TAPA LA VENTANA DE ENTRADA. `shift/start` evitaba duplicados mirando
 *    cualquier orden PENDING del residente; con una observación abierta, el
 *    turno entrante se habría quedado SIN su ventana de vitales de entrada.
 *    Ese dedup ahora filtra `autoCreated: true`.
 *
 * La identidad de estas órdenes es el `reason` exacto. No hay ninguna ruta en
 * el repo que deje escribir un `reason` libre —solo `shift/start` y
 * `claim-coverage` crean órdenes, las dos con texto fijo— así que la cadena es
 * una marca fiable, y además se lee bien en la tarjeta.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

/** El plazo que la tableta le promete a la cuidadora, en minutos. */
export const OBSERVACION_MIN = 45;

/**
 * La marca. Es a la vez identidad en las consultas y texto visible en la
 * tarjeta del residente, así que se escribe para leerse en el piso.
 */
export const MOTIVO_OBSERVACION = `Revisión de observación (${OBSERVACION_MIN} min)`;

export function esOrdenDeObservacion(reason: string | null | undefined): boolean {
    return reason === MOTIVO_OBSERVACION;
}

/**
 * LA CONFIRMACIÓN INMEDIATA NO ES LA REVISIÓN.
 *
 * Dos de los mensajes de LLAMAR piden explícitamente volver a medir AHORA:
 *
 *   «Temperatura baja — 94.1. Confírmala por vía axilar antes de escalar…»
 *   «Oxígeno bajo — 78%. Confirma con la mano tibia.»
 *
 * Y la cuidadora lo hace. Medido el 22-sep-2026 sobre los 578 disparos
 * históricos, mirando la PRIMERA toma con alguno de los cinco signos
 * evaluables después del disparo:
 *
 *   ≤ 2 min ....  33   (17 s, 18 s, 21 s, 23 s, 36 s, 119 s…)
 *   2–5 min ...    6
 *   5–10 min ..    1
 *   10–20 min .    2
 *   20–45 min .    4   ← la revisión de verdad
 *   > 45 min ..  524
 *   nunca .....    8
 *
 * Sin esta cota, esas 39 confirmaciones cerrarían la revisión de 45 minutos
 * como `COMPLETED_ON_TIME` a los segundos de abrirla: el protocolo derrotado
 * por el acto que el propio protocolo pide, y con un 100 % de cumplimiento de
 * regalo. Es la métrica que no puede moverse, otra vez.
 *
 * 10 minutos deja fuera las 39 y conserva las 6 tomas de 10–45 min. Por debajo
 * de 10 minutos no hay reevaluación clínica posible: es la misma toma.
 */
export const MINIMO_PARA_QUE_CUENTE_MS = 10 * 60 * 1000;

/**
 * Y PASADO UN TURNO, TAMPOCO ES LA REVISIÓN.
 *
 * Sin cota superior, la ronda rutinaria de la mañana siguiente cerraba la
 * revisión de ayer como `COMPLETED_LATE` y escribía en el expediente
 * «registrada fuera del plazo de 45 min» — una afirmación de que esa toma
 * contestó a aquel evento, que no la hizo nadie. De los 578 disparos, 524
 * tuvieron su siguiente toma a más de 45 minutos, con una mediana de casi
 * 18 horas: o sea que era el caso NORMAL, no el raro.
 *
 * Pasado este plazo la orden se queda EXPIRED con `completedAt` en null, que
 * es el dato verdadero: no se hizo.
 *
 * OJO — 8 h (un turno) es un valor DEFENDIBLE, no una decisión clínica
 * tomada. La revisión pertenece al turno en que nació y al que recibe el
 * relevo. Si Celia prefiere otra escala, se cambia aquí y en ningún sitio más.
 */
export const VENTANA_CIERRE_MS = 8 * 60 * 60 * 1000;

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * ABRE LA REVISIÓN.
 *
 * Guarda contra doble envío como todas las escrituras del proyecto: si ya hay
 * una revisión abierta para este residente, se devuelve ESA. Nunca dos relojes
 * sobre la misma persona.
 *
 * No hace falta ventana de tiempo aquí —basta con que esté PENDING—: la segunda
 * toma de unos vitales que salieron alterados es legítima y da valores
 * distintos, pero antes de llegar aquí ya habrá cerrado la revisión anterior
 * (ver `cerrarObservacionesAbiertas`), que es lo correcto: esa toma ERA la
 * revisión.
 */
export async function abrirObservacion(db: Db, params: {
    patientId: string;
    headquartersId: string;
    /** Quien tomó los vitales que dispararon el protocolo. */
    invokerId: string;
    ahora: Date;
}): Promise<{ id: string; expiresAt: Date; yaEstaba: boolean }> {
    const { patientId, headquartersId, invokerId, ahora } = params;

    const abierta = await db.vitalsOrder.findFirst({
        where: { patientId, status: 'PENDING', reason: MOTIVO_OBSERVACION },
        select: { id: true, expiresAt: true },
        orderBy: { orderedAt: 'desc' },
    });
    if (abierta) return { ...abierta, yaEstaba: true };

    const expiresAt = new Date(ahora.getTime() + OBSERVACION_MIN * 60 * 1000);
    const creada = await db.vitalsOrder.create({
        data: {
            headquartersId,
            patientId,
            orderedById: invokerId,
            // Se le asigna a quien tomó los vitales: es quien está delante del
            // residente ahora mismo. Si su turno cierra antes de los 45 min, la
            // orden sigue abierta y visible para quien entra — el cron avisa
            // por rol cuando vence, no solo a esta persona.
            caregiverId: invokerId,
            reason: MOTIVO_OBSERVACION,
            orderedAt: ahora,
            expiresAt,
            status: 'PENDING',
            // Las dos banderas que mantienen esta orden fuera del castigo y
            // fuera del barrido de cierre de turno. Ver cabecera.
            autoCreated: false,
            shiftSessionId: null,
            penaltyApplied: false,
        },
        select: { id: true, expiresAt: true },
    });
    return { ...creada, yaEstaba: false };
}

/**
 * CIERRA LA REVISIÓN CON UNOS VITALES.
 *
 * Cualquier toma de vitales posterior a la orden ES la revisión: no hay otro
 * acto que la cumpla. Se cierran TODAS las abiertas del residente, no la más
 * reciente, porque dos relojes sobre la misma persona sería un fallo del que
 * conviene salir solo.
 *
 * Tarde también cierra. Una revisión a los 70 minutos es una revisión que
 * ocurrió: el dato queda verdadero —`COMPLETED_LATE`, con su hora— y lo que no
 * hay es penalidad.
 */
export async function cerrarObservacionesAbiertas(db: Db, params: {
    patientId: string;
    ahora: Date;
    /**
     * ¿La toma trae alguno de los cinco signos que se evalúan?
     *
     * Una entrada de SOLO peso o SOLO glucosa no es la revisión: ninguno de
     * los dos pasa por `evaluarVitales`, así que no puede desmentir ni
     * confirmar lo que disparó el protocolo. Cerrar con eso sería un examen
     * aprobado sin leerlo.
     *
     * Medido el 22-sep-2026: de 3.510 tomas en 60 días, CERO llegan sin
     * ninguno de los cinco. O sea que hoy esta guarda no cambia nada — está
     * porque la API sí lo permite (basta "al menos una medida" de las siete),
     * y el día que pase, lo que se pierde es una revisión clínica.
     */
    tieneSignosEvaluables: boolean;
}): Promise<{ cerradas: number; huboTarde: boolean; confirmacionTemprana: boolean }> {
    const { patientId, ahora, tieneSignosEvaluables } = params;
    const nada = { cerradas: 0, huboTarde: false, confirmacionTemprana: false };
    if (!tieneSignosEvaluables) return nada;

    const base = {
        patientId,
        reason: MOTIVO_OBSERVACION,
        status: { in: ['PENDING', 'EXPIRED'] as ('PENDING' | 'EXPIRED')[] },
        completedAt: null,
    };

    const abiertas = await db.vitalsOrder.findMany({
        where: {
            ...base,
            orderedAt: {
                // Ni la confirmación de hace 20 segundos…
                lte: new Date(ahora.getTime() - MINIMO_PARA_QUE_CUENTE_MS),
                // …ni la ronda de mañana. Ver las dos constantes arriba.
                gte: new Date(ahora.getTime() - VENTANA_CIERRE_MS),
            },
        },
        select: { id: true, expiresAt: true },
    });

    if (abiertas.length === 0) {
        /**
         * ¿No cerró nada porque no había, o porque la toma llegó demasiado
         * pronto? No es lo mismo, y quien está delante merece saberlo: si
         * acaba de confirmar una lectura, el reloj de los 45 minutos SIGUE
         * corriendo y tiene que volver.
         */
        const temprana = await db.vitalsOrder.findFirst({
            where: { ...base, orderedAt: { gt: new Date(ahora.getTime() - MINIMO_PARA_QUE_CUENTE_MS) } },
            select: { id: true },
        });
        return { ...nada, confirmacionTemprana: !!temprana };
    }

    const aTiempo = abiertas.filter(o => ahora <= o.expiresAt).map(o => o.id);
    const tarde = abiertas.filter(o => ahora > o.expiresAt).map(o => o.id);

    if (aTiempo.length > 0) {
        await db.vitalsOrder.updateMany({
            where: { id: { in: aTiempo } },
            data: { status: 'COMPLETED_ON_TIME', completedAt: ahora },
        });
    }
    if (tarde.length > 0) {
        await db.vitalsOrder.updateMany({
            where: { id: { in: tarde } },
            data: {
                status: 'COMPLETED_LATE',
                completedAt: ahora,
                lateReason: 'Revisión de observación registrada fuera del plazo de 45 min',
            },
        });
    }
    return { cerradas: abiertas.length, huboTarde: tarde.length > 0, confirmacionTemprana: false };
}
