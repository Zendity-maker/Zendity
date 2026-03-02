import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        // En un MVP Real, aquí se usaría Tesseract.js o Google Cloud Vision API.
        // Recibiríamos formData con el 'file'. 
        // Simularemos un tiempo de procesamiento OCR
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Texto duro extraído (Simulación de lo que leyó la IA en la foto)
        const extractedText = "RX: Lisinopril 20mg PO QD mñn Dr. Smith";

        // NLP Translation (Simulación de IA que traduce al formato Zendity)
        const parsedMedication = {
            name: "Lisinopril",
            dosage: "20mg",
            instructions: "Dar 1 tableta por la boca 1 vez al día, en la mañana (PO QD).",
            scheduleTime: "08:00 AM",
            rawText: extractedText
        };

        return NextResponse.json({ success: true, parsedMedication });
    } catch (error) {
        console.error("OCR API Error:", error);
        return NextResponse.json({ success: false, error: "Fallo en motor de lectura óptica" }, { status: 500 });
    }
}
