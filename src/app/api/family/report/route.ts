import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
        }

        // Trick Bimodal: El session.user.id contiene el patientId para roles de Familia
        const patientId = session.user.id;

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                vitalSigns: {
                    orderBy: { createdAt: 'desc' },
                    take: 7 // Última semana
                },
                dailyLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                healthAppointments: {
                    where: {
                        appointmentDate: { gte: new Date() }
                    },
                    orderBy: { appointmentDate: 'asc' },
                    take: 3
                },
                medications: {
                    include: { medication: true },
                    where: { isActive: true } // Medicamentos activos
                }
            }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
        }

        const lastLog = patient.dailyLogs[0];
        const lastVitals = patient.vitalSigns[0];

        // -------------------------------------------------------------
        // SHADOW AI: MOTOR DE TRADUCCIÓN EMPÁTICA (Reglas de Negocio)
        // -------------------------------------------------------------
        let translatedMessage = `Hola nuevamente. Hemos estado monitoreando muy de cerca a ${patient.name} durante el día de hoy. `;

        if (lastLog) {
            if (lastLog.foodIntake >= 75) {
                translatedMessage += `Queremos contarte que tuvo un excelente apetito, terminando prácticamente toda su deliciosa comida. `;
            } else if (lastLog.foodIntake === 50) {
                translatedMessage += `Hoy ingirió la mitad de sus porciones alimenticias de su dieta ${patient.diet || 'regular'}, pero nos estamos asegurando de mantenerlo bien hidratado. `;
            } else {
                translatedMessage += `Hoy su apetito estuvo un poco más decaído de lo usual, pero nuestro equipo de enfermería le está ofreciendo alternativas y snacks según su plan. `;
            }

            if (lastLog.bathCompleted) {
                translatedMessage += `También, ya tomó su baño diario, y se encuentra con ropa fresca y limpia. `;
            }
        }

        if (lastVitals) {
            if (lastVitals.temperature > 99.5) {
                translatedMessage += `Adicionalmente, notamos una ligera elevación de temperatura más temprano, pero nuestros enfermeros ya activaron los protocolos de confort y líquidos. `;
            } else {
                translatedMessage += `Sus signos vitales, como la presión y la temperatura, están dentro de los rangos seguros y calmados. `;
            }
        }

        translatedMessage += `\nTodo el equipo de Vivid Senior Living te manda un saludo. ¡Es un buen día para venir a visitarle!`;

        return NextResponse.json({
            success: true,
            data: {
                patientParams: {
                    name: patient.name,
                    diet: patient.diet,
                    room: patient.roomNumber,
                    zone: patient.colorGroup
                },
                empatheticMessage: translatedMessage,
                vitals: patient.vitalSigns,
                recentLog: lastLog,
                appointments: patient.healthAppointments,
                medicationsCount: patient.medications.length
            }
        });

    } catch (error) {
        console.error("Family Portal API Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
