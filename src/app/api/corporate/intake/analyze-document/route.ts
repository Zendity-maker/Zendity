import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { DocumentCategory } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'NURSE'];

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy',
    timeout: 45_000,
});

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const CATEGORY_CONTEXT: Record<string, string> = {
    ID_CARD: 'tarjeta de identificación oficial (licencia, pasaporte, REAL ID)',
    INSURANCE_CARD: 'tarjeta de seguro médico privado (MCS, Triple-S, Humana, etc.)',
    MEDICARE_CARD: 'tarjeta Medicare o Medicare Advantage',
    MEDICAL_RECORD: 'expediente médico, historial clínico',
    HOSPITAL_DISCHARGE: 'resumen de alta hospitalaria',
    LAB_RESULT: 'resultado de laboratorio',
    PRESCRIPTION: 'receta médica activa',
    POWER_OF_ATTORNEY: 'poder legal / tutor',
    SOCIAL_WORK_NOTE: 'nota de trabajo social',
    OTHER: 'documento médico o administrativo',
};

/**
 * Sprint P.2 — Análisis Zendi de documentos de admisión.
 *
 * Sube base64 → Zendi extrae campos estructurados → se guarda solo el
 * análisis (ocrText + zendiAnalysis JSON). El archivo original NO se
 * persiste. El cliente puede aplicar las sugerencias al perfil del
 * residente en un segundo paso.
 *
 * Auth: DIRECTOR, ADMIN, NURSE. El residente debe estar en la sede
 * efectiva del invocador.
 *
 * PDF no soportado en v1 — OpenAI Vision solo acepta imágenes. El cliente
 * puede convertir PDF a imagen (canvas) antes de subir.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado para análisis de documentos' }, { status: 403 });
        }
        const invokerId = (session.user as any).id;
        const invokerHqId = (session.user as any).headquartersId;

        const body = await req.json().catch(() => ({}));
        const { patientId, category, title, fileBase64, fileType } = body as {
            patientId?: string;
            category?: string;
            title?: string;
            fileBase64?: string;
            fileType?: string;
        };

        if (!patientId || !category || !title || !fileBase64 || !fileType) {
            return NextResponse.json({
                success: false,
                error: 'Faltan campos requeridos (patientId, category, title, fileBase64, fileType)',
            }, { status: 400 });
        }

        if (!Object.values(DocumentCategory).includes(category as DocumentCategory)) {
            return NextResponse.json({
                success: false,
                error: `category inválida. Valores válidos: ${Object.values(DocumentCategory).join(', ')}`,
            }, { status: 400 });
        }

        // PDF u otros tipos no soportados por OpenAI Vision
        if (!SUPPORTED_IMAGE_TYPES.includes(fileType.toLowerCase())) {
            return NextResponse.json({
                success: false,
                error: `Tipo de archivo no soportado (${fileType}). Solo imágenes (JPEG/PNG/WEBP). Convierte PDFs a imagen primero.`,
            }, { status: 400 });
        }

        // Tenant check
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: { id: true, name: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        // Normalizar base64: aceptar con o sin el prefijo data:image/...
        const base64Payload = fileBase64.startsWith('data:')
            ? fileBase64
            : `data:${fileType};base64,${fileBase64}`;

        const categoryCtx = CATEGORY_CONTEXT[category] || CATEGORY_CONTEXT.OTHER;

        const systemPrompt = `Eres Zendi, asistente clínico de Zéndity. Analiza documentos médicos y de identidad de residentes de hogares de envejecientes en Puerto Rico. Responde SIEMPRE con JSON estricto válido (sin backticks, sin markdown). Si un campo no aplica o no se puede leer, usa null. No inventes datos — si no está en el documento, null.`;

        const userPrompt = `El residente es ${patient.name}. El documento adjunto es: ${categoryCtx} (titulado "${title}").

Extrae la información relevante. Responde SOLO JSON con esta forma exacta:
{
  "documentType": "string descriptivo del tipo real de documento",
  "patientName": "string o null",
  "dateOfBirth": "YYYY-MM-DD o null",
  "idNumber": "número ID/licencia o null",
  "insurancePlan": "nombre del plan o null",
  "policyNumber": "número de póliza o null",
  "medicareNumber": "número Medicare (MBI) o null",
  "medicaidNumber": "número Medicaid o null",
  "diagnoses": ["diagnóstico 1", "diagnóstico 2"],
  "medications": [
    { "name": "nombre", "dose": "50mg o null", "frequency": "BID o null", "scheduleTimes": ["08:00 AM", "08:00 PM"] }
  ],
  "allergies": ["alergia 1"],
  "primaryDoctor": "Dr. Nombre o null",
  "hospital": "nombre hospital o null",
  "notes": "resumen ejecutivo de 1-2 oraciones",
  "confidence": 0.0-1.0
}

Reglas:
- scheduleTimes: extraer horarios exactos si el documento los muestra (ej. "every 12 hours" → ["08:00 AM","08:00 PM"]). Si no, array vacío [].
- confidence: 0.9+ si el documento es nítido y completo; 0.5-0.8 si hay campos difíciles de leer; <0.5 si el documento está borroso o incompleto.
- diagnoses/medications/allergies: arrays vacíos si no aplica (nunca null).`;

        let parsed: any = null;
        let ocrText = '';
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt },
                            { type: 'image_url', image_url: { url: base64Payload } },
                        ],
                    },
                ],
                max_tokens: 1200,
                temperature: 0.1,
            });

            ocrText = completion.choices[0]?.message?.content?.trim() || '';
            if (!ocrText) {
                return NextResponse.json({
                    success: false,
                    error: 'Zendi no devolvió análisis — reintenta con mejor foto',
                }, { status: 502 });
            }

            // Limpiar markdown accidental y parsear
            let cleanJson = ocrText;
            if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
            if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
            if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
            parsed = JSON.parse(cleanJson.trim());
        } catch (aiErr: any) {
            console.error('[analyze-document] OpenAI error:', aiErr);
            return NextResponse.json({
                success: false,
                error: `Fallo en análisis Zendi: ${aiErr.message || 'error desconocido'}`,
            }, { status: 502 });
        }

        // Persistir SOLO el análisis — NO el archivo
        const document = await prisma.patientDocument.create({
            data: {
                headquartersId: invokerHqId,
                patientId: patient.id,
                uploadedById: invokerId,
                category: category as DocumentCategory,
                title,
                fileType,
                ocrText,
                zendiAnalysis: parsed,
                analyzedAt: new Date(),
            },
            select: {
                id: true, category: true, title: true, fileType: true,
                zendiAnalysis: true, analyzedAt: true, uploadedAt: true,
            },
        });

        // Sugerencias extraídas para el cliente (Apply to Profile)
        const suggestions = {
            patient: {
                idNumber: parsed.idNumber ?? undefined,
                dateOfBirth: parsed.dateOfBirth ?? undefined,
                insurancePlanName: parsed.insurancePlan ?? undefined,
                insurancePolicyNumber: parsed.policyNumber ?? undefined,
                medicareNumber: parsed.medicareNumber ?? undefined,
                medicaidNumber: parsed.medicaidNumber ?? undefined,
                preferredHospital: parsed.hospital ?? undefined,
            },
            clinical: {
                diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses : [],
                allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
                primaryDoctor: parsed.primaryDoctor ?? undefined,
            },
            medications: Array.isArray(parsed.medications) ? parsed.medications : [],
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
        };

        return NextResponse.json({
            success: true,
            document,
            suggestions,
            summary: parsed.notes || '',
        });
    } catch (error: any) {
        console.error('[analyze-document] error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error procesando documento',
        }, { status: 500 });
    }
}
