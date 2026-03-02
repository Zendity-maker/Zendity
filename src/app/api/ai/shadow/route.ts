import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, rawText } = body;

        let formattedText = rawText;

        if (type === 'FORMAT_NOTES' && rawText) {
            // Simulador NLP Básico (Reglas de Negocio)
            const lowerText = rawText.toLowerCase();

            if (lowerText.includes("se cayó") && lowerText.includes("cabeza")) {
                formattedText = "Residente refiere evento de caída desde su propia altura con exposición a trauma craneal cerrado. Se documenta evento y se inicia protocolo neurológico.";
            }
            else if (lowerText.includes("se cayó") || lowerText.includes("caida") || lowerText.includes("caída")) {
                formattedText = "Residente presenta episodio de caída. Se asiste inmediatamente. Ausencia de deformidad evidente al momento de la evaluación inicial. Constantes en monitor.";
            }
            else if (lowerText.includes("no quiere comer") || lowerText.includes("dejó la comida")) {
                formattedText = "Rechazo ingesta alimentaria PO (Per Os) en el turno actual. Se orienta verbalmente sin éxito. Notificar a Nutricionista.";
            }
            else if (lowerText.includes("le duele") || lowerText.includes("dolor")) {
                formattedText = `El paciente refiere experimentar episodio de dolor localizado. Escala de dolor reportada subjetivamente. Se monitoriza y se consulta PRN.`;
            }
            else {
                // Formatting general
                formattedText = rawText.charAt(0).toUpperCase() + rawText.slice(1) + ".";
                formattedText = formattedText.replace("el don", "el residente").replace("la doña", "la residente");
            }
        }

        return NextResponse.json({ success: true, formattedText });
    } catch (error) {
        console.error("Shadow AI Error:", error);
        return NextResponse.json({ success: false, error: "Agente de IA Inoperativo" }, { status: 500 });
    }
}
