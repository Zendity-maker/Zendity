import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * HIPAA — Zendi AI PAI Builder v2
 * Genera PAI con datos clínicos reales: vitales, adherencia meds, UPPs, caídas,
 * alertas clínicas, PAI anterior aprobado + versión familiar en lenguaje cálido.
 */
const ALLOWED_ROLES = ['NURSE', 'DIRECTOR', 'ADMIN'];
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        if (!ALLOWED_ROLES.includes((session.user as any).role)) return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        const invokerHqId = (session.user as any).headquartersId;

        const resolvedParams = await params;
        const patientId = resolvedParams.id;
        if (!patientId) return NextResponse.json({ success: false, error: 'ID de paciente requerido.' }, { status: 400 });

        // ── 1. Datos base del residente ──────────────────────────────────────────
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                intakeData: true,
                medications: { include: { medication: true } }
            }
        });

        if (!patient) return NextResponse.json({ success: false, error: 'Paciente no encontrado.' }, { status: 404 });
        if (patient.headquartersId !== invokerHqId) return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });

        // ── 2. Signos vitales — últimas 4 semanas ─────────────────────────────
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const vitals = await prisma.vitalSigns.findMany({
            where: { patientId, createdAt: { gte: fourWeeksAgo } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                systolic: true, diastolic: true, heartRate: true,
                temperature: true, spo2: true,
                createdAt: true
            }
        });

        // ── 3. Adherencia a medicamentos (últimos 30 días) ────────────────────
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const patientMeds = await prisma.patientMedication.findMany({
            where: { patientId, isActive: true },
            include: {
                medication: { select: { name: true } },
                administrations: {
                    where: { administeredAt: { gte: thirtyDaysAgo } },
                    select: { status: true }
                }
            }
        });

        const adherenceLines = patientMeds.map(pm => {
            const total = pm.administrations.length;
            const administered = pm.administrations.filter((a: any) => a.status === 'ADMINISTERED').length;
            const pct = total > 0 ? Math.round((administered / total) * 100) : null;
            return `${pm.medication.name}: ${pct !== null ? `${pct}% adherencia (${administered}/${total})` : 'sin registros'}`;
        });

        // ── 4. UPPs activas ───────────────────────────────────────────────────
        const upps = await prisma.pressureUlcer.findMany({
            where: { patientId, status: { not: 'RESOLVED' } },
            select: { bodyLocation: true, stage: true, status: true }
        });

        // ── 5. Caídas — últimos 90 días ───────────────────────────────────────
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const falls = await prisma.fallIncident.findMany({
            where: { patientId, incidentDate: { gte: ninetyDaysAgo } },
            select: { notes: true, severity: true, location: true, incidentDate: true },
            orderBy: { incidentDate: 'desc' },
            take: 10
        });

        // ── 6. Alertas clínicas del DailyLog (30 días) ────────────────────────
        const clinicalAlerts = await prisma.dailyLog.findMany({
            where: { patientId, isClinicalAlert: true, createdAt: { gte: thirtyDaysAgo } },
            select: { notes: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        // ── 7. PAI anterior aprobado (si existe) ─────────────────────────────
        const previousPai = await prisma.lifePlan.findFirst({
            where: { patientId, status: 'APPROVED' },
            orderBy: { approvedAt: 'desc' },
            select: { clinicalSummary: true, risks: true, goals: true, approvedAt: true, type: true }
        });

        // ── 8. Construir contexto clínico completo ────────────────────────────
        const vitalsText = vitals.length > 0
            ? vitals.slice(0, 5).map(v =>
                `${new Date(v.createdAt).toLocaleDateString('es-PR')}: TA ${v.systolic || '?'}/${v.diastolic || '?'}, FC ${v.heartRate || '?'}, SpO2 ${v.spo2 || '?'}%, T° ${v.temperature || '?'}°F`
            ).join(' | ')
            : 'Sin vitales recientes';

        const uppText = upps.length > 0
            ? upps.map(u => `${u.bodyLocation} Estadio ${u.stage} (${u.status})`).join('; ')
            : 'Sin UPPs activas';

        const fallsText = falls.length > 0
            ? `${falls.length} caída(s) en 90 días. Última: ${falls[0].location} — ${falls[0].notes?.slice(0, 80) || ''} — Severidad: ${falls[0].severity}`
            : 'Sin caídas registradas en 90 días';

        const alertsText = clinicalAlerts.length > 0
            ? clinicalAlerts.slice(0, 5).map(a => `• ${a.notes?.slice(0, 100)}`).join('\n')
            : 'Sin alertas clínicas recientes';

        const clinicalContext = `
Nombre: ${patient.name}
Habitación: ${patient.roomNumber || 'No asignada'}
Edad: ${patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.15576e10) + ' años' : 'No registrada'}
Diagnósticos: ${patient.intakeData?.diagnoses || 'No registrados'}
Historial Médico: ${patient.intakeData?.medicalHistory || 'No registrado'}
Alergias: ${patient.intakeData?.allergies || 'Ninguna'}
Medicamentos activos: ${patient.medications.map(m => m.medication.name).join(', ') || 'Ninguno'}

── DATOS CLÍNICOS RECIENTES ──
Adherencia medicamentos (30d): ${adherenceLines.length > 0 ? adherenceLines.join(' | ') : 'Sin datos'}
Signos vitales recientes: ${vitalsText}
Úlceras por presión activas: ${uppText}
Caídas recientes (90d): ${fallsText}
Alertas clínicas DailyLog (30d):
${alertsText}

── PAI ANTERIOR APROBADO ──
${previousPai
    ? `Tipo: ${previousPai.type} | Aprobado: ${new Date(previousPai.approvedAt!).toLocaleDateString('es-PR')}\nResumen previo: ${previousPai.clinicalSummary?.slice(0, 200)}`
    : 'No existe PAI previo aprobado — este es el INICIAL'}
        `.trim();

        // ── 9. Generar PAI clínico estructurado con Zendi AI ─────────────────
        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            system: 'Eres el Director Médico de una residencia geriátrica. Redactas Planes Asistenciales Individualizados (PAI) de altísima calidad clínica y compasiva. Analiza todos los datos clínicos proporcionados — incluyendo signos vitales, adherencia, UPPs, caídas y alertas — para generar un PAI preciso y actualizado. Sé específico y basa CADA riesgo y objetivo en los datos reales provistos.',
            prompt: `Analiza el siguiente historial clínico COMPLETO con datos reales recientes y genera un PAI estructurado. Basa cada riesgo y objetivo en los datos reales provistos (vitales, caídas, UPPs, adherencia, alertas).\n\n${clinicalContext}`,
            schema: z.object({
                clinicalSummary: z.string().describe("Párrafo resumen compasivo de su condición actual, incluyendo datos clínicos recientes relevantes."),
                cognitiveLevel: z.string().describe("Estado cognitivo actual (Ej: 'Orientado en 3 esferas', 'Demencia moderada con desorientación temporal')."),
                mobility: z.string().describe("Estado de movilidad funcional actual."),
                continence: z.string().describe("Estado de continencia urinaria y fecal."),
                dietDetails: z.string().describe("Dieta específica requerida según condición."),
                interdisciplinarySummary: z.string().describe("Directrices de soporte global para el equipo interdisciplinario."),
                familyEducation: z.string().describe("Puntos clave que Trabajo Social debe educar a los familiares."),
                revisionCriteria: z.string().describe("Criterios clínicos de alerta que obligarían a revisar este PAI (hospitalización, caída con trauma, cambio de condición)."),
                risks: z.array(z.object({
                    area: z.string(),
                    finding: z.string(),
                    priority: z.enum(['Alta', 'Media', 'Baja'])
                })).min(3).max(6).describe("Matriz de riesgos identificados basados en datos reales. Priority: 'Alta', 'Media' o 'Baja'."),
                goals: z.array(z.object({
                    objective: z.string(),
                    action: z.string(),
                    responsible: z.string(),
                    frequency: z.string(),
                    indicator: z.string()
                })).min(3).max(6).describe("Matriz de objetivos/intervenciones para mitigar los riesgos identificados.")
            })
        });

        // ── 10. Generar versión familiar (lenguaje cálido, máx 400 palabras) ──
        const { text: familyVersion } = await generateText({
            model: openai('gpt-4o-mini'),
            system: 'Eres un Trabajador Social especializado en comunicación familiar en residencias geriátricas. Tu tarea es traducir un Plan Asistencial clínico a un mensaje cálido, humano y comprensible para la familia. Usa un tono empático y positivo. NUNCA uses jerga médica sin explicarla. Máximo 400 palabras.',
            prompt: `Traduce este Plan Asistencial al lenguaje familiar cálido y comprensible:

Residente: ${patient.name}
Resumen clínico: ${object.clinicalSummary}
Nivel cognitivo: ${object.cognitiveLevel}
Movilidad: ${object.mobility}
Dieta: ${object.dietDetails}
Riesgos principales: ${object.risks.map(r => `${r.area} (${r.priority}): ${r.finding}`).join('; ')}
Objetivos principales: ${object.goals.map(g => `${g.objective}: ${g.action}`).join('; ')}
Educación familiar: ${object.familyEducation}

Escribe una carta a la familia explicando el plan de cuidado de su ser querido de forma cálida y tranquilizadora. Incluye: cómo está hoy, qué prioridades tiene el equipo, y cómo la familia puede apoyar.`
        });

        return NextResponse.json({
            success: true,
            aiGeneratedPai: object,
            familyVersion
        });

    } catch (error) {
        console.error("Zendi AI PAI Builder v2 Error:", error);
        return NextResponse.json({ success: false, error: 'Hubo un fallo generando la inteligencia clínica del PAI.' }, { status: 500 });
    }
}
