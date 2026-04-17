import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" });

const STAFF_ROLES = [
    'DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CAREGIVER',
    'SOCIAL_WORKER', 'THERAPIST', 'BEAUTY_SPECIALIST', 'KITCHEN',
    'MAINTENANCE', 'CLEANING', 'CLINICAL_DIRECTOR', 'HQ_OWNER'
];

const SYSTEM_PROMPT = `Eres Zendi, asistente clínico de Zéndity para hogares de envejecientes en Puerto Rico. Tu tarea es tomar notas cortas o informales escritas por el equipo de cuidado y convertirlas en texto clínico profesional para el Plan de Atención Individualizada (PAI) del residente.

Reglas:
- Mantén TODA la información del texto original
- Usa lenguaje clínico profesional en español
- Formato: párrafos claros, sin bullets a menos que el original los tenga
- No inventes información que no esté en el texto
- Máximo 3-4 oraciones por campo
- Tono: formal, objetivo, centrado en el residente
- Si el texto ya es profesional, devuélvelo mejorado levemente sin cambiar el sentido
- Responde SOLO con el texto mejorado, sin explicaciones, comillas, ni preámbulos`;

/**
 * POST /api/ai/zendi-pai
 * Body: { field: string, rawText: string, patientName: string }
 * Retorna: { success: true, improvedText: string }
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const role = (session.user as any).role;
        if (role === 'FAMILY' || !STAFF_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const { field, rawText, patientName } = await req.json();

        if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
            return NextResponse.json({ success: false, error: 'Texto vacío' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ success: false, error: 'OpenAI no configurado' }, { status: 501 });
        }

        const fieldLabel = field || 'campo del PAI';
        const pxName = patientName || 'el residente';

        const userPrompt = `Campo: ${fieldLabel}
Residente: ${pxName}
Texto original: ${rawText.trim()}

Mejora este texto para el PAI clínico:`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 350,
            temperature: 0.3,
        });

        const improvedText = completion.choices[0].message.content?.trim() || rawText;

        // Limpiar comillas wrapping por si acaso GPT las puso
        const cleaned = improvedText.replace(/^["“]|["”]$/g, '').trim();

        return NextResponse.json({ success: true, improvedText: cleaned });
    } catch (err: any) {
        console.error('[zendi-pai]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error generando mejora' }, { status: 500 });
    }
}
