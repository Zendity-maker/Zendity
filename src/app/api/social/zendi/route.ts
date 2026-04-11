import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy',
});

export const maxDuration = 60;

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { patientId } = await req.json();
        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        const hqId = (session.user as any).headquartersId;

        // Fetch all resident data in parallel
        const [patient, notes, tasks, benefits, visits, familyVisits] = await Promise.all([
            prisma.patient.findUnique({
                where: { id: patientId },
                include: {
                    familyMembers: { select: { name: true, email: true, accessLevel: true } },
                    vitalSigns: { orderBy: { createdAt: 'desc' }, take: 3 },
                    dailyLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
                    incidents: { orderBy: { reportedAt: 'desc' }, take: 3 },
                },
            }),
            prisma.socialWorkNote.findMany({
                where: { patientId, headquartersId: hqId },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma.socialWorkTask.findMany({
                where: { patientId, headquartersId: hqId },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma.socialWorkBenefit.findMany({
                where: { patientId, headquartersId: hqId },
            }),
            prisma.specialistVisit.findMany({
                where: { patientId, headquartersId: hqId },
                orderBy: { visitDate: 'desc' },
                take: 5,
            }),
            prisma.familyVisit.findMany({
                where: { patientId },
                orderBy: { visitedAt: 'desc' },
                take: 5,
            }),
        ]);

        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        const residentProfile = JSON.stringify({
            patient: {
                name: patient.name,
                dateOfBirth: patient.dateOfBirth,
                status: patient.status,
                room: patient.roomNumber,
                diet: patient.diet,
                fallRisk: patient.downtonRisk,
                ulcerRisk: patient.nortonRisk,
                familyMembers: patient.familyMembers,
                recentVitals: patient.vitalSigns,
                recentLogs: patient.dailyLogs,
                recentIncidents: patient.incidents,
            },
            socialNotes: notes.map(n => ({ content: n.content, category: n.category, date: n.createdAt })),
            pendingTasks: tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS'),
            completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
            benefits: benefits.map(b => ({ type: b.type, status: b.status, expiration: b.expirationDate })),
            specialistVisits: visits.map(v => ({ type: v.specialistType, date: v.visitDate, nextDate: v.nextVisitDate })),
            familyVisits: familyVisits.map(v => ({ date: v.visitedAt })),
        });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Eres Zendi, el asistente clinico y social de Zendity. Estas ayudando a una trabajadora social en un hogar de envejecientes en Puerto Rico. Analiza los datos del residente y genera sugerencias concretas y accionables.

Responde SOLO en JSON con esta estructura:
{
  "suggestions": [
    {
      "type": "TASK" | "ALERT" | "INFO",
      "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT",
      "title": "string",
      "description": "string",
      "category": "FAMILY" | "BENEFITS" | "FOLLOW_UP" | "DOCUMENT" | "APPOINTMENT"
    }
  ],
  "summary": "string (resumen breve del estado social del residente en espanol)"
}

Considera: ultima visita familiar, beneficios por vencer, tareas pendientes, cambios clinicos recientes, tiempo sin visita de especialistas. Genera entre 2 y 6 sugerencias relevantes. Si no hay data suficiente, sugiere recopilar informacion faltante.`,
                },
                {
                    role: 'user',
                    content: `Analiza el perfil social de este residente:\n\n${residentProfile}`,
                },
            ],
        });

        const rawContent = completion.choices[0]?.message?.content || '{}';
        let parsed;
        try {
            parsed = JSON.parse(rawContent);
        } catch {
            parsed = { suggestions: [], summary: 'No se pudo analizar el perfil.' };
        }

        return NextResponse.json({
            success: true,
            suggestions: parsed.suggestions || [],
            summary: parsed.summary || '',
        });
    } catch (error) {
        console.error('Zendi Social Analysis Error:', error);
        return NextResponse.json({ success: false, error: 'Error en analisis Zendi' }, { status: 500 });
    }
}
