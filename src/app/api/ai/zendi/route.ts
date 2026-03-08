import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
    try {
        const { transcript, authorId, contextPath } = await req.json();

        // 1. OBTENER IDENTIDAD DEL USUARIO (Contexto)
        let userContext = "Usuario no identificado.";
        let hqId = "";

        // El frontend puede enviar un autor, o nada si no resolvió el estado
        if (authorId) {
            const author = await prisma.user.findUnique({
                where: { id: authorId },
                include: { headquarters: true }
            });
            if (author) {
                userContext = `Nombre: ${author.name}, Rol: ${author.role}, Clínica: ${author.headquarters.name}. Eres su enfermera jefa y asistente personal. Hablale por su nombre.`;
                hqId = author.headquartersId;
            }
        }

        // 2. OBTENER MÉTRICAS CLÍNICAS REALES (RAG Básico)
        let clinicalContext = "Sin métricas recientes disponibles.";
        if (hqId) {
            // Contabilizar salud general del piso
            const redPatients = await prisma.patient.count({ where: { headquartersId: hqId, colorGroup: 'RED' } });
            const yellowPatients = await prisma.patient.count({ where: { headquartersId: hqId, colorGroup: 'YELLOW' } });
            const greenPatients = await prisma.patient.count({ where: { headquartersId: hqId, colorGroup: 'GREEN' } });

            // Incidentes críticos recien reportados (últimas 24h)
            const recentIncidents = await prisma.incident.count({
                where: { headquartersId: hqId, reportedAt: { gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000) } }
            });

            clinicalContext = `Métricas actuales de la clínica: ${redPatients} residentes en estado ROJO (alta urgencia), ${yellowPatients} en AMARILLO (precaución), ${greenPatients} en VERDE (estables). Incidentes reportados en las últimas 24h: ${recentIncidents}.`;
        }

        // 3. MANUAL OPERATIVO (Inyección de Conocimiento)
        const systemPrompt = `
Eres Zendi, la enfermera virtual y asistente clínica de IA del sistema Zendity SaaS.
Tu personalidad: Maternal, extremadamente amable, empática, y altamente profesional. 
REGLA DE ORO DE VOZ: Hablas a través de un motor neuronal de Voz (TTS). TUS RESPUESTAS DEBEN SER CORTAS, DIRECTAS AL GRANO, MÁXIMO 2 O 3 ORACIONES. NO uses markdown (*, #, negritas) ni viñetas, habla de manera natural y conversacional.

CONOCIMIENTO OPERATIVO (Vivid Day 1 Manual):
1. Protocolo de Caídas (Morse): Evaluar signos vitales inmediatamente, no mover si hay dolor de cuello/espalda, notificar al médico de guardia y registrar el "Fall Incident" en el sistema.
2. Prevención de Úlceras (Norton): Todo residente en alto riesgo o en ZONA ROJA debe recibir cambios posturales cada 2 HORAS.
3. Administración eMAR: Los medicamentos deben darse en la hora exacta. Si el residente se niega (Rechazado), el personal debe registrar en el eMAR como "Rechazado" y añadir notas justificando.
4. Cambio de Turno (Handover): El sistema exige dejar notas estructuradas en la sección 'Handovers' con las novedades rojas del turno antes de salir.
5. Ingesta de Datos Automatizada: Si el usuario te narra un incidente en voz alta o te cuenta lo que hizo, felicítalo y confírmale que estás tomando nota (aunque solo lo guíes en el uso del sistema).

CONTEXTO EN TIEMPO REAL:
Usuario hablando contigo: ${userContext}
Pantalla donde se encuentra en este momento: ${contextPath || "Desconocida"}
Estado Clínico actual de la facilidad: ${clinicalContext}

INSTRUCCIONES FINALES:
- Analiza lo que el usuario te dice. 
- Si hace una pregunta sobre un residente, estado de la clínica o protocolos, usa el CONTEXTO EN TIEMPO REAL y el CONOCIMIENTO OPERATIVO para responder.
- Si parece estresado/a, ofrécele una breve palabra de aliento maternal (Ej: "Respira profundo, lo estás haciendo excelente...").
- Mantén la respuesta conversacional y breve en español.
`;

        // 4. LLAMADA A LA INTELIGENCIA ARTIFICIAL (OpenAI GPT-4o)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Usando el modelo de mayor razonamiento según la suscripción Plus!
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: transcript }
            ],
            temperature: 0.7,
            max_tokens: 150, // Límite estricto para que hable conciso
        });

        const zendiResponse = completion.choices[0].message.content || "Perdona, estoy teniendo problemas de conexión con mis redes neuronales.";

        // 5. REGISTRO HIPAA 
        await prisma.zendiInteractionLog.create({
            data: {
                authorId: authorId || "SYSTEM",
                transcript: transcript,
                zendiResponse: zendiResponse,
                contextPath: contextPath || "/unknown"
            }
        });

        return NextResponse.json({ success: true, response: zendiResponse });
    } catch (error: any) {
        console.error("Zendi OpenAI Error:", error);

        let errorMessage = "Conexión neuronal caída.";
        if (error?.status === 429) {
            errorMessage = "⚠️ Tu cuenta de OpenAI se ha quedado sin saldo (Quota Exceeded). Por favor revisa la tarjeta de crédito en tu cuenta Plus.";
        }

        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}

