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
            await prisma.vitalSigns.create({
                data: {
                    patientId,
                    measuredById: authorId,
                    systolic: parseInt(data.systole),
                    diastolic: parseInt(data.diastole),
                    heartRate: parseInt(data.hr),
                    temperature: parseFloat(data.temp),
                    glucose: data.glucose ? parseInt(data.glucose) : null,
                }
            });
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

    } catch (error) {
        console.error("Care Vitals/Log POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo al guardar datos clínicos" }, { status: 500 });
    }
}
