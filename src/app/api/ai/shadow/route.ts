import { NextResponse } from 'next/server';
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" });

const ZENDI_BASE = `Eres Zendi, la asistente operativa de Zendity — un sistema para hogares de envejecientes.
Tu voz: breve, clara, profesional, humana, orientada a acción.
Principio rector: reducir carga de escritura sin quitar supervisión humana.
Nunca generes textos largos innecesarios. Nunca uses jerga robótica. Nunca dramatices.
El usuario conserva el control — tú solo mejoras lo que ya escribió.`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, rawText, context } = body;

        if (!rawText?.trim()) {
            return NextResponse.json({ success: false, error: "Texto vacío" }, { status: 400 });
        }

        let formattedText = rawText;

        // ── TIPO 1: FORMAT_NOTES — Notas clínicas y operativas ──────────────
        if (type === 'FORMAT_NOTES') {
            const prompt = `${ZENDI_BASE}

Tu tarea ahora: mejorar una nota operativa o clínica escrita por personal de un hogar de envejecientes.
Contexto del campo: ${context || 'nota clínica operativa'}.

Reglas estrictas:
- Convierte lenguaje coloquial a lenguaje clínico/operativo preciso cuando corresponda
- Mantén la información exacta — no inventes ni amplíes datos
- Máximo 3 oraciones. Si el original es más corto, mantenlo corto
- Sin bullets, sin títulos, solo texto limpio listo para registrar
- En español. Tono profesional, no robótico

NOTA ORIGINAL:
"${rawText}"

Devuelve ÚNICAMENTE el texto mejorado, sin explicaciones ni comillas.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200,
                temperature: 0.3,
            });

            formattedText = completion.choices[0].message.content?.trim() || rawText;

        // ── TIPO 2: SUPERVISOR_MEMO — Memorándum RRHH ───────────────────────
        } else if (type === 'SUPERVISOR_MEMO') {
            const prompt = `${ZENDI_BASE}

Tu tarea ahora: convertir notas crudas de un supervisor en un memorándum oficial de RRHH.
Debe ser diplomático pero firme. Si es positivo, es un reconocimiento formal. Si es correctivo, es objetivo y sin dramatismo.

Reglas:
- Tono institucional, profesional, directo
- Sin explicaciones de tu proceso — solo el texto del memo
- Sin saludos genéricos ni frases de relleno
- Máximo 150 palabras

NOTAS DEL SUPERVISOR:
"${rawText}"

Devuelve ÚNICAMENTE el cuerpo del memorándum, listo para copiar.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 300,
                temperature: 0.4,
            });

            formattedText = completion.choices[0].message.content?.trim() || rawText;

        // ── TIPO 3: CORPORATE_COMMS_POLISH — Email institucional ─────────────
        } else if (type === 'CORPORATE_COMMS_POLISH') {
            const prompt = `${ZENDI_BASE}

Tu tarea ahora: pulir un borrador de email corporativo o comunicación institucional.
Mantén la intención e información original intacta. Solo mejora el tono, claridad y ortografía.

Reglas:
- Tono empático, claro, profesional
- Devuelve texto plano estructurado, sin markdown ni backticks
- Sin cambiar los hechos del borrador original

BORRADOR:
"${rawText}"

Devuelve ÚNICAMENTE el texto mejorado, listo para copiar.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 400,
                temperature: 0.4,
            });

            const content = completion.choices[0].message.content || rawText;
            formattedText = content.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();

        // ── TIPO 4: FAMILY_MESSAGE — Mensaje a familia ───────────────────────
        } else if (type === 'FAMILY_MESSAGE') {
            const prompt = `${ZENDI_BASE}

Tu tarea ahora: mejorar un mensaje que el personal enviará a la familia de un residente.
El tono debe ser cálido, tranquilizador y profesional — sin alarmar innecesariamente.

Reglas:
- Mantén la información exacta del mensaje original
- Tono humano, cercano, institucional
- Sin tecnicismos clínicos innecesarios para una familia
- Máximo 100 palabras

MENSAJE ORIGINAL:
"${rawText}"

Devuelve ÚNICAMENTE el mensaje mejorado, listo para enviar.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200,
                temperature: 0.5,
            });

            formattedText = completion.choices[0].message.content?.trim() || rawText;

        // ── TIPO 5: KITCHEN_OBS — Observación de cocina ─────────────────────
        } else if (type === 'KITCHEN_OBS') {
            const prompt = `${ZENDI_BASE}

Tu tarea ahora: mejorar una observación del supervisor sobre el servicio de cocina.
Debe ser objetiva, concreta y accionable para el personal de cocina.

Reglas:
- Clara y directa — el cocinero debe entender exactamente qué se observó
- Sin dramatismo ni lenguaje agresivo
- Máximo 2 oraciones

OBSERVACIÓN ORIGINAL:
"${rawText}"

Devuelve ÚNICAMENTE la observación mejorada, lista para enviar.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 150,
                temperature: 0.3,
            });

            formattedText = completion.choices[0].message.content?.trim() || rawText;
        }

        return NextResponse.json({ success: true, formattedText });

    } catch (error) {
        console.error("Shadow AI Error:", error);
        return NextResponse.json({ success: false, error: "Zendi no disponible en este momento" }, { status: 500 });
    }
}
