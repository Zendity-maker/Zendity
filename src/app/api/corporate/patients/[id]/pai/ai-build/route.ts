import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * HIPAA — Este endpoint recibe diagnósticos, medicamentos, alergias e
 * historial médico del residente y los envía a GPT-4o para generar el
 * PAI. Antes estaba sin auth. Ahora restringido a personal clínico con
 * tenant check.
 */
const ALLOWED_ROLES = ['NURSE', 'DIRECTOR', 'ADMIN'];

// Aumentar timeout máximo para Vercel Serverless (Opcional, pero recomendado para LLMs)
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerHqId = (session.user as any).headquartersId;

        const resolvedParams = await params;
        const patientId = resolvedParams.id;

        if (!patientId) {
            return NextResponse.json({ success: false, error: 'ID de paciente requerido.' }, { status: 400 });
        }

        // 1. Recopilar contexto clínico exhaustivo del paciente
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                intakeData: true,
                medications: {
                    include: { medication: true }
                }
            }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: 'Paciente no encontrado.' }, { status: 404 });
        }

        // Tenant check HIPAA
        if (patient.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        const clinicalContext = `
            Nombre: ${patient.name}
            Habitación: ${patient.roomNumber || 'No asignada'}
            Diagnósticos: ${patient.intakeData?.diagnoses || 'No registrados'}
            Historial Médico: ${patient.intakeData?.medicalHistory || 'No registrado'}
            Alergias: ${patient.intakeData?.allergies || 'Ninguna'}
            Medicamentos actuales: ${patient.medications.map(m => m.medication.name).join(', ')}
        `;

        // 2. Ejecutar Zendi AI (GPT-4o / GPT-4o-mini) para sintetizar el nuevo esquema JSON PAI
        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            system: 'Eres un Director Médico experto en geriatría que redacta Planes Asistenciales Individualizados (PAI) de altísima calidad clínica y compasiva. Analiza el historial médico proporcionado y genera matrices estructuradas de riesgos y objetivos.',
            prompt: `Analiza el siguiente historial clínico de un residente geriátrico y genera un PAI estructurado. Debes devolver la información estrictamente en el esquema JSON solicitado. No inventes condiciones irreales, básate rigurosamente en los diagnósticos provistos (Ej. Si tiene demencia, incluye riesgo de fuga/caída; si tiene disfagia, dieta puré).\n\nHistorial del Residente:\n${clinicalContext}`,
            schema: z.object({
                clinicalSummary: z.string().describe("Un párrafo resumen limpio, compasivo y directo de sus diagnósticos y su condición funcional actual."),
                cognitiveLevel: z.string().describe("Descripción corta de su nivel cognitivo (Ej. 'Orientado en 3 esferas', 'Demencia moderada con desorientación temporal')."),
                mobility: z.string().describe("Estado de movilidad (Ej. 'Independiente', 'Requiere andador', 'Asistencia para transferencias')."),
                continence: z.string().describe("Estado de continencia urinaria y fecal (Ej. 'Continente', 'Uso de pañal permanente')."),
                dietDetails: z.string().describe("Dieta específica requerida (Ej. 'Regular', 'Diabética (Baja en Azúcar)', 'Puré por riesgo de aspiración')."),
                interdisciplinarySummary: z.string().describe("Resumen de directrices de soporte global para el equipo de cuidadores."),
                familyEducation: z.string().describe("Puntos clave que Trabajo Social debe educar a los familiares sobre su condición."),
                revisionCriteria: z.string().describe("Criterios clínicos de alerta temprana que obligarían a revisar este PAI antes de tiempo (Ej. 'Hospitalizaciones, caídas con trauma')."),
                risks: z.array(z.object({
                    area: z.string(),
                    finding: z.string(),
                    priority: z.string()
                })).describe("Matriz de entre 3 a 5 riesgos identificados (Ej. Área: Caídas, Fuga, Piel, Cardíaco). Priority debe ser 'Alta', 'Media' o 'Baja'."),
                goals: z.array(z.object({
                    objective: z.string(),
                    action: z.string(),
                    responsible: z.string(),
                    frequency: z.string(),
                    indicator: z.string()
                })).describe("Matriz de entre 3 a 5 objetivos/intervenciones estructuradas para mitigar los riesgos. Ej. Prevención UPPs -> Cambios Posturales -> Enfermería -> Cada 2 horas.")
            })
        });

        // 3. Devolver directamente el objeto JSON construido para que el Frontend lo renderice
        // No guardamos en DB inmediatamente para permitir que el Director Médico lo revise y edite antes de "Guardar".
        return NextResponse.json({ success: true, aiGeneratedPai: object });

    } catch (error) {
        console.error("Zendi AI PAI Builder Error:", error);
        return NextResponse.json({ success: false, error: 'Hubo un fallo generando la inteligencia clínica del PAI.' }, { status: 500 });
    }
}
