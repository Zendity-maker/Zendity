import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employeeName, employeeRole, supervisorName, type, briefing } = body;

        if (!employeeName || !supervisorName || !type || !briefing) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos para la generación AI.' }, { status: 400 });
        }

        const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

        const prompt = `Actúa como Director de Recursos Humanos. Se requiere redactar un documento formal disciplinario oficial listo para firmar.

EMPLEADO INVOLUCRADO: ${employeeName} (${employeeRole || "Staff"})
SUPERVISOR QUE REPORTA: ${supervisorName}
FECHA DEL INCIDENTE/REPORTE: ${dateStr}
TIPO DE ACCIÓN DISCIPLINARIA: ${type === 'WARNING' ? 'Amonestación Escrita' : type === 'SUSPENSION' ? 'Suspensión Temporal' : 'Despido Justificado'}

HECHOS DECLARADOS POR EL SUPERVISOR:
"${briefing}"

INSTRUCCIONES:
1. Redacta el cuerpo completo del documento disciplinario en tono profesional, legal y objetivo.
2. NO uses ningún marcador de posición como [Nombre del Empleado], {insertar fecha}, etc. DEBES usar los nombres exactos y la fecha provistos arriba.
3. El documento debe exponer claramente la falta cometida, las expectativas de mejora y las consecuencias futuras.
4. Finaliza el documento indicando que la firma del empleado es requerida para confirmar que ha sido notificado, no necesariamente que está de acuerdo.
5. NO incluyas líneas para firma ("Firma: ______") al final, ya que se firmará digitalmente en el sistema.

Devuelve EXCLUSIVAMENTE el texto del documento.`;

        const { text } = await generateText({
            model: openai('gpt-4o'),
            system: "Eres un experto en Recursos Humanos especializado en leyes laborales y redacción de actas disciplinarias formales en español.",
            prompt: prompt,
            temperature: 0.3, // Bajo para mantener un estilo formal e inamovible
        });

        return NextResponse.json({ success: true, generatedText: text });
    } catch (error: any) {
        console.error("Error generating HR incident with AI:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
