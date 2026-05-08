import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/admin/pai/batch-generate
 *
 * Genera PAIs con IA para todos los residentes ACTIVOS de la sede.
 * Solo accesible para DIRECTOR y ADMIN.
 *
 * Procesa un residente a la vez para no sobrecargar OpenAI.
 * Actualiza el LifePlan DRAFT más reciente de cada residente.
 * Si el residente no tiene LifePlan, crea uno nuevo.
 *
 * Body opcional: { patientIds: string[] } → limitar a un subconjunto.
 */
export const maxDuration = 300; // 5 minutos (Vercel Pro/Edge)
export const dynamic = 'force-dynamic';

const PAI_SCHEMA = z.object({
    clinicalSummary: z.string(),
    cognitiveLevel: z.string(),
    mobility: z.string(),
    continence: z.string(),
    dietDetails: z.string(),
    interdisciplinarySummary: z.string(),
    familyEducation: z.string(),
    revisionCriteria: z.string(),
    risks: z.array(z.object({
        area: z.string(),
        finding: z.string(),
        priority: z.enum(['Alta', 'Media', 'Baja'])
    })).min(3).max(6),
    goals: z.array(z.object({
        objective: z.string(),
        action: z.string(),
        responsible: z.string(),
        frequency: z.string(),
        indicator: z.string()
    })).min(3).max(6)
});

async function buildClinicalContext(patientId: string): Promise<{ context: string; patientName: string } | null> {
    const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
            intakeData: true,
            medications: { include: { medication: true } }
        }
    });
    if (!patient) return null;

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [vitals, patientMeds, upps, falls, clinicalAlerts, previousPai] = await Promise.all([
        prisma.vitalSigns.findMany({
            where: { patientId, createdAt: { gte: fourWeeksAgo } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { systolic: true, diastolic: true, heartRate: true, temperature: true, spo2: true, createdAt: true }
        }),
        prisma.patientMedication.findMany({
            where: { patientId, isActive: true },
            include: {
                medication: { select: { name: true } },
                administrations: {
                    where: { administeredAt: { gte: thirtyDaysAgo } },
                    select: { status: true }
                }
            }
        }),
        prisma.pressureUlcer.findMany({
            where: { patientId, status: { not: 'RESOLVED' } },
            select: { bodyLocation: true, stage: true, status: true }
        }),
        prisma.fallIncident.findMany({
            where: { patientId, incidentDate: { gte: ninetyDaysAgo } },
            select: { notes: true, severity: true, location: true, incidentDate: true },
            orderBy: { incidentDate: 'desc' },
            take: 10
        }),
        prisma.dailyLog.findMany({
            where: { patientId, isClinicalAlert: true, createdAt: { gte: thirtyDaysAgo } },
            select: { notes: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10
        }),
        prisma.lifePlan.findFirst({
            where: { patientId, status: 'APPROVED' },
            orderBy: { approvedAt: 'desc' },
            select: { clinicalSummary: true, risks: true, goals: true, approvedAt: true, type: true }
        })
    ]);

    const adherenceLines = patientMeds.map(pm => {
        const total = pm.administrations.length;
        const administered = pm.administrations.filter((a: any) => a.status === 'ADMINISTERED').length;
        const pct = total > 0 ? Math.round((administered / total) * 100) : null;
        return `${pm.medication.name}: ${pct !== null ? `${pct}% adherencia (${administered}/${total})` : 'sin registros'}`;
    });

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

    const age = patient.dateOfBirth
        ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.15576e10)
        : null;

    const context = `
Nombre: ${patient.name}
Habitación: ${patient.roomNumber || 'No asignada'}
Edad: ${age !== null ? `${age} años` : 'No registrada'}
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

    return { context, patientName: patient.name };
}

async function generatePaiForPatient(patientId: string): Promise<{
    success: boolean;
    patientId: string;
    patientName?: string;
    lifePlanId?: string;
    error?: string;
}> {
    try {
        const ctxResult = await buildClinicalContext(patientId);
        if (!ctxResult) return { success: false, patientId, error: 'Paciente no encontrado' };

        const { context, patientName } = ctxResult;

        // Generar PAI clínico estructurado
        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            system: 'Eres el Director Médico de una residencia geriátrica. Redactas Planes Asistenciales Individualizados (PAI) de altísima calidad clínica y compasiva. Analiza todos los datos clínicos proporcionados — incluyendo signos vitales, adherencia, UPPs, caídas y alertas — para generar un PAI preciso y actualizado. Sé específico y basa CADA riesgo y objetivo en los datos reales provistos.',
            prompt: `Analiza el siguiente historial clínico COMPLETO con datos reales recientes y genera un PAI estructurado. Basa cada riesgo y objetivo en los datos reales provistos (vitales, caídas, UPPs, adherencia, alertas).\n\n${context}`,
            schema: PAI_SCHEMA
        });

        // Generar versión familiar
        const { text: familyVersion } = await generateText({
            model: openai('gpt-4o-mini'),
            system: 'Eres un Trabajador Social especializado en comunicación familiar en residencias geriátricas. Tu tarea es traducir un Plan Asistencial clínico a un mensaje cálido, humano y comprensible para la familia. Usa un tono empático y positivo. NUNCA uses jerga médica sin explicarla. Máximo 400 palabras.',
            prompt: `Traduce este Plan Asistencial al lenguaje familiar cálido y comprensible:

Residente: ${patientName}
Resumen clínico: ${object.clinicalSummary}
Nivel cognitivo: ${object.cognitiveLevel}
Movilidad: ${object.mobility}
Dieta: ${object.dietDetails}
Riesgos principales: ${object.risks.map(r => `${r.area} (${r.priority}): ${r.finding}`).join('; ')}
Objetivos principales: ${object.goals.map(g => `${g.objective}: ${g.action}`).join('; ')}
Educación familiar: ${object.familyEducation}

Escribe una carta a la familia explicando el plan de cuidado de su ser querido de forma cálida y tranquilizadora.`
        });

        // Buscar el LifePlan DRAFT más reciente para este paciente
        const existingDraft = await prisma.lifePlan.findFirst({
            where: { patientId, status: 'DRAFT' },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
        });

        const paiData = {
            patientId,
            type: 'INITIAL' as const,
            clinicalSummary: object.clinicalSummary,
            cognitiveLevel: object.cognitiveLevel,
            mobility: object.mobility,
            continence: object.continence,
            dietDetails: object.dietDetails,
            interdisciplinarySummary: object.interdisciplinarySummary,
            familyEducation: object.familyEducation,
            revisionCriteria: object.revisionCriteria,
            risks: object.risks as any,
            goals: object.goals as any,
            familyVersion,
            status: 'DRAFT' as const,
        };

        let lifePlan: any;
        if (existingDraft) {
            lifePlan = await prisma.lifePlan.update({
                where: { id: existingDraft.id },
                data: paiData
            });
        } else {
            lifePlan = await prisma.lifePlan.create({ data: paiData });
        }

        return { success: true, patientId, patientName, lifePlanId: lifePlan.id };

    } catch (err: any) {
        console.error(`[batch-pai] Error para ${patientId}:`, err);
        return { success: false, patientId, error: err.message };
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!['DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo DIRECTOR o ADMIN pueden ejecutar generación masiva de PAIs' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        let body: any = {};
        try { body = await req.json(); } catch { /* body vacío */ }

        // Obtener pacientes activos de la sede (o subconjunto indicado)
        let patientIds: string[];
        if (body.patientIds && Array.isArray(body.patientIds) && body.patientIds.length > 0) {
            patientIds = body.patientIds;
        } else {
            const patients = await prisma.patient.findMany({
                where: { headquartersId: hqId, status: 'ACTIVE' },
                select: { id: true },
                orderBy: { name: 'asc' }
            });
            patientIds = patients.map(p => p.id);
        }

        if (patientIds.length === 0) {
            return NextResponse.json({ success: true, message: 'No hay residentes activos', results: [] });
        }

        // Procesar secuencialmente para no saturar OpenAI
        const results: any[] = [];
        let successCount = 0;
        let errorCount = 0;

        for (const patientId of patientIds) {
            const result = await generatePaiForPatient(patientId);
            results.push(result);
            if (result.success) successCount++;
            else errorCount++;
            // Pequeña pausa entre llamadas para no saturar rate limits
            await new Promise(r => setTimeout(r, 500));
        }

        return NextResponse.json({
            success: true,
            total: patientIds.length,
            successCount,
            errorCount,
            results,
            message: `${successCount} PAIs generados exitosamente. ${errorCount > 0 ? `${errorCount} fallaron.` : ''}`
        });

    } catch (err: any) {
        console.error('[batch-pai]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
