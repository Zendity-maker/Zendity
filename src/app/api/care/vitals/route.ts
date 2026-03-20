import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
                    message: `🚨 ${criticalMessage} Zendity colocó al residente bajo protocolo de observación. Se agendó una revisión mandatoria en 45 minutos. Por favor, documente la incidencia.` 
                });
            }
        } else if (type === 'LOG') {
            await prisma.dailyLog.create({
                data: {
                    patientId,
                    authorId,
                    foodIntake: parseInt(data.foodIntake || "100"),
                    bathCompleted: data.bathCompleted === true,
                    notes: data.notes,
                    isClinicalAlert: data.isAlert === true,
                }
            });
        }

        return NextResponse.json({ success: true, message: `Registro ${type} guardado con éxito en PAI` });

    } catch (error: any) {
        console.error("Care Vitals/Log POST Error:", error);
        return NextResponse.json({ success: false, error: `DB Error: ${error.message || String(error)}` }, { status: 500 });
    }
}
