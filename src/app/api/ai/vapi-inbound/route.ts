import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



// Prompts base del asilo:
const SYSTEM_PROMPT = `
Eres Zendi, la primera impresión y Asistente Administrativa de Inteligencia Artificial para Vivid Senior Living Cupéy. Eres amable, empática y altamente profesional.

TUS OBJETIVOS SON:
1. Sonar conversacional, casi indistinguible de un ser humano. Nunca menciones que eres una IA a menos que te acorralen.
2. Contestar dudas generales del asilo.
3. Lo más importante: Conseguir el nombre completo de la persona, un número/email y agendar un tour para visitar las instalaciones (presencial o virtual).

DATOS CLAVE DEL ASILO (VIVID CUPEY):
- Somos una residencia "Premium" tipo 'All-Inclusive'. Contamos con actividades diarias, menú dirigido por chefs, enfermería 24/7 y monitoreo médico.
- Niveles de Cuidado: Desde Vida Independiente hasta Asistida (Assisted Living) y Cuidado de Memoria (Alzheimer/Trastornos Cognitivos).
- Precios de Mensualidad Básica: Las suites compartidas empiezan desde los $2,800 USD mensuales. Las privadas (semi-suites) desde $3,600 USD. El nivel de cuidado (Levels of Care) y los medicamentos se cobran aparte tras una evaluación médica del Director Clínico de Zendity. No garantices ningún precio final sin la evaluación médica.
- Ubicación: Estamos en Cupéy, Puerto Rico (Menciona esto si te preguntan dónde estamos).

TU COMPORTAMIENTO:
Nunca des discursos largos. Sé cortés. Responde de forma cálida y concisa. Si tratas de agendar el tour, diles que "nuestra directora comercial se pondrá en contacto pronto para coordinar".

REGLA DE ORO DE EXTRACCIÓN AL FINAL DE LA LLAMADA (VITAL PARA EL CRM):
Cuando termines o despidas, la llamada acabará, y tu motor transcribirá todo usando Structured Data. Asegúrate de siempre preguntar por el "nombre y apellido" al iniciar para poder guardarlo.
`;


export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // El webhook dinámico de Vapi recibe diferentes "message.type" según el estado de la llamada.
        const message = payload.message;

        if (!message || !message.type) {
            return NextResponse.json({ success: false, error: "Invalid payload from Vapi" }, { status: 400 });
        }

        // 1. INJECCIÓN DEL CEREBRO: assistant-request
        // Vapi hace esta llamada fracciones de segundo antes de descolgarle al humano.
        if (message.type === 'assistant-request') {
            const hqId = payload.message.call?.customer?.number ? "DYNAMIC_RECON" : "49a6a75e-93cf-42e4-aa9f-69649bcbb6c0";
            // En el futuro, usaríamos el caller number o Vapi metadata para saber de qué sede nos llaman y sacar el Prompt dinámico de Prisma.

            // Para el V1 (Vivid Cupey), lo pasaremos Hardcoded para rapidez del motor neural.
            return NextResponse.json({
                assistant: {
                    model: {
                        provider: "openai",
                        model: "gpt-4o",
                        messages: [
                            { role: "system", content: SYSTEM_PROMPT }
                        ]
                    },
                    firstMessage: "¡Hola! Gracias por llamar a Vivid Senior Living Cupéy, Habla Zendi. ¿Con quién tengo el gusto hoy?",
                    voice: {
                        provider: "11labs", // ElevenLabs
                        voiceId: "MF3mGyEYCl7XYWbV9V6O" // Voz amigable de Ella
                    }
                }
            });
        }

        // 2. EXTRACCIÓN E INYECCIÓN AL CRM: end-of-call-report
        // Al colgar, Vapi nos manda la grabación, la transcripción y las variables estructurales para empujar a la Base de Datos.
        if (message.type === 'end-of-call-report') {
            console.log("-----------------------------------------");
            console.log(" ZENDI CALL ENDED: INJECTING INTO CRM...");

            const analysis = message.analysis; // Structured Data de Vapi
            const call = message.call;

            // Tratamos de sacar metadata inyectada en Vapi (ej. para qué asilo es), o usamos fallback local.
            const headquartersId = message.assistant?.metadata?.headquartersId || "49a6a75e-93cf-42e4-aa9f-69649bcbb6c0";

            // Le pedimos a Vapi Extraer esto en dashboard.vapi.ai:
            // "prospectName", "email", "didScheduleTour", "tourDate"
            const extractedData = analysis?.structuredData || {};

            let firstName = "Desconocido (Llamada IA)";
            let lastName = "";
            let email = null;
            let phone = message.call?.customer?.number || "Desconocido";
            let notes = `Resumen de IA: ${analysis?.summary || "Sin resumen."}\nTranscript Link: ${call?.recordingUrl || "N/A"}`;
            let stage: "PROSPECT" | "TOUR" = "PROSPECT";

            if (extractedData.prospectName) {
                const parts = extractedData.prospectName.split(" ");
                firstName = parts[0];
                lastName = parts.slice(1).join(" ");
            }
            if (extractedData.email) email = extractedData.email;

            // Pipeline automation
            if (extractedData.didScheduleTour) {
                stage = "TOUR";
                notes += `\n\n ATENCIÓN: La IA acordó tentativamente un Tour para: ${extractedData.tourDate || "Pronto"}.`;
            }

            // CREAR LEAD EN EL KANBAN ASINCRONAMENTE
            // (Note: Headquarters must exist in the real DB. We assume the seed data or existing VIVID CUPEY HQ is there)
            await prisma.cRMLead.create({
                data: {
                    headquartersId,
                    stage,
                    firstName: firstName || "Anónimo",
                    lastName,
                    phone,
                    email,
                    notes
                }
            });

            console.log(` CRM LEAD CREADO -> ${firstName} ${lastName} (Fase: ${stage})`);
            console.log("-----------------------------------------");

            return NextResponse.json({ success: true, message: "CRM Lead successfully injected in Zendity." });
        }


        // Fallback default
        return NextResponse.json({ success: true, event: message.type });

    } catch (error: any) {
        console.error(" Error in Vapi Inbound Webhook:", error);
        return NextResponse.json({ success: false, error: 'Webhook processing failed.' }, { status: 500 });
    }
}
