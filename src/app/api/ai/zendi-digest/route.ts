import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
    try {
        const { headquartersId } = await req.json();

        if (!headquartersId) {
            return NextResponse.json({ error: "headquartersId es requerido." }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.warn("OpenAI API Key no encontrada (Digest).");
            return NextResponse.json({ error: "Configuración de OPENAI_API_KEY incompleta." }, { status: 501 });
        }

        // Rango: Últimas 8 horas
        const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

        // Extraer pacientes del HQ con signos vitales o logs recientes
        const patients = await prisma.patient.findMany({
            where: { headquartersId },
            include: {
                vitalSigns: {
                    where: { createdAt: { gte: eightHoursAgo } },
                    orderBy: { createdAt: 'desc' }
                },
                dailyLogs: {
                    where: { createdAt: { gte: eightHoursAgo } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        const activePatients = patients.filter(p => p.vitalSigns.length > 0 || p.dailyLogs.length > 0);

        if (activePatients.length === 0) {
            return NextResponse.json({ notes: [], message: "No hubo actividad clínica en las últimas 8 horas." });
        }

        // Ensamblar contexto clínico para el Prompt
        let promptData = "Analiza los siguientes datos clínicos de las últimas 8 horas y genera notas de relevo de guardia concisas y profesionales. Para cada paciente, determina si la nota es crítica (isCritical: true/false) basado en signos vitales anormales (ej. presión > 140/90, temp > 38C) o alertas en log.\n\nPacientes:\n";

        for (const p of activePatients) {
            promptData += `Paciente ID: ${p.id}, Nombre: ${p.name}, Cuarto: ${p.roomNumber}\n`;
            if (p.vitalSigns.length > 0) {
                const latest = p.vitalSigns[0]; // El más reciente
                promptData += `- Últimos Vitales: PA ${latest.systolic}/${latest.diastolic} mmHg, Temp ${latest.temperature}°C, FC ${latest.heartRate} lpm.\n`;
            }
            if (p.dailyLogs.length > 0) {
                for (const log of p.dailyLogs) {
                    promptData += `- Log Cuidado: Ingesta ${log.foodIntake}%, Baño Completado: ${log.bathCompleted ? 'Sí' : 'No'}, Notas extra: ${log.notes || 'Limpias'}, Alerta Clínica: ${log.isClinicalAlert ? 'Sí' : 'No'}.\n`;
                }
            }
            promptData += "\n";
        }

        promptData += `Devuelve estrictamente un JSON válido con este formato: 
{ 
  "notes": [ 
    { 
      "patientId": "ID del paciente", 
      "clinicalNotes": "Resumen conciso y profesional del estado para la enfermera entrante (Máximo 2 oraciones)", 
      "isCritical": boolean 
    } 
  ] 
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Eres Zendi AI, enfermera robótica jefa de planta y asistente clínica. Eres experta en redactar los relevos de guardia (Shift Handovers) recopilando la información y estructurando notas de cuidado eficientes en español puertorriqueño/neutro." },
                { role: "user", content: promptData }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2
        });

        const resultJson = completion.choices[0].message.content;
        const result = JSON.parse(resultJson || '{"notes":[]}');

        return NextResponse.json(result);

    } catch (error) {
        console.error("Zendi Digest Error:", error);
        return NextResponse.json({ error: "Fallo al generar resumen de Zendi AI." }, { status: 500 });
    }
}
