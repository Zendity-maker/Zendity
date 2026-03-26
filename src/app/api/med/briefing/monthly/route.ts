import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
    try {
        const { patientId } = await req.json();
        if (!patientId) return NextResponse.json({ success: false, error: "Falta patientId" }, { status: 400 });

        const date30DaysAgo = new Date();
        date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                vitalSigns: { where: { createdAt: { gte: date30DaysAgo } }, orderBy: { createdAt: 'asc' } },
                incidents: { where: { reportedAt: { gte: date30DaysAgo } }, orderBy: { reportedAt: 'asc' } },
                dailyLogs: { where: { createdAt: { gte: date30DaysAgo }, isClinicalAlert: true }, orderBy: { createdAt: 'asc' } },
                fallIncidents: { where: { reportedAt: { gte: date30DaysAgo } }, orderBy: { reportedAt: 'asc' } }
            }
        });

        if (!patient) return NextResponse.json({ success: false, error: "Paciente no encontrado" }, { status: 404 });

        // 1. Math Engine: Vitals Averages
        const vitals = patient.vitalSigns;
        let avgSys = 0, avgDia = 0, avgHr = 0, avgTemp = 0;
        const abnormalVitals: string[] = [];

        if (vitals.length > 0) {
            avgSys = Math.round(vitals.reduce((acc, v) => acc + v.systolic, 0) / vitals.length);
            avgDia = Math.round(vitals.reduce((acc, v) => acc + v.diastolic, 0) / vitals.length);
            avgHr = Math.round(vitals.reduce((acc, v) => acc + v.heartRate, 0) / vitals.length);
            avgTemp = Number((vitals.reduce((acc, v) => acc + v.temperature, 0) / vitals.length).toFixed(1));

            vitals.forEach(v => {
                const dateStr = v.createdAt.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const isAbnormal = v.systolic > 140 || v.systolic < 90 || v.diastolic > 90 || v.diastolic < 60 || v.heartRate > 100 || v.heartRate < 55 || v.temperature >= 99.5;
                if (isAbnormal) {
                    abnormalVitals.push(`[${dateStr}] BP: ${v.systolic}/${v.diastolic}, HR: ${v.heartRate}, Temp: ${v.temperature}°F`);
                }
            });
        }

        // 2. Incident & Preventive Summaries
        const clinicalLogs = patient.dailyLogs.map(l => `[${l.createdAt.toLocaleDateString()}] Acción Preventiva: ${l.notes}`);
        const incidentLogs = patient.incidents.map(i => `[${i.reportedAt.toLocaleDateString()}] Incidente (${i.type}): ${i.description}`);
        const fallLogs = patient.fallIncidents.map(f => `[${f.reportedAt.toLocaleDateString()}] Caída: ${f.notes || f.interventions}`);

        const systemPrompt = `Eres Zendi, la Inteligencia Clínica de Zendity. Actúa como el Director Médico Geriátrico.
El Doctor o Psiquiatra visitará el centro mañana. Debes redactar el "Dossier Médico Mensual" de los últimos 30 días para el paciente: ${patient.name}.

FORMATO REQUERIDO:
Usa un formato profesional en Markdown. Nada de saludos largos.
1. Resumen Ejecutivo (1 párrafo sobre el estado general del mes).
2. Promedios Vitales Mensuales.
3. Patrón de Signos Vitales Anormales: Extrae las fechas exactas de las vitals anormales proveídas para que el médico detecte patrones con medicamentos. Si no hubo, indícalo.
4. Alertas Preventivas y Comportamiento: Resume las acciones preventivas, caídas e incidentes.

DATOS CRUDOS (Últimos 30 días):
Promedios: ${vitals.length > 0 ? `BP: ${avgSys}/${avgDia}, HR: ${avgHr}, Temp: ${avgTemp}°F` : 'Sin registros'}
Vitales Anormales (Fuera de Rango):
${abnormalVitals.length > 0 ? abnormalVitals.join('\n') : 'Ninguna lectura fuera de rango.'}

Acciones Preventivas Reportadas:
${clinicalLogs.length > 0 ? clinicalLogs.join('\n') : 'Ninguna'}

Incidentes/Comportamiento:
${incidentLogs.length > 0 ? incidentLogs.join('\n') : 'Ninguno'}

Caídas Reportadas:
${fallLogs.length > 0 ? fallLogs.join('\n') : 'Ninguna'}`;

        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }],
            temperature: 0.2,
        });

        const dossierMarkdown = gptResponse.choices[0].message?.content || "No se pudo generar el dossier técnico.";

        return NextResponse.json({ success: true, patientName: patient.name, dossierMarkdown, hasRedFlags: (abnormalVitals.length > 0 || clinicalLogs.length > 0 || incidentLogs.length > 0 || fallLogs.length > 0) });

    } catch (error) {
        console.error("Monthly Briefing API Error:", error);
        return NextResponse.json({ success: false, error: "Error interno al generar el dossier médico." }, { status: 500 });
    }
}
