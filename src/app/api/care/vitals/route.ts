import { NextResponse } from 'next/server';
import { z } from 'zod';
import { VITALS_WINDOW_MS, PENALTY_GRACE_MS } from '@/lib/vitals-window';
import { evaluarVitales, nivelDe, aCelsius, aFahrenheit } from '@/lib/vitals-thresholds';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { logError, logWarn } from '@/lib/logger';
import { todayStartAST } from '@/lib/dates';
import { applyScoreEvent } from '@/lib/score-event';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import {
    MOTIVO_OBSERVACION,
    OBSERVACION_MIN,
    abrirObservacion,
    cerrarObservacionesAbiertas,
} from '@/lib/observacion-vitales';
import { notifyRoles } from '@/lib/notifications';

// SOCIAL_WORKER lee vitales del residente (read-only). NO entra a POST.
const ALLOWED_GET_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'SOCIAL_WORKER'];

// ── Schemas Zod con rangos clínicos plausibles ──
// Acepta ints o numeric strings y los convierte a número.
const coerceNum = z.coerce.number();

// Para opcionales numéricos: trata "", null, undefined como "no enviado".
// Sin este wrapper, z.coerce.number() convierte "" → 0 y rompe min() en
// glucose/spo2 cuando la cuidadora deja el campo en blanco (no a todos los
// residentes se les toma dextro).
const optionalNum = (schema: z.ZodType<number, any, any>) =>
    z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : v),
        schema.optional(),
    ) as z.ZodType<number | undefined, any, any>;

// Rangos basados en literatura clínica geriátrica:
//   Sistólica   60–250 mmHg  (hipotensión severa hasta crisis hipertensiva)
//   Diastólica  30–150 mmHg
//   HR          25–250 bpm   (bradicardia severa hasta taquicardia)
//   Temp        30–45        (auto-detect Celsius si <45, Fahrenheit si ≥45 — ver tempF)
//   Glucosa     20–800 mg/dL
//   SpO2        50–100 %
/**
 * TODO OPCIONAL, PERO AL MENOS UNO.
 *
 * Los cuatro signos eran obligatorios, y eso decidia que se media: para anotar
 * una sola glucosa habia que llenar presion, temperatura y pulso. Medido sobre
 * 4 836 tomas de 90 dias en Cupey — presion, temperatura y pulso al 100%,
 * glucosa al 1%, con once residentes diabeticos y dos con insulina.
 *
 * Los rangos siguen siendo los mismos: lo que se manda se valida igual. Lo que
 * cambia es que no hace falta mandarlo todo.
 */
const VitalsDataSchema = z.object({
    sys:        optionalNum(coerceNum.int().min(60).max(250)),
    dia:        optionalNum(coerceNum.int().min(30).max(150)),
    hr:         optionalNum(coerceNum.int().min(25).max(250)),
    temp:       optionalNum(coerceNum.min(30).max(115)), // soporta °C o °F, validamos en runtime
    glucose:    optionalNum(coerceNum.int().min(20).max(800)),
    spo2:       optionalNum(coerceNum.int().min(50).max(100)),
    /** Peso en kilogramos. Rango generoso a proposito: un adulto puede pesar 30. */
    weight:     optionalNum(coerceNum.min(20).max(300)),
    lateReason: z.string().optional(),
});

const LogDataSchema = z.object({
    /**
     * `optionalNum`, NO `coerceNum` a secas.
     *
     * `z.coerce.number()` convierte `null` en 0, pasa el `.min(0)` y llega al
     * handler como el numero cero — el `?? null` de mas abajo ya no puede
     * verlo. Resultado medido sobre 30 dias: 162 filas diciendo "comio 0%",
     * escritas por los caminos del Action Hub que mandan `foodIntake: null`
     * a proposito para decir "este evento no dice nada sobre la comida".
     *
     * Y eso llega al portal de la familia. El mismo wrapper ya existia dos
     * lineas mas arriba por el mismo motivo en glucose y spo2.
     */
    foodIntake:    optionalNum(coerceNum.int().min(0).max(100)),
    bathCompleted: z.boolean().optional(),
    notes:         z.string().max(2000).optional().nullable(),
    isAlert:       z.boolean().optional(),
});

const VitalsPostBody = z.discriminatedUnion('type', [
    z.object({ patientId: z.string().min(1), type: z.literal('VITALS'), data: VitalsDataSchema }),
    z.object({ patientId: z.string().min(1), type: z.literal('LOG'),    data: LogDataSchema }),
]);

// PHI audit (Pilar 1) — lectura de vitales del residente.
export const GET = withPhiAccessLog(getVitalsHandler, {
    resourceType: 'VitalSigns',
    getPatientId: ({ req }) => new URL(req.url).searchParams.get('patientId') ?? undefined,
});

async function getVitalsHandler(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_GET_ROLES);
        if (auth instanceof NextResponse) return auth;

        // Respeta el switcher de sede para directores multi-HQ
        const session = await getServerSession(authOptions);
        const requestedHqId = new URL(req.url).searchParams.get('hqId');
        const hqId = await resolveEffectiveHqId(session!, requestedHqId);

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');

        if (patientId) {
            // MODO B — Historial por residente
            const from = searchParams.get('from');
            const to = searchParams.get('to');
            const dateFrom = from ? new Date(from + 'T00:00:00') : new Date(Date.now() - 7 * 86400000);
            const dateTo = to ? new Date(to + 'T23:59:59.999') : new Date();

            const vitals = await prisma.vitalSigns.findMany({
                where: {
                    patientId,
                    patient: { headquartersId: hqId },
                    createdAt: { gte: dateFrom, lte: dateTo }
                },
                include: {
                    patient: { select: { id: true, name: true, colorGroup: true, roomNumber: true } },
                    measuredBy: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            return NextResponse.json({ success: true, vitals });
        } else {
            // MODO A — Vitales del dia
            const dateParam = searchParams.get('date');
            let startOfDay: Date;
            let endOfDay: Date;
            if (dateParam) {
                const targetDate = new Date(dateParam + 'T00:00:00');
                startOfDay = new Date(targetDate);
                startOfDay.setHours(0, 0, 0, 0);
                endOfDay = new Date(targetDate);
                endOfDay.setHours(23, 59, 59, 999);
            } else {
                // Sin param: ventana rodante de 24h (AST-safe)
                startOfDay = todayStartAST();
                endOfDay = new Date();
            }

            const vitals = await prisma.vitalSigns.findMany({
                where: {
                    patient: { headquartersId: hqId },
                    createdAt: { gte: startOfDay, lte: endOfDay }
                },
                include: {
                    patient: { select: { id: true, name: true, colorGroup: true, roomNumber: true } },
                    measuredBy: { select: { name: true } }
                },
                orderBy: [
                    { patient: { colorGroup: 'asc' } },
                    { patient: { name: 'asc' } },
                    { createdAt: 'desc' }
                ]
            });

            // Residentes activos para mostrar los que no tienen vitales hoy
            const activePatients = await prisma.patient.findMany({
                where: { headquartersId: hqId, status: 'ACTIVE' },
                select: { id: true, name: true, colorGroup: true, roomNumber: true },
                orderBy: [{ colorGroup: 'asc' }, { name: 'asc' }]
            });

            return NextResponse.json({ success: true, vitals, activePatients });
        }
    } catch (error: any) {
        logError('care.vitals.get', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

const ALLOWED_POST_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_POST_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: invokerHqId } = auth;

        const rawBody = await req.json().catch(() => null);
        const parsed = VitalsPostBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { patientId, type, data } = parsed.data;

        // Tenant check: el paciente debe estar en la sede del invocador
        const patientCheck = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            // El nombre se PIDE aquí porque se usa abajo en el aviso a
            // supervisión. Un campo que no está en el select vuelve null en
            // todas las filas y se lee igual que "no tiene" — regla 9.
            select: { id: true, name: true }
        });
        if (!patientCheck) {
            return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede" }, { status: 404 });
        }

        if (type === 'VITALS') {

            // Buscamos la orden abierta del residente para cerrarla con esta toma.
            //
            // Antes esto miraba SOLO status PENDING, y el cron de vitals-reminder
            // marca EXPIRED a los 5 minutos de vencer. Resultado: si el cuidador
            // tomaba los vitales un rato tarde, la orden ya era EXPIRED, no la
            // encontraba nadie, y quedaba con completedAt en null — es decir,
            // penalizada. Medido en Cupey el 19-ago-2026: de 1,500 órdenes
            // vencidas sin completar, 384 (26%) SÍ tenían los vitales tomados en
            // ventana. El cuidador hizo el trabajo y el sistema lo contó como
            // incumplimiento, las 384 veces.
            //
            // Ahora también cerramos las EXPIRED recientes. Se acota a la ventana
            // más la gracia para no cerrar una orden de anteayer con la toma de hoy.
            //
            // Y NO entran aquí las revisiones de observación de 45 min. Esas
            // son otra obligación, con otro plazo, y se cierran aparte más
            // abajo — sin justificación de 20 caracteres y sin penalidad. Si
            // cayeran en esta rama, una revisión registrada a los 50 minutos
            // quedaría BLOQUEADA hasta que la cuidadora escribiera un párrafo,
            // justo sobre el residente que el sistema marcó como crítico.
            // Ver src/lib/observacion-vitales.ts.
            const bordeCierre = new Date(Date.now() - (VITALS_WINDOW_MS + PENALTY_GRACE_MS));
            const pendingOrder = await prisma.vitalsOrder.findFirst({
                where: {
                    patientId,
                    status: { in: ['PENDING', 'EXPIRED'] },
                    completedAt: null,
                    orderedAt: { gte: bordeCierre },
                    reason: { not: MOTIVO_OBSERVACION },
                },
                orderBy: { orderedAt: 'desc' },
                select: { id: true, expiresAt: true, status: true }
            });

            let orderStatusUpdate: 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | null = null;
            let applyLatePenalty = false;
            const lateReasonRaw = (data.lateReason ?? '').trim();

            if (pendingOrder) {
                const isLate = new Date() > pendingOrder.expiresAt;
                if (!isLate) {
                    orderStatusUpdate = 'COMPLETED_ON_TIME';
                } else if (pendingOrder.status === 'PENDING') {
                    // Llegó tarde pero el cron todavía no la había vencido:
                    // se mantiene la regla que ya existía — justificar y −2.
                    if (lateReasonRaw.length < 20) {
                        return NextResponse.json({
                            success: false,
                            requireLateReason: true,
                            error: "La orden venció. Justifica el retraso (mínimo 20 caracteres)."
                        }, { status: 400 });
                    }
                    orderStatusUpdate = 'COMPLETED_LATE';
                    applyLatePenalty = true;
                } else {
                    // Ya estaba EXPIRED. Antes esta toma se perdía y la orden
                    // quedaba penalizada. Ahora se registra como tardía, pero NO
                    // se penaliza dos veces ni se bloquea al cuidador por escribir
                    // una justificación: lo que importa es que los vitales entren
                    // al expediente y que la orden deje de contar como no hecha.
                    orderStatusUpdate = 'COMPLETED_LATE';
                    applyLatePenalty = false;
                }
            }

            // Datos ya validados y coercionados a number por Zod
            const sys = data.sys ?? null;
            const dia = data.dia ?? null;
            const hr = data.hr ?? null;
            const temp = data.temp ?? null;
            const glucose = data.glucose ?? null;
            const spo2 = data.spo2 ?? null;
            const weight = data.weight ?? null;

            /**
             * AL MENOS UNA. Ya no hace falta llenarlo todo, pero una toma vacia
             * no es una toma: seria una fila que dice que alguien paso por ahi.
             */
            if ([sys, dia, hr, temp, glucose, spo2, weight].every(v => v === null)) {
                return NextResponse.json({
                    success: false,
                    error: 'Registra al menos una medida.',
                }, { status: 400 });
            }

            /**
             * La presion se toma con las dos cifras o con ninguna. Una sistolica
             * sola no es una presion arterial, y guardarla dejaria el expediente
             * con media medida que despues nadie sabe leer.
             */
            if ((sys === null) !== (dia === null)) {
                return NextResponse.json({
                    success: false,
                    error: 'La presión necesita las dos cifras: sistólica y diastólica.',
                }, { status: 400 });
            }

            // Temperatura ilegible: ni Celsius ni Fahrenheit plausibles. En los datos
            // de Cupey hay 86 lecturas así, entrando al expediente como válidas.
            // Se rechaza aquí para que la cuidadora la corrija en el momento.
            if (temp !== null && aCelsius(temp) === null) {
                return NextResponse.json({
                    success: false,
                    error: `Temperatura fuera de rango (${temp}). Revisa el valor y vuelve a registrarlo.`
                }, { status: 400 });
            }

            // Umbrales aprobados por la enfermera del hogar — ver
            // src/lib/vitals-thresholds.ts. Antes esta evaluación vivía aquí
            // inline con valores que nadie había decidido: `sys > 140 || dia > 90`
            // marcaba como crisis hipertensiva la presión que se le espera a un
            // adulto mayor, y no había nada para hipotermia, pulso ni diastólica.
            const hallazgos = evaluarVitales({ systolic: sys, diastolic: dia, heartRate: hr, temperature: temp, spo2 });
            const nivel = nivelDe(hallazgos);
            const isCritical = nivel === 'LLAMAR';
            const criticalMessage = hallazgos.filter(x => x.nivel === 'LLAMAR').map(x => x.mensaje).join(' ');

            /**
             * Guarda contra doble envio — misma que /adls/bath.
             *
             * Medido el 30-ago-2026: 30 tomas duplicadas de 5 483. Pocas, pero
             * en vitales un duplicado no es solo ruido: dos lecturas identicas
             * seguidas pueden leerse como "se confirmo el valor", cuando lo que
             * hubo fue un solo aparato y un boton pulsado dos veces.
             *
             * Se comparan los valores: volver a tomar vitales al mismo residente
             * porque salieron alterados es legitimo y da numeros DISTINTOS. Lo
             * que se bloquea es la lectura identica.
             */
            const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
            // Solo aplica a una toma que TRAE los tres valores: con signos
            // nulables, comparar null con null marcaria como duplicada una
            // glucosa de la manana y otra de la tarde.
            const puedeCompararse = sys !== null && dia !== null && hr !== null;
            const tomaReciente = puedeCompararse ? await prisma.vitalSigns.findFirst({
                where: {
                    patientId,
                    createdAt: { gte: dosMinutosAtras },
                    systolic: sys, diastolic: dia, heartRate: hr,
                },
                select: { id: true },
            }) : null;
            if (tomaReciente) {
                /**
                 * PERO SI ESA LECTURA ERA CRÍTICA, EL REINTENTO NO PUEDE SALIR
                 * EN BLANCO.
                 *
                 * El caso real: el POST escribe la fila de VitalSigns y falla o
                 * se corta ANTES de abrir la revisión y avisar a supervisión
                 * —son varios round-trips más—. La tableta cae en su `catch`,
                 * que no enseñaba nada, y la cuidadora vuelve a pulsar Guardar.
                 * El reintento entraba por aquí y devolvía «ya estaban
                 * registrados»: sin alerta, sin revisión de 45 minutos y sin
                 * aviso a nadie. Una lectura crítica desaparecida por haber
                 * pulsado dos veces.
                 *
                 * `abrirObservacion` no duplica —devuelve la que ya exista— así
                 * que repetir esto es seguro.
                 */
                if (isCritical) {
                    const obsDup = await abrirObservacion(prisma, {
                        patientId, headquartersId: invokerHqId, invokerId, ahora: new Date(),
                    });
                    const horaLimiteDup = obsDup.expiresAt.toLocaleTimeString('es-ES', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico',
                    });
                    const avisadosDup = obsDup.yaEstaba ? -1 : await notifyRoles(
                        invokerHqId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                            type: 'EMAR_ALERT',
                            title: `Vitales fuera de rango — ${(patientCheck.name || '').trim()}`,
                            message: `En protocolo de observación. La revisión vence a las ${horaLimiteDup}.`
                                + ` Lo registró ${auth.name ?? 'personal'}.`,
                            link: '/care/supervisor',
                        }, invokerId);
                    return NextResponse.json({
                        success: true,
                        duplicada: true,
                        criticalAlert: true,
                        hallazgos,
                        hallazgoTexto: criticalMessage,
                        message: `${criticalMessage} Esta lectura ya estaba registrada.`
                            + ` La revisión obligatoria vence a las ${horaLimiteDup}.`,
                    });
                }
                return NextResponse.json({
                    success: true,
                    duplicada: true,
                    message: 'Estos vitales ya estaban registrados hace un momento.',
                });
            }

            // measuredById: SIEMPRE session.user.id (no confiamos en body)
            await prisma.vitalSigns.create({
                data: {
                    patientId,
                    measuredById: invokerId,
                    systolic: sys,
                    diastolic: dia,
                    heartRate: hr,
                    // SE GUARDA EN FAHRENHEIT, venga como venga.
                    //
                    // Hasta el 08-sep-2026 aquí se guardaba `temp` crudo. La
                    // cuidadora escribía 36.4 (Celsius, lo que marcaba el
                    // aparato), la pantalla le confirmaba "36.4 °C → 97.5 °F",
                    // y la base guardaba 36.4. 1,751 de 5,994 lecturas (29%)
                    // quedaron así, y todo lector que asumía Fahrenheit las
                    // leyó mal — incluido el documento que va al hospital.
                    temperature: aFahrenheit(temp),
                    glucose,
                    spo2,
                    weight,
                }
            });

            // Cerrar orden pendiente (on-time o late) y aplicar penalidad si aplica
            if (pendingOrder && orderStatusUpdate) {
                await prisma.vitalsOrder.update({
                    where: { id: pendingOrder.id },
                    data: {
                        status: orderStatusUpdate,
                        completedAt: new Date(),
                        lateReason: lateReasonRaw.length > 0
                            ? lateReasonRaw
                            : (orderStatusUpdate === 'COMPLETED_LATE' ? 'Tomados fuera de plazo' : null),
                    }
                });
                if (applyLatePenalty) {
                    await applyScoreEvent(invokerId, invokerHqId, -2,
                        'Vitales registrados tarde', 'VITALS');
                }
            }

            /**
             * ESTA TOMA CIERRA LA REVISIÓN QUE HUBIERA ABIERTA.
             *
             * Va ANTES de abrir la nueva, para no cerrar la que se acaba de
             * crear. Y va fuera del `if (isCritical)` a propósito: unos vitales
             * normales también son la revisión — de hecho son el mejor
             * desenlace posible de una.
             */
            const revision = await cerrarObservacionesAbiertas(prisma, {
                patientId,
                ahora: new Date(),
                // Los cinco que mira `evaluarVitales`. Peso y glucosa no
                // cierran una revisión porque no la pueden contestar.
                tieneSignosEvaluables: [sys, dia, hr, temp, spo2].some(v => v !== null),
            });

            if (isCritical) {
                /**
                 * LA REVISIÓN DE 45 MINUTOS, AHORA CON QUIEN LA VIGILE.
                 *
                 * Hasta el 22-sep-2026 esto escribía una fila en
                 * `HealthAppointment` que no leía nadie: 578 creadas, 0
                 * cerradas, 46 revisadas a tiempo (8 %). Ver
                 * src/lib/observacion-vitales.ts para la medición completa.
                 */
                const obs = await abrirObservacion(prisma, {
                    patientId,
                    headquartersId: invokerHqId,
                    invokerId,
                    ahora: new Date(),
                });
                const horaLimite = obs.expiresAt.toLocaleTimeString('es-ES', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico',
                });

                /**
                 * Y SUPERVISIÓN SE ENTERA SOLA.
                 *
                 * Antes el sistema detectaba el valor crítico y le pedía a la
                 * cuidadora que fuera a buscar a alguien: no salía un solo
                 * aviso de esta ruta. Si no hay nadie en el pasillo, la alerta
                 * se queda en la tableta.
                 *
                 * El cuerpo no lleva cifras ni hallazgo clínico — regla 7. Dice
                 * qué pasó y a qué hora vence; el detalle está en el expediente,
                 * detrás de la sesión.
                 */
                const avisados = await notifyRoles(invokerHqId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                    type: 'EMAR_ALERT',
                    title: `Vitales fuera de rango — ${(patientCheck.name || '').trim()}`,
                    message: `En protocolo de observación. La revisión vence a las ${horaLimite}.`
                        + ` Lo registró ${auth.name ?? 'personal'}.`,
                    link: '/care/supervisor',
                }, invokerId);

                /**
                 * SE DICE LO QUE DE VERDAD PASÓ CON EL AVISO.
                 *
                 * `notifyRoles` devuelve a cuánta gente llegó, y devuelve 0
                 * también cuando falla. Escribir "avisé a supervisión" sin
                 * mirar ese número sería cambiar una mentira por otra: si no
                 * hay ninguna cuenta de supervisión o enfermería activa en la
                 * sede, nadie se enteró, y quien tiene la tableta delante es la
                 * única que puede ir a buscar a alguien. Hay que decírselo.
                 */
                const quienSabe = avisados > 0
                    ? `El aviso salió a ${avisados} persona${avisados === 1 ? '' : 's'} entre supervisión, enfermería y dirección.`
                    : 'OJO: el aviso no le llegó a nadie — ve a buscar a supervisión tú.';

                return NextResponse.json({
                    success: true,
                    criticalAlert: true,
                    hallazgos,
                    avisados,
                    /**
                     * El texto CLÍNICO, aparte del operativo. La tableta lo
                     * usa para precargar la nota del expediente: ahí va el
                     * hallazgo, no a cuánta gente le llegó una notificación.
                     */
                    hallazgoTexto: criticalMessage,
                    revisionCerrada: revision.cerradas > 0,
                    message: `${criticalMessage} ${quienSabe} Queda una revisión obligatoria antes de las ${horaLimite}`
                        + ` — te aparece en la tarjeta del residente con la cuenta atrás.`
                });
            }

            // Nivel ANOTAR: se le pasa a la enfermera en el reporte, sin
            // interrumpir el turno ni agendar revisión. Es la mitad del diseño
            // de dos niveles que ella aprobó, y lo que evita que el sistema
            // grite por todo hasta que nadie lo escuche.
            if (nivel === 'ANOTAR') {
                return NextResponse.json({
                    success: true,
                    criticalAlert: false,
                    aviso: true,
                    hallazgos,
                    revisionCerrada: revision.cerradas > 0,
                    message: `${hallazgos.map(x => x.mensaje).join(' ')} Queda anotado para el reporte de enfermería.`
                        + (revision.cerradas > 0 ? ' Con esto queda cerrada la revisión de observación.' : '')
                });
            }

            /**
             * Y SI ESTA TOMA CERRÓ UNA REVISIÓN, SE LE DICE.
             *
             * Es la mitad que faltaba de la promesa: la tableta le anunció a
             * alguien que había una revisión obligatoria, y hasta hoy nadie le
             * decía nunca que se había cumplido. Un reloj que empieza delante
             * de ti y no para nunca deja de ser un reloj.
             */
            /**
             * LA CONFIRMACIÓN INMEDIATA NO CIERRA NADA, Y HAY QUE DECIRLO.
             *
             * Dos mensajes de LLAMAR piden volver a medir en el momento
             * («Confírmala por vía axilar», «Confirma con la mano tibia») y la
             * cuidadora lo hace: 33 de los 578 disparos tuvieron su segunda
             * toma en menos de DOS minutos. Si esa toma cerrara la revisión, el
             * protocolo quedaría cumplido a los 20 segundos de abrirse. No la
             * cierra — y quien está delante tiene que saber que el reloj sigue.
             */
            if (revision.confirmacionTemprana) {
                return NextResponse.json({
                    success: true,
                    criticalAlert: false,
                    confirmacionTemprana: true,
                    message: 'Registrado. Esta confirmación no cierra la revisión de observación:'
                        + ` hay que volver a tomarle los vitales más adelante.`,
                });
            }

            if (revision.cerradas > 0) {
                return NextResponse.json({
                    success: true,
                    criticalAlert: false,
                    revisionCerrada: true,
                    message: revision.huboTarde
                        ? `Registrado. Queda cerrada la revisión de observación — pasaron más de ${OBSERVACION_MIN} minutos, y queda anotado tal cual.`
                        : 'Registrado. Queda cerrada la revisión de observación, dentro del plazo.',
                });
            }
        } else if (type === 'LOG') {
            const isClinicalAlert = data.isAlert === true;
            // Sin dato explícito va null, no 100. El default silencioso hacía
            // que cada registro de vitales afirmara que el residente comió todo.
            const foodIntakeNum = typeof data.foodIntake === 'number'
                ? data.foodIntake
                : (data.foodIntake != null ? (parseInt(String(data.foodIntake), 10) || 0) : null);
            /**
             * Guarda contra doble envio — ultima ruta de creacion que quedaba
             * sin ella, y volvio a morder: 01-sep-2026, dos alertas identicas de
             * Maria M. Melendez con DOS SEGUNDOS de diferencia, misma autora,
             * mismo texto.
             *
             * Aqui NO es falta de señal: el hub si avisa al guardar. Es doble
             * toque, o un reintento sobre una respuesta lenta. Por eso la guarda
             * va en el servidor, que es el unico sitio donde se puede parar.
             *
             * Se compara el TEXTO ademas del residente: dos notas distintas
             * seguidas son trabajo real —una alerta y luego una observacion—;
             * la misma nota dos veces no.
             */
            const notasNuevas = data.notes ?? null;
            const yaRegistrada = await prisma.dailyLog.findFirst({
                where: {
                    patientId,
                    authorId: invokerId,
                    notes: notasNuevas,
                    createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
                },
                select: { id: true },
            });
            if (yaRegistrada) {
                // Exito, no error: quien reporta hizo lo correcto, y un rojo la
                // haria repetirlo — que es lo que produce el duplicado.
                return NextResponse.json({
                    success: true,
                    duplicada: true,
                    logId: yaRegistrada.id,
                    message: 'Ese reporte ya estaba registrado hace un momento. No se duplicó.',
                });
            }

            const dailyLog = await prisma.dailyLog.create({
                data: {
                    patientId,
                    authorId: invokerId,
                    foodIntake: foodIntakeNum,
                    bathCompleted: data.bathCompleted === true,
                    notes: data.notes ?? null,
                    isClinicalAlert,
                }
            });

            // Auto-crear TriageTicket para alertas clínicas/UPP
            if (isClinicalAlert) {
                const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { headquartersId: true, name: true } });
                if (patient) {
                    await prisma.triageTicket.create({
                        data: {
                            headquartersId: patient.headquartersId,
                            patientId,
                            originType: 'DAILY_LOG',
                            originReferenceId: dailyLog.id,
                            priority: 'HIGH',
                            status: 'OPEN',
                            description: data.notes || 'Alerta clínica sin descripción',
                        }
                    });

                    // Notificar a SUPERVISOR/NURSE/DIRECTOR de la sede
                // Recorte de ruido (17-ago-2026): el ticket nuevo ya NO genera
                // campana — el badge del inbox operativo (inbox-count, sidebar)
                // ya lo anuncia y persiste hasta atenderse. La campana queda
                // reservada para la escalación por SLA, que sí es urgente.
                }
            }
        }

        return NextResponse.json({ success: true, message: `Registro ${type} guardado con éxito en PAI` });

    } catch (error: any) {
        logError('care.vitals.post', error);
        return NextResponse.json({ success: false, error: `DB Error: ${error.message || String(error)}` }, { status: 500 });
    }
}
