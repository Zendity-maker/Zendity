import { NextResponse } from 'next/server';
import OpenAI from "openai";

// Inicializa el cliente oficial de OpenAI usando la variable de entorno
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy"
});

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "No se proporcionó texto para sintetizar." }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.warn("OpenAI API Key no encontrada. Bloqueando consulta (Error 501)");
            return NextResponse.json({ error: "Configuración de Voz Neuronal OpenAI incompleta." }, { status: 501 });
        }

        // --- OpenAI API Call (Text To Speech) ---
        // Genera un Stream en MP3 con alta fidelidad usando el modelo HD
        const mp3 = await openai.audio.speech.create({
            model: "tts-1-hd", // Modelo de alta definición para prevenir artefactos en las bocinas Geriátricas
            voice: "nova",     // "Nova" es la voz femenina de OpenAI, cálida y profesional, ideal para el rol Maternal
            input: text,
            response_format: "mp3",
            speed: 1.05        // Retocar ligeramente la velocidad de articulación
        });

        // La respuesta de OpenAI (Audio.Speech) es un objeto Response crudo (fetch-like)
        // Por lo tanto, podemos extraer su Buffer y enviarlo directamente
        const buffer = Buffer.from(await mp3.arrayBuffer());

        // Retornamos el Audio como Header 'audio/mpeg' (MP3) de manera directa
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                // Content-Length opcional
                'Content-Length': buffer.length.toString()
            }
        });

    } catch (error) {
        console.error("OpenAI TTS Error:", error);
        return NextResponse.json({ error: "Fallo al generar respuesta vocal OpenAI." }, { status: 500 });
    }
}
