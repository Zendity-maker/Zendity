import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

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
            const targetDate = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { patientId, authorId, type, data } = body;

        if (!patientId || !authorId || !type || !data) {
            return NextResponse.json({ success: false, error: "Faltan parámetros de vitales" }, { status: 400 });
        }

        if (type === 'VITALS') {
            if (!data.sys || !data.dia || !data.hr || !data.temp) {
                return NextResponse.json({ success: false, error: "Datos vitales incompletos" }, { status: 400 });
            }

            const sys = parseInt(data.sys);
            const dia = parseInt(data.dia);
            const temp = parseFloat(data.temp);

            let isCritical = false;
            let criticalMessage = "";

            if (sys > 140 || dia > 90) { isCritical = true; criticalMessage = "Posible crisis hipertensiva detectada."; }
            else if (sys < 90) { isCritical = true; criticalMessage = "Posible cuadro de hipotensión."; }
            else if (temp > 100.4) { isCritical = true; criticalMessage = "Fiebre sistémica detectada."; }

            await prisma.vitalSigns.create({
                data: {
                    patientId,
                    measuredById: authorId,
                    systolic: sys,
                    diastolic: dia,
                    heartRate: parseInt(data.hr),
                    temperature: temp,
                    glucose: data.glucose ? parseInt(data.glucose) : null,
                }
            });

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
                    authorId,
                    foodIntake: parseInt(data.foodIntake || "100"),
                    bathCompleted: data.bathCompleted === true,
                    notes: data.notes,
                    isClinicalAlert,
                }
            });

            // Auto-crear TriageTicket para alertas clínicas/UPP
            if (isClinicalAlert) {
                const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { headquartersId: true } });
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
                }
            }
        }

        return NextResponse.json({ success: true, message: `Registro ${type} guardado con éxito en PAI` });

    } catch (error: any) {
        console.error("Care Vitals/Log POST Error:", error);
        return NextResponse.json({ success: false, error: `DB Error: ${error.message || String(error)}` }, { status: 500 });
    }
}
