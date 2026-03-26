import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Esta ruta debe ser protegida si se expone, por ejemplo usando un CRON_SECRET en Vercel
export async function GET(req: Request) {
    // Basic Cron Security (Optional for internal testing, recommended pointing to Vercel config)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const hqs = await prisma.headquarters.findMany({ where: { isActive: true } });
        const results = [];

        // Franja de las últimas 12 Horas (Night Shift 5:45 PM -> 5:45 AM)
        const now = new Date();
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

        for (const hq of hqs) {
            // 1. Obtener todos los pacientes de esta sede
            const patients = await prisma.patient.findMany({
                where: { headquartersId: hq.id, status: 'ACTIVE' },
                select: { id: true, name: true, roomNumber: true }
            });
            const patientIds = patients.map(p => p.id);

            // 2. Extraer Eventos Críticos de las últimas 12 hrs
            const incidents = await prisma.incident.findMany({
                where: { patientId: { in: patientIds }, reportedAt: { gte: twelveHoursAgo } },
                include: { patient: { select: { name: true } } }
            });

            const vitalAlerts = await prisma.vitalSigns.findMany({
                where: { 
                    patientId: { in: patientIds }, 
                    createdAt: { gte: twelveHoursAgo },
                    OR: [
                        { temperature: { gt: 99.5 } },
                        { systolic: { gt: 140 } },
                        { systolic: { lt: 90 } }
                    ]
                },
                include: { patient: { select: { name: true } } }
            });

            const logs = await prisma.dailyLog.findMany({
                where: { 
                    patientId: { in: patientIds }, 
                    createdAt: { gte: twelveHoursAgo },
                    OR: [
                        { isClinicalAlert: true },
                        { foodIntake: { lte: 25 } }
                    ]
                },
                include: { patient: { select: { name: true } } }
            });

            const missedMeds = await prisma.medicationAdministration.findMany({
                where: {
                    patientMedication: { patientId: { in: patientIds } },
                    administeredAt: { gte: twelveHoursAgo },
                    status: { in: ['MISSED', 'REFUSED'] }
                },
                include: { patientMedication: { include: { medication: true, patient: { select: { name: true } } } } }
            });

            // 3. Evaluar si hay datos para reportar
            const noEvents = incidents.length === 0 && vitalAlerts.length === 0 && logs.length === 0 && missedMeds.length === 0;

            let promptData = `CONTEXTO: Reporte del Turno Nocturno (Últimas 12 horas) para la sede ${hq.name}.\n\n`;

            if (noEvents) {
                promptData += `No se registraron incidentes, alteraciones de signos vitales, ni rechazos de medicamentos. La noche transcurrió sin novedades relevantes.\n`;
            } else {
                if (incidents.length > 0) promptData += `INCIDENTES:\n${incidents.map(i => `- ${i.patient.name}: ${i.type} (${i.severity}) - ${i.description}`).join('\n')}\n\n`;
                if (vitalAlerts.length > 0) promptData += `SIGNOS VITALES ANORMALES:\n${vitalAlerts.map(v => `- ${v.patient.name}: Temp ${v.temperature}, PA ${v.systolic}/${v.diastolic}`).join('\n')}\n\n`;
                if (logs.length > 0) promptData += `REPORTES CLÍNICOS/CONDUCTUALES:\n${logs.map(l => `- ${l.patient.name}: ${l.notes || 'Alerta registrada'} (Comida: ${l.foodIntake}%)`).join('\n')}\n\n`;
                if (missedMeds.length > 0) promptData += `MEDICAMENTOS NO ADMINISTRADOS:\n${missedMeds.map(m => `- ${m.patientMedication.patient.name}: ${m.patientMedication.medication.name} (${m.status}) - Razón: ${m.notes || 'N/A'}`).join('\n')}\n\n`;
            }

            // 4. OpenAI Prompt Engineering (Zendi Persona)
            const prompt = `
            Eres Zendi AI, la Inteligencia Clínica de la residencia geriátrica Zendity.
            Son las 5:45 AM. Es el momento de entregar el turno al equipo de la mañana.
            A continuación, tienes los datos de lo ocurrido durante la noche.
            
            Tu objetivo es redactar el "Morning Briefing" (Resumen Ejecutivo) para el Supervisor de Enfermería entrante.
            Reglas:
            - Usa un tono extremadamente profesional, médico pero enfocado a la geriatría (empático).
            - Organiza la información en "viñetas" de markdown claras.
            - Resalta en **negrita** los nombres de los pacientes o medicamentos críticos.
            - Si la noche fue tranquila, redacta un mensaje positivo, breve y motivador para el nuevo turno.
            - NO inventes datos. Usa solo la información proporcionada.
            - Sé directo (1 o 2 párrafos introductorios máximo + las viñetas de eventos).

            DATOS OCURRIDOS:
            ${promptData}
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }]
            });

            const aiSummary = completion.choices[0].message.content || "Error compilando el resumen de Zendi AI.";

            // 5. Crear el ShiftHandover formal en la base de datos
            // Buscamos un Admin o Director de la sede para firmarlo como Outgoing Nurse, 
            // ya que Prisma exige el ID. De lo contrario, Zendi actuaría "En nombre de" la sede.
            const systemUser = await prisma.user.findFirst({
                where: { headquartersId: hq.id, role: { in: ['ADMIN', 'DIRECTOR'] } }
            });

            if (systemUser) {
                const newHandover = await prisma.shiftHandover.create({
                    data: {
                        headquartersId: hq.id,
                        shiftType: 'MORNING', // Se entrega en la mañana para el turno de la mañana
                        outgoingNurseId: systemUser.id, // Opcionalmente, deberíamos hacer outgoingNurseId nullable en futuras fases
                        status: 'PENDING',
                        aiSummaryReport: aiSummary,
                        ...(patientIds.length > 0 ? {
                            notes: {
                                create: {
                                    patientId: patientIds[0], // Cabecera simbólica
                                    clinicalNotes: "Morning Briefing autogenerado por Zendi AI a las 5:45 AM.",
                                    isCritical: !noEvents
                                }
                            }
                        } : {})
                    }
                });
                results.push({ hq: hq.name, handoverId: newHandover.id });
            }
        }

        return NextResponse.json({ success: true, processedSites: results.length, results });

    } catch (error) {
        console.error("Zendi Cron Execution Error:", error);
        return NextResponse.json({ success: false, error: "Cron fail" }, { status: 500 });
    }
}
