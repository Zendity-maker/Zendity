import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-expect-error
import pdfParse from 'pdf-parse';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow enough time for parsing large PDFs

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const hqId = formData.get('hqId') as string;
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const durationMins = formData.get('durationMins') as string;
        const bonusCompliance = formData.get('bonusCompliance') as string;

        if (!file || !hqId || !title || !description) {
            return NextResponse.json({ success: false, error: "Datos de formulario incompletos." }, { status: 400 });
        }

        // Convert file to Buffer for pdf-parse
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract Text from PDF
        const data = await pdfParse(buffer);
        let extractedText = data.text;

        // Limpiar el texto (remover saltos de linea excesivos)
        extractedText = extractedText.replace(/\n\s*\n/g, '\n').trim();

        if (!extractedText || extractedText.length < 50) {
             return NextResponse.json({ success: false, error: "No se pudo extraer texto suficiente del PDF." }, { status: 400 });
        }

        // Create Course in Prisma
        const course = await prisma.course.create({
            data: {
                headquartersId: hqId,
                title: title,
                description: description,
                durationMins: parseInt(durationMins || "15"),
                bonusCompliance: parseInt(bonusCompliance || "10"),
                content: extractedText,
                isActive: true
            }
        });

        return NextResponse.json({ success: true, course });

    } catch (error: any) {
        console.error("PDF Course Upload Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Error procesando el PDF" }, { status: 500 });
    }
}
