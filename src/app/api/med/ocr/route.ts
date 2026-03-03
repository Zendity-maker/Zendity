import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized. Solamente Admins pueden inyectar inventario OCR.' }, { status: 401 });
        }

        const body = await request.json();
        const { imageBase64 } = body;

        if (!imageBase64) {
            return NextResponse.json({ error: 'Falta la imagen codificada en Base64' }, { status: 400 });
        }

        // Llamada a Inteligencia Artificial Visual (GPT-4o)
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Eres el Jefe de Farmacia Clínica. Lee la siguiente imagen de una caja de medicinas o receta médica. Tu única tarea es devolver un JSON estricto con un arreglo 'medications' que contenga el nombre de cada droga encontrada, su 'dosage' (dosis, ej: 50mg) y su 'route' (vía, ej: ORAL). No digas NADA más. NUNCA respondas con comillas de Markdown (` ```json `)."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extrae las medicinas de esta imagen en el JSON requerido:" },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`,
                            },
                        }
                    ]
                }
            ],
            max_tokens: 500,
        });

        const aiText = response.choices[0].message.content?.trim();
        if (!aiText) {
            throw new Error("OpenAI no devolvió texto.");
        }

        // Limpiar backticks de markdown por si acaso GPT desobedece
        let cleanJsonStr = aiText;
        if (cleanJsonStr.startsWith("```json")) {
            cleanJsonStr = cleanJsonStr.replace("```json\n", "").replace("\n```", "").trim();
        } else if (cleanJsonStr.startsWith("```")) {
            cleanJsonStr = cleanJsonStr.replace("```", "").replace("```", "").trim();
        }

        const parsedData = JSON.parse(cleanJsonStr);
        const extractedMeds = parsedData.medications || [];

        // Por cada medicina encontrada, hacemos un UPSERT en NeonDB
        const results = [];
        for (const med of extractedMeds) {
            const cleanName = med.name.toUpperCase().trim();

            // Buscar si ya existe la medicina general (Ignorando dosis por simplicidad de B2B catálogo genérico)
            const existing = await prisma.medication.findFirst({
                where: {
                    name: cleanName
                }
            });

            if (!existing) {
                const newMed = await prisma.medication.create({
                    data: {
                        name: cleanName,
                        dosage: med.dosage,
                        route: med.route || "Oral",
                    }
                });
                results.push({ ...newMed, isNew: true });
            } else {
                results.push({ ...existing, isNew: false });
            }
        }

        return NextResponse.json({
            success: true,
            message: `OCR Finalizado. ${results.filter(r => r.isNew).length} pastillas nuevas añadidas al inventario local.`,
            medications: results
        }, { status: 200 });

    } catch (error: any) {
        console.error('OCR Error:', error);
        return NextResponse.json({ error: 'Error procesando la imagen OCR. Asegúrese de configurar OPENAI_API_KEY.' }, { status: 500 });
    }
}
