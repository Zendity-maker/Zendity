import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const HR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const SEVERITY_LABEL: Record<string, string> = {
    OBSERVATION: 'Observación (sin penalidad)',
    WARNING: 'Amonestación Escrita (-5 pts)',
    SUSPENSION: 'Suspensión Temporal (-15 pts)',
    TERMINATION: 'Despido Justificado',
};
const CATEGORY_LABEL: Record<string, string> = {
    PUNCTUALITY: 'Puntualidad',
    PATIENT_CARE: 'Cuidado del residente',
    HYGIENE: 'Higiene',
    BEHAVIOR: 'Conducta',
    DOCUMENTATION: 'Documentación',
    UNIFORM: 'Uniforme',
    OTHER: 'Otro',
};

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        if (!HR_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const body = await req.json();
        // Nueva shape Sprint C: { category, severity, context }
        // Legacy shape (retro-compat): { employeeName, employeeRole, supervisorName, type, briefing }
        const isSprintC = body.category || body.severity || body.context;

        let prompt: string;
        let system: string;

        if (isSprintC) {
            const category = body.category || 'OTHER';
            const severity = body.severity || 'OBSERVATION';
            const context = body.context || '';
            if (!context || String(context).trim().length < 3) {
                return NextResponse.json({ success: false, error: 'Falta el contexto para generar' }, { status: 400 });
            }

            system = 'Eres un asistente de RR.HH. profesional para un hogar de envejecientes en Puerto Rico.';
            prompt = `Redacta una observación formal en español para un empleado basada en:
Categoría: ${CATEGORY_LABEL[category] || category}
Severidad: ${SEVERITY_LABEL[severity] || severity}
Contexto: ${context}

La observación debe ser:
- Profesional y respetuosa
- Clara y específica
- Máximo 3 párrafos
- Sin mencionar nombres

Devuelve exclusivamente el texto, sin saludos ni preámbulos.`;
        } else {
            // Legacy path
            const { employeeName, employeeRole, supervisorName, type, briefing } = body;
            if (!employeeName || !supervisorName || !type || !briefing) {
                return NextResponse.json({ success: false, error: 'Faltan datos requeridos para la generación AI.' }, { status: 400 });
            }
            const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

            system = 'Eres un experto en Recursos Humanos especializado en leyes laborales y redacción de actas disciplinarias formales en español.';
            prompt = `Actúa como Director de Recursos Humanos. Se requiere redactar un documento formal disciplinario oficial listo para firmar.

### PARÁMETROS DEL DOCUMENTO
- **EMPLEADO INVOLUCRADO:** ${employeeName} (${employeeRole || "Staff"})
- **SUPERVISOR QUE REPORTA:** ${supervisorName}
- **FECHA DEL INCIDENTE/REPORTE:** ${dateStr}
- **TIPO DE ACCIÓN DISCIPLINARIA:** ${type === 'WARNING' ? 'Amonestación Escrita' : type === 'SUSPENSION' ? 'Suspensión Temporal' : 'Despido Justificado'}

### HECHOS DECLARADOS POR EL SUPERVISOR
"${briefing}"

### INSTRUCCIONES ESTRICTAS (NO DESVIARSE)
1. El documento DEBE comenzar con un "MEMORANDO OFICIAL" que incluya textualmente la Fecha, De (Supervisor), Para (Empleado) y Asunto. NO uses marcadores de posición. Usa los nombres exactos provistos.
2. Redacta el cuerpo completo en tono corporativo, legal y profesional.
3. El documento debe exponer claramente la falta, las expectativas de mejora y las consecuencias futuras.
4. Finaliza indicando que la firma digital del empleado sirve como acuse de recibo.
5. NO incluyas líneas de firma ("Firma: ______").

Devuelve EXCLUSIVAMENTE el texto del documento, sin preámbulos.`;
        }

        const { text } = await generateText({
            model: openai('gpt-4o'),
            system,
            prompt,
            temperature: 0.3,
        });

        return NextResponse.json({ success: true, generatedText: text });
    } catch (error: any) {
        console.error("Error generating HR incident with AI:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
