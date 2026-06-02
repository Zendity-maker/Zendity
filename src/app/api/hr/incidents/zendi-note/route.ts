import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy',
});

/**
 * POST /api/hr/incidents/zendi-note
 * Zendi mejora o redacta la nota del director en una observación de personal.
 * Body: { rawNote, severity, category, employeeName }
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const { rawNote, severity, category, employeeName } = await req.json();

        const systemPrompt = `
Eres Zendi, asistente de redacción de Zendity Healthcare — un hogar de envejecientes en Puerto Rico.
Tu función es mejorar o redactar la nota del director en una observación formal de personal.

ESTILO:
- Escribe en primera persona del director, con voz auténtica y directa.
- Tono profesional pero humano — como lo escribiría un director con experiencia, no un abogado.
- Varía la estructura y el comienzo de cada nota. Nunca uses la misma frase de apertura dos veces.
  Ejemplos de aperturas posibles (elige una diferente según el contexto):
  "En el día de hoy...", "A través de esta nota...", "Quiero dejar constancia de...",
  "Con motivo de...", "El presente documento...", "En mi función como director...",
  "Esta nota surge a raíz de...", "Me dirijo a esta comunicación para...".
- Español profesional de Puerto Rico — claro, sin tecnicismos innecesarios.
- NO inventes hechos — estructura y mejora solo lo que el director ya escribió.
- Si el borrador está vacío, redacta algo apropiado al tipo y categoría indicados.
- Extensión: 3-5 oraciones. Concreto y al punto.
- Devuelve SOLO el texto de la nota, sin encabezados, comillas ni metadatos.
`;

        const severityMap: Record<string, string> = {
            OBSERVATION: 'Observación verbal',
            WARNING: 'Amonestación escrita',
            SUSPENSION: 'Suspensión temporal',
            TERMINATION: 'Despido justificado',
        };
        const categoryMap: Record<string, string> = {
            PUNCTUALITY: 'Puntualidad',
            PATIENT_CARE: 'Cuidado del residente',
            HYGIENE: 'Desempeño',
            BEHAVIOR: 'Conducta',
            DOCUMENTATION: 'Documentación',
            UNIFORM: 'Uniforme',
            OTHER: 'Conducta general',
        };

        const userPrompt = `
Empleado: ${employeeName || 'el empleado'}
Tipo de observación: ${severityMap[severity] || severity}
Categoría: ${categoryMap[category] || category}
Borrador del director: "${rawNote || '(sin borrador — generar nota apropiada)'}"

Redacta la nota profesional:`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.85,
            max_tokens: 350,
        });

        const note = completion.choices[0]?.message?.content?.trim() ?? '';
        return NextResponse.json({ success: true, note });
    } catch (error) {
        console.error('[zendi-note] Error:', error);
        return NextResponse.json({ success: false, error: 'Error generando nota' }, { status: 500 });
    }
}
