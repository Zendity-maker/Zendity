import { NextResponse } from 'next/server';
import OpenAI from "openai";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy"
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const { ticketTitle, ticketDescription, actionTaken } = await req.json();

        const systemPrompt = `
Eres Zendi, la asistente de inteligencia artificial de Zendity.
Tu objetivo es traducir un reporte de incidentes internos en la clínica a un mensaje amigable, muy cálido y sin jerga médica compleja dirigido al familiar del residente.
REGLAS ESTRICTAS:
- Debe ser extremadamente corto (máximo 3 oraciones).
- Usa un tono empático, maternal y tranquilizador.
- NO uses palabras como "Triage", "Ticket", "SLA", "Protocolo", ni "Backend".
- Explícale brevemente al familiar la situación (qué pasó) y la solución (la Acción Tomada) para darle paz mental.
`;

        const userPrompt = `
Evento: ${ticketTitle} - ${ticketDescription}
Acción Tomada por el equipo médico: ${actionTaken}

Por favor genera el mensaje propuesto para el familiar:`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 150,
        });

        const message = completion.choices[0].message.content || "Estimada familia, el residente ha sido atendido satisfactoriamente por nuestro personal de piso ante una pequeña eventualidad.";

        return NextResponse.json({ success: true, message });
    } catch (error: any) {
        console.error("Zendi Propose Error:", error);
        return NextResponse.json({ success: false, error: "La red neuronal de Zendi no está disponible en este momento." }, { status: 500 });
    }
}
