import { NextResponse } from 'next/server';
import { z } from 'zod';
import { VITALS_WINDOW_MS, PENALTY_GRACE_MS } from '@/lib/vitals-window';
import { evaluarVitales, nivelDe, aCelsius } from '@/lib/vitals-thresholds';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { logError, logWarn } from '@/lib/logger';
import { todayStartAST } from '@/lib/dates';
import { applyScoreEvent } from '@/lib/score-event';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

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
const VitalsDataSchema = z.object({
    sys:        coerceNum.int().min(60).max(250),
    dia:        coerceNum.int().min(30).max(150),
    hr:         coerceNum.int().min(25).max(250),
    temp:       coerceNum.min(30).max(115), // soporta °C o °F, validamos en runtime
    glucose:    optionalNum(coerceNum.int().min(20).max(800)),
    spo2:       optionalNum(coerceNum.int().min(50).max(100)),
    lateReason: z.string().optional(),
});

const LogDataSchema = z.object({
    foodIntake:    z.union([coerceNum.int().min(0).max(100), z.string()]).optional(),
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
            select: { id: true }
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
            const bordeCierre = new Date(Date.now() - (VITALS_WINDOW_MS + PENALTY_GRACE_MS));
            const pendingOrder = await prisma.vitalsOrder.findFirst({
                where: {
                    patientId,
                    status: { in: ['PENDING', 'EXPIRED'] },
                    completedAt: null,
                    orderedAt: { gte: bordeCierre },
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
            const { sys, dia, hr, temp } = data;
            const glucose = data.glucose ?? null;
            const spo2 = data.spo2 ?? null;

            // Temperatura ilegible: ni Celsius ni Fahrenheit plausibles. En los datos
            // de Cupey hay 86 lecturas así, entrando al expediente como válidas.
            // Se rechaza aquí para que la cuidadora la corrija en el momento.
            if (aCelsius(temp) === null) {
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

            // measuredById: SIEMPRE session.user.id (no confiamos en body)
            await prisma.vitalSigns.create({
                data: {
                    patientId,
                    measuredById: invokerId,
                    systolic: sys,
                    diastolic: dia,
                    heartRate: hr,
                    temperature: temp,
                    glucose,
                    spo2,
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

            if (isCritical) {
                // Auto-queue 45-min observation SLA
                await prisma.healthAppointment.create({
                    data: {
                        patientId,
                        type: "OBSERVATION",
                        title: "Toma de Vitales (Observación Continua)",
                        appointmentDate: new Date(Date.now() + 45 * 60 * 1000)
                    }
                });
                return NextResponse.json({
                    success: true,
                    criticalAlert: true,
                    hallazgos,
                    message: `${criticalMessage} Avisa al supervisor. Zendity colocó al residente bajo protocolo de observación: hay una revisión obligatoria en 45 minutos.`
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
                    message: `${hallazgos.map(x => x.mensaje).join(' ')} Queda anotado para el reporte de enfermería.`
                });
            }
        } else if (type === 'LOG') {
            const isClinicalAlert = data.isAlert === true;
            // Sin dato explícito va null, no 100. El default silencioso hacía
            // que cada registro de vitales afirmara que el residente comió todo.
            const foodIntakeNum = typeof data.foodIntake === 'number'
                ? data.foodIntake
                : (data.foodIntake != null ? (parseInt(String(data.foodIntake), 10) || 0) : null);
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
