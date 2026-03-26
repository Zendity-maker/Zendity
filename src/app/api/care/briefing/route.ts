import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const { colorGroup, userName } = await req.json();

        // 1. Obtener Residentes de esa Zona de Color y sus alertas de 12Hrs
        const patients = await prisma.patient.findMany({
            where: {
                colorGroup: colorGroup as any,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] }
            },
            include: {
                vitalSigns: {
                    where: { createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
                    orderBy: { createdAt: 'desc' }
                },
                dailyLogs: {
                    where: { createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
                    orderBy: { createdAt: 'desc' }
                },
                healthAppointments: {
                    where: {
                        appointmentDate: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            lt: new Date(new Date().setHours(23, 59, 59, 999))
                        }
                    }
                }
            }
        });

        const firstName = userName ? userName.split(' ')[0] : 'compañero';
        let ttsMessage = `Buen día, ${firstName}. Bienvenido al Grupo ${colorGroup}. He revisado los expedientes de este turno y estoy lista para asistirte en los cuidados de hoy. `;

        const quickRead = { vitalsAlerts: 0, foodAlerts: 0, appointments: 0 };
        let hasIssues = false;

        patients.forEach(p => {
            // Check Vital Alerts (Fiebre)
            const fever = p.vitalSigns.find(v => v.temperature > 99.5);
            if (fever) {
                ttsMessage += `Por favor, mantén en observación a ${p.name}, presentó una temperatura elevada de ${fever.temperature} grados recientemente. Sugiero aumentar su ingesta hídrica. `;
                quickRead.vitalsAlerts++;
                hasIssues = true;
            }

            // Check Food Alerts (No comió)
            const emptyFood = p.dailyLogs.find(l => l.foodIntake === 0);
            if (emptyFood) {
                ttsMessage += `Noté que ${p.name} tuvo una ingesta reducida en su última comida. Recomiendo ofrecer una alternativa o suplemento para asegurar su perfil nutricional. `;
                quickRead.foodAlerts++;
                hasIssues = true;
            }

            // Check Appointments Today
            p.healthAppointments.forEach(app => {
                ttsMessage += `También te recuerdo que hay una ${app.type} programada para ${p.name} el día de hoy y debemos estar preparados. `;
                quickRead.appointments++;
                hasIssues = true;
            });
        });

        // 2. Obtener Eventos Institucionales del Calendario para HOY aplicables a este grupo
        const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
        const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));
        
        const hqEvents = await prisma.headquartersEvent.findMany({
            where: {
                startTime: { gte: todayStart, lt: todayEnd }
            }
        });

        // Filtrar Eventos que le tocan a este Cuidador (según la lógica "ALL", "GROUP", "SPECIFIC")
        const assignedPatientIds = patients.map(p => p.id);
        const relevantEvents = hqEvents.filter(ev => {
            if (ev.targetPopulation === 'ALL') return true;
            if (ev.targetPopulation === 'GROUP' && ev.targetGroups.includes(colorGroup)) return true;
            if (ev.targetPopulation === 'SPECIFIC' && ev.targetPatients.some(id => assignedPatientIds.includes(id))) return true;
            return false;
        });

        if (relevantEvents.length > 0) {
            hasIssues = true;
            const eventDescriptions = relevantEvents.map(e => `${e.title} a las ${new Date(e.startTime).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}`).join(", ");
            ttsMessage += `Además, toma nota del calendario general: hoy tenemos ${eventDescriptions}. `;
        }

        if (!hasIssues) {
            ttsMessage += "Los signos vitales de nuestros residentes se encuentran estables en este momento. Estoy a tu disposición cuando desees iniciar nuestro recorrido.";
        } else {
            ttsMessage += "He enviado estas alertas a tu pantalla principal para fácil referencia. Cuando gustes, empezamos a atender estos frentes.";
        }

        return NextResponse.json({
            success: true,
            briefing: { ttsMessage, quickRead }
        });

    } catch (error) {
        console.error("Briefing API Error:", error);
        return NextResponse.json({ success: false, error: "Fallo compilando briefing" }, { status: 500 });
    }
}
