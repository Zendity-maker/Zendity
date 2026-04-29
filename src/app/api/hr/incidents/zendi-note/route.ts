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
Eres Zendi, escriba profesional de Zendity Healthcare.
Tu función es redactar o mejorar notas formales del director en observaciones disciplinarias de personal.

REGLAS ESTRICTAS:
- Redacta en primera persona del director (ej. "Mediante la presente, dejo constancia de...").
- Tono: formal, objetivo, imparcial y respetuoso — propio de un documento oficial de RRHH.
- Usa terminología profesional de gestión de personal en español.
- NO uses frases coloquiales, emojis ni lenguaje informal.
- NO inventes hechos — solo mejora y estructura lo que el usuario ya escribió.
- Si el campo rawNote está vacío, genera una nota genérica apropiada para el tipo de observación indicado.
- Extensión máxima: 4-6 oraciones.
- Devuelve SOLO el texto de la nota, sin encabezados ni metadatos.
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
            HYGIENE: 'Higiene',
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
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.4,
            max_tokens: 300,
        });

        const note = completion.choices[0]?.message?.content?.trim() ?? '';
        return NextResponse.json({ success: true, note });
    } catch (error) {
        console.error('[zendi-note] Error:', error);
        return NextResponse.json({ success: false, error: 'Error generando nota' }, { status: 500 });
    }
}
