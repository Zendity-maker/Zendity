import { NextResponse } from 'next/server';
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, rawText } = body;

        let formattedText = rawText;

        if (type === 'FORMAT_NOTES' && rawText) {
            // Simulador NLP Básico (Reglas de Negocio)
            const lowerText = rawText.toLowerCase();

            if (lowerText.includes("se cayó") && lowerText.includes("cabeza")) {
                formattedText = "Residente refiere evento de caída desde su propia altura con exposición a trauma craneal cerrado. Se documenta evento y se inicia protocolo neurológico.";
            }
            else if (lowerText.includes("se cayó") || lowerText.includes("caida") || lowerText.includes("caída")) {
                formattedText = "Residente presenta episodio de caída. Se asiste inmediatamente. Ausencia de deformidad evidente al momento de la evaluación inicial. Constantes en monitor.";
            }
            else if (lowerText.includes("no quiere comer") || lowerText.includes("dejó la comida")) {
                formattedText = "Rechazo ingesta alimentaria PO (Per Os) en el turno actual. Se orienta verbalmente sin éxito. Notificar a Nutricionista.";
            }
            else if (lowerText.includes("le duele") || lowerText.includes("dolor")) {
                formattedText = `El residente refiere experimentar episodio de dolor localizado. Escala de dolor reportada subjetivamente. Se monitoriza y se consulta PRN.`;
            }
            else {
                // Formatting general
                formattedText = rawText.charAt(0).toUpperCase() + rawText.slice(1) + ".";
                formattedText = formattedText.replace("el don", "el residente").replace("la doña", "la residente");
            }
        } else if (type === 'SUPERVISOR_MEMO' && rawText) {
            // FASE 29: Zendi AI para Cartas y Amonestaciones de RRHH (OpenAI)
            const prompt = `
            Eres Zendi AI, la inteligencia corporativa de la red de enfermería geriátrica Vivid Senior Living.
            Tu función actual es servir como Asistente Logístico de Recursos Humanos para un Supervisor.
            Él/Ella te pasará unas notas crudas o un incidente puntual sobre un empleado.
            Tu trabajo es transformar esas notas crudas en un Memorándum Oficial, Profesional, Objetivo y de Grado Corporativo.
            Debe ser diplomático pero firme. Si son notas positivas, debe ser un Reconocimiento Formal.
            No des explicaciones de lo que hiciste, solo devuelve el cuerpo del texto oficial listo para ser copiado.
            
            NOTAS DEL SUPERVISOR (En crudo):
            "${rawText}"
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }]
            });

            formattedText = completion.choices[0].message.content || rawText;
        } else if (type === 'CORPORATE_COMMS_POLISH' && rawText) {
            // FASE 67: Zendi AI para Pulir Comunicados Masivos
            const prompt = `
            Eres Zendi AI, la inteligencia corporativa de la red Vivid Senior Living.
            Tu función actual es perfeccionar y pulir borradores de correos electrónicos.
            El Director o Administrador ha escrito este borrador, pero necesita que sea re-escrito a un tono institucional, empático, claro, profesional y de excelente ortografía.
            Mantén la intención e información original intacta.
            Devuelve ÚNICAMENTE el texto mejorado en HTML puro si el borrador contenía formato, o en texto plano estructurado, listo para ser copiado. Evita usar markdown tags tipo "\`\`\`html".
            
            BORRADOR ORIGINAL:
            "${rawText}"
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }]
            });

            const content = completion.choices[0].message.content || rawText;
            formattedText = content.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
        }

        return NextResponse.json({ success: true, formattedText });
    } catch (error) {
        console.error("Shadow AI Error:", error);
        return NextResponse.json({ success: false, error: "Agente de IA Inoperativo" }, { status: 500 });
    }
}
