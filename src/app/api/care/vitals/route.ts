import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import { applyScoreEvent } from '@/lib/score-event';

// ── Schemas Zod con rangos clínicos plausibles ──
// Acepta ints o numeric strings y los convierte a número.
const coerceNum = z.coerce.number();

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
    glucose:    coerceNum.int().min(20).max(800).optional().nullable(),
    spo2:       coerceNum.int().min(50).max(100).optional().nullable(),
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

export async function GET(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;
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
        console.error("Care Vitals GET Error:", error);
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

            // Ventana de orden a petición: si hay una VitalsOrder PENDING para este residente
            // y su expiresAt ya pasó, exigimos lateReason (>=20 chars) y aplicamos -2 al complianceScore.
            const pendingOrder = await prisma.vitalsOrder.findFirst({
                where: { patientId, status: 'PENDING' },
                orderBy: { orderedAt: 'desc' },
                select: { id: true, expiresAt: true }
            });

            let orderStatusUpdate: 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | null = null;
            let applyLatePenalty = false;
            const lateReasonRaw = (data.lateReason ?? '').trim();

            if (pendingOrder) {
                const isLate = new Date() > pendingOrder.expiresAt;
                if (isLate) {
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
                    orderStatusUpdate = 'COMPLETED_ON_TIME';
                }
            }

            // Datos ya validados y coercionados a number por Zod
            const { sys, dia, hr, temp } = data;
            const glucose = data.glucose ?? null;
            const spo2 = data.spo2 ?? null;

            // ── FIX 3: Detección unidad temperatura ──
            // Si temp < 45 → Celsius (valores humanos típicos 35-42°C). Convertir a °F para el threshold.
            // Si temp ≥ 45 → Fahrenheit (valores humanos típicos 95-106°F).
            const tempF = temp < 45 ? (temp * 9 / 5) + 32 : temp;

            let isCritical = false;
            let criticalMessage = "";

            if (sys > 140 || dia > 90) { isCritical = true; criticalMessage = "Posible crisis hipertensiva detectada."; }
            else if (sys < 90) { isCritical = true; criticalMessage = "Posible cuadro de hipotensión."; }
            else if (tempF > 100.4) { isCritical = true; criticalMessage = `Fiebre sistémica detectada (${temp < 45 ? `${temp}°C` : `${temp}°F`}).`; }
            // SpO2 crítica si < 94%
            else if (spo2 !== null && spo2 < 94) { isCritical = true; criticalMessage = `Hipoxemia detectada (SpO2 ${spo2}%).`; }

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
                        lateReason: applyLatePenalty ? lateReasonRaw : null,
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
                    message: ` ${criticalMessage} Zendity colocó al residente bajo protocolo de observación. Se agendó una revisión mandatoria en 45 minutos. Por favor, documente la incidencia.` 
                });
            }
        } else if (type === 'LOG') {
            const isClinicalAlert = data.isAlert === true;
            const foodIntakeNum = typeof data.foodIntake === 'number'
                ? data.foodIntake
                : parseInt(String(data.foodIntake ?? '100'), 10) || 100;
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
                    try {
                        await notifyRoles(patient.headquartersId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                            type: 'TRIAGE',
                            title: 'Nuevo ticket de Triage',
                            message: `${patient.name} — Alerta clínica: ${(data.notes || 'sin descripción').substring(0, 120)}`,
                        });
                    } catch (e) { console.error('[notify TRIAGE vitals]', e); }
                }
            }
        }

        return NextResponse.json({ success: true, message: `Registro ${type} guardado con éxito en PAI` });

    } catch (error: any) {
        console.error("Care Vitals/Log POST Error:", error);
        return NextResponse.json({ success: false, error: `DB Error: ${error.message || String(error)}` }, { status: 500 });
    }
}
