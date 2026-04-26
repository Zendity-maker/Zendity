import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy',
    timeout: 20_000,
});

const STAFF_ROLES = ['DIRECTOR', 'ADMIN', 'NURSE', 'SUPERVISOR'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !STAFF_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const { text, context } = await req.json();

        if (!text || typeof text !== 'string' || text.trim().length < 3) {
            return NextResponse.json({ success: false, error: 'Texto requerido' }, { status: 400 });
        }

        const hqName = (session.user as any).hqName || 'el hogar de cuidado';

        const prompt = `Eres Zendi, asistente de comunicación de ${hqName}. Mejora este mensaje para enviarlo a un familiar de un residente.

REGLAS:
- Tono cálido, empático y profesional
- Sin tecnicismos médicos
- Máximo la misma extensión que el original
- Conserva el contenido y la intención original
- Correcto en español
- Nunca menciones diagnósticos ni información clínica sensible
- No añadas saludos ni despedidas si el original no los tiene

Mensaje original: ${text.trim()}

Responde SOLO con el mensaje mejorado, sin explicaciones ni comillas.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
            temperature: 0.4,
        });

        const improved = completion.choices?.[0]?.message?.content?.trim();

        if (!improved || improved.length < 3) {
            return NextResponse.json({ success: false, error: 'No se pudo mejorar el texto' }, { status: 500 });
        }

        return NextResponse.json({ success: true, improved });

    } catch (error) {
        console.error('[zendi/improve-text] error:', error);
        return NextResponse.json({ success: false, error: 'Error procesando la solicitud' }, { status: 500 });
    }
}
