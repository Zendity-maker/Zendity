import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import { applyScoreEvent } from '@/lib/score-event';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
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
        // ── Seguridad (FIX 2) ──
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;
        if (!ALLOWED_POST_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: "Rol no autorizado para registrar vitales" }, { status: 403 });
        }

        const body = await req.json();
        const { patientId, type, data } = body;

        if (!patientId || !type || !data) {
            return NextResponse.json({ success: false, error: "Faltan parámetros de vitales" }, { status: 400 });
        }

        // Tenant check: el paciente debe estar en la sede del invocador
        const patientCheck = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: { id: true }
        });
        if (!patientCheck) {
            return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede" }, { status: 404 });
        }

        if (type === 'VITALS') {
            if (!data.sys || !data.dia || !data.hr || !data.temp) {
                return NextResponse.json({ success: false, error: "Datos vitales incompletos: sistólica, diastólica, pulso y temperatura son obligatorios" }, { status: 400 });
            }

            // Ventana de orden a petición: si hay una VitalsOrder PENDING para este residente
            // y su expiresAt ya pasó, exigimos lateReason (>=20 chars) y aplicamos -2 al complianceScore.
            const pendingOrder = await prisma.vitalsOrder.findFirst({
                where: { patientId, status: 'PENDING' },
                orderBy: { orderedAt: 'desc' },
                select: { id: true, expiresAt: true }
            });

            let orderStatusUpdate: 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | null = null;
            let applyLatePenalty = false;
            const lateReasonRaw = typeof data.lateReason === 'string' ? data.lateReason.trim() : '';

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

            const sys = parseInt(data.sys);
            const dia = parseInt(data.dia);
            const temp = parseFloat(data.temp);
            const hr = parseInt(data.hr);
            const glucose = data.glucose ? parseInt(data.glucose) : null;
            const spo2 = data.spo2 ? parseInt(data.spo2) : null;

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
            const dailyLog = await prisma.dailyLog.create({
                data: {
                    patientId,
                    authorId: invokerId,
                    foodIntake: parseInt(data.foodIntake || "100"),
                    bathCompleted: data.bathCompleted === true,
                    notes: data.notes,
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
