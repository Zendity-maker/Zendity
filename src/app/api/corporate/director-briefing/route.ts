import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';
import { TicketStatus } from '@prisma/client';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// Rutas de navegación disponibles para cada categoría de alerta
const BULLET_LINKS: Record<string, string> = {
    vitals:     '/corporate/medical/patients',
    handovers:  '/corporate/medical/handovers',
    emar:       '/corporate/medical/emar',
    upps:       '/corporate/medical/upp-dashboard',
    falls:      '/corporate/medical/fall-risk',
    triage:     '/corporate/triage',
    incidents:  '/corporate/hr',
    meals:      '/care/supervisor',
    coverage:   '/care/supervisor',
    default:    '/corporate',
};

interface BriefingBullet {
    priority: Priority;
    title: string;
    description: string;
    action: string;
    link?: string;   // ruta interna a la que navega el botón de acción
}

// Las temperaturas pueden estar guardadas en °F (>50) o °C (<50).
// Normalizar a °C antes de comparar para evitar falsos positivos.
function normalizeTempC(temp: number): number {
    return temp > 50 ? (temp - 32) * 5 / 9 : temp;
}

function isAbnormalVital(v: {
    systolic: number; diastolic: number; heartRate: number; temperature: number; spo2: number | null;
}): boolean {
    if (v.spo2 !== null && v.spo2 < 94) return true;
    if (v.systolic > 140 || v.systolic < 90) return true;
    if (v.diastolic > 90 || v.diastolic < 60) return true;
    if (v.heartRate < 50 || v.heartRate > 100) return true;
    const tempC = normalizeTempC(v.temperature);
    if (tempC > 38 || tempC < 36) return true;
    return false;
}

async function buildContext(effectiveHqId: string | 'ALL') {
    const today = todayStartAST();
    const hqFilter = effectiveHqId === 'ALL' ? {} : { headquartersId: effectiveHqId };
    const hqFilterViaPatient = effectiveHqId === 'ALL' ? {} : { patient: { headquartersId: effectiveHqId } };
    const hqFilterViaPatientMed = effectiveHqId === 'ALL'
        ? {}
        : { patientMedication: { patient: { headquartersId: effectiveHqId } } };

    const [
        patientsCount,
        medsToday,
        handoversToday,
        vitalsToday,
        triageOpen,
        incidentsWeek,
        bathsToday,
        mealsToday,
    ] = await Promise.all([
        prisma.patient.count({
            where: {
                ...(effectiveHqId === 'ALL' ? {} : { headquartersId: effectiveHqId }),
                status: { notIn: ['DISCHARGED', 'DECEASED'] },
            },
        }),
        prisma.medicationAdministration.findMany({
            where: {
                ...hqFilterViaPatientMed,
                OR: [
                    { scheduledTime: { gte: today } },
                    { administeredAt: { gte: today } },
                ],
            },
            select: { status: true },
        }),
        prisma.shiftHandover.findMany({
            where: { ...hqFilter, createdAt: { gte: today } },
            select: { id: true, status: true, supervisorSignedAt: true, shiftType: true, createdAt: true },
        }),
        prisma.vitalSigns.findMany({
            where: { ...hqFilterViaPatient, createdAt: { gte: today } },
            select: { systolic: true, diastolic: true, heartRate: true, temperature: true, spo2: true },
        }),
        prisma.triageTicket.count({
            where: { ...hqFilter, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] }, isVoided: false },
        }),
        prisma.incidentReport.count({
            where: {
                ...hqFilter,
                createdAt: { gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
            },
        }),
        prisma.bathLog.count({
            where: { ...hqFilterViaPatient, timeLogged: { gte: today } },
        }),
        prisma.mealLog.findMany({
            where: { ...hqFilterViaPatient, timeLogged: { gte: today } },
            select: { mealType: true, patientId: true },
        }),
    ]);

    const scheduled = medsToday.filter(m => ['ADMINISTERED', 'MISSED', 'REFUSED', 'OMITTED'].includes(m.status));
    const given = medsToday.filter(m => m.status === 'ADMINISTERED').length;
    const missed = medsToday.filter(m => m.status === 'MISSED').length;
    const refused = medsToday.filter(m => m.status === 'REFUSED').length;
    const compliance = scheduled.length > 0 ? Math.round((given / scheduled.length) * 100) : null;

    const handoversSigned = handoversToday.filter(h => h.supervisorSignedAt).length;
    const handoversPending = handoversToday.length - handoversSigned;

    const vitalsAbnormal = vitalsToday.filter(isAbnormalVital).length;

    const uniqueMealKeys = new Set(mealsToday.map(m => `${m.patientId}::${m.mealType}`));
    const mealCoverage = patientsCount > 0
        ? Math.round((uniqueMealKeys.size / (patientsCount * 3)) * 100)
        : null;

    return {
        scope: effectiveHqId,
        clinicalDay: today.toISOString(),
        patientsCount,
        meds: { given, missed, refused, scheduled: scheduled.length, compliance },
        handovers: { total: handoversToday.length, signed: handoversSigned, pending: handoversPending },
        vitals: { total: vitalsToday.length, abnormal: vitalsAbnormal },
        triageOpen,
        incidentsWeek,
        baths: bathsToday,
        meals: { total: mealsToday.length, uniquePatientMeals: uniqueMealKeys.size, coverage: mealCoverage },
    };
}

async function generateBriefing(context: any): Promise<{ summary: string; bullets: BriefingBullet[] }> {
    // Si no hay API key real, retornar briefing fallback
    if (!process.env.OPENAI_API_KEY) {
        return fallbackBriefing(context);
    }

    const prompt = `Eres Zendi, asistente estratégico del Director de Operaciones de Vivid Senior Living en Puerto Rico.
Te paso el snapshot operativo del día clínico (6 AM AST actual).

SNAPSHOT:
${JSON.stringify(context, null, 2)}

Genera un briefing ejecutivo para el Director con EXACTAMENTE 5 bullets priorizados. Cada bullet debe ser accionable y específico: no resumas todo, prioriza lo que debe atender HOY.

Prioridades permitidas: CRITICAL | HIGH | MEDIUM | LOW

Reglas de priorización:
- CRITICAL: vitales anómalos > 0, handovers sin firmar del turno cerrado, medicamentos MISSED altos, triage escalado.
- HIGH: cumplimiento eMAR < 85%, cobertura comidas < 70%, incidentes de la semana > 3.
- MEDIUM: métricas aceptables pero con tendencia riesgosa.
- LOW: nota de felicitación si algo va bien (opcional, máximo 1 bullet LOW).

Categorías válidas (elige la más apropiada para cada bullet):
vitals | handovers | emar | upps | falls | triage | incidents | meals | coverage | default

Responde SOLO JSON válido con esta forma exacta:
{
  "summary": "Una frase ejecutiva de 15-25 palabras con el estado general.",
  "bullets": [
    { "priority": "CRITICAL", "category": "vitals", "title": "...", "description": "...", "action": "..." },
    ...
  ]
}

- title: máximo 8 palabras, categórico
- description: 1 frase con números concretos del snapshot
- action: qué debe hacer el Director específicamente hoy (imperativo, 1 frase)
- category: la categoría del bullet (vitals, handovers, emar, etc.)
- Si no hay nada CRITICAL, balancea con HIGH/MEDIUM, nunca inventes problemas.
- Idioma: español de Puerto Rico, directo, sin relleno.`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });
        const raw = completion.choices[0]?.message?.content;
        if (!raw) return fallbackBriefing(context);

        const parsed = JSON.parse(raw);
        const bullets: BriefingBullet[] = Array.isArray(parsed.bullets)
            ? parsed.bullets.slice(0, 5).map((b: any) => ({
                priority: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(b.priority) ? b.priority : 'MEDIUM') as Priority,
                title: String(b.title || '').slice(0, 80),
                description: String(b.description || '').slice(0, 240),
                action: String(b.action || '').slice(0, 240),
                link: BULLET_LINKS[b.category] || BULLET_LINKS.default,
            }))
            : [];

        return {
            summary: String(parsed.summary || '').slice(0, 280),
            bullets: bullets.length > 0 ? bullets : fallbackBriefing(context).bullets,
        };
    } catch (err) {
        console.error('[director-briefing] OpenAI failed, using fallback', err);
        return fallbackBriefing(context);
    }
}

function fallbackBriefing(ctx: any): { summary: string; bullets: BriefingBullet[] } {
    const bullets: BriefingBullet[] = [];

    if (ctx.vitals.abnormal > 0) {
        bullets.push({
            priority: 'CRITICAL',
            title: 'Vitales Anómalos Significativos',
            description: `${ctx.vitals.abnormal} de ${ctx.vitals.total} registros de vitales fuera de rango clínico hoy.`,
            action: 'Coordina una revisión médica urgente para los pacientes con vitales anómalos.',
            link: BULLET_LINKS.vitals,
        });
    }
    if (ctx.handovers.pending > 0) {
        bullets.push({
            priority: 'CRITICAL',
            title: 'Handovers Sin Firmar',
            description: `${ctx.handovers.pending} handovers pendientes de firma supervisoria hoy.`,
            action: 'Asegura la firma inmediata de los handovers pendientes para evitar lapsos de comunicación.',
            link: BULLET_LINKS.handovers,
        });
    }
    if (ctx.meds.compliance !== null && ctx.meds.compliance < 90) {
        bullets.push({
            priority: ctx.meds.compliance < 80 ? 'CRITICAL' : 'HIGH',
            title: 'Cumplimiento eMAR Bajo Meta',
            description: `Hoy ${ctx.meds.compliance}% (${ctx.meds.given}/${ctx.meds.scheduled}); ${ctx.meds.missed} MISSED, ${ctx.meds.refused} REFUSED.`,
            action: 'Solicitar reporte de enfermería sobre causas de omisiones y plan correctivo.',
            link: BULLET_LINKS.emar,
        });
    }
    if (ctx.triageOpen > 0) {
        bullets.push({
            priority: ctx.triageOpen >= 3 ? 'HIGH' : 'MEDIUM',
            title: 'Tickets de Triage Abiertos',
            description: `${ctx.triageOpen} tickets abiertos en el centro de triage.`,
            action: 'Revisar despacho y confirmar asignaciones pendientes.',
            link: BULLET_LINKS.triage,
        });
    }
    if (ctx.meals.coverage !== null && ctx.meals.coverage < 70) {
        bullets.push({
            priority: 'HIGH',
            title: 'Cobertura de Comidas Baja',
            description: `La cobertura de comidas es del ${ctx.meals.coverage}%.`,
            action: 'Revisa y mejora la planificación de comidas para aumentar la cobertura.',
            link: BULLET_LINKS.meals,
        });
    }
    if (ctx.incidentsWeek > 3) {
        bullets.push({
            priority: 'HIGH',
            title: 'Incidentes Semanales Elevados',
            description: `Se han registrado ${ctx.incidentsWeek} incidentes esta semana.`,
            action: 'Investiga las causas de los incidentes y desarrolla un plan de mitigación.',
            link: BULLET_LINKS.incidents,
        });
    }

    // Bullet LOW opcional si el eMAR va bien
    if (bullets.length < 3 && ctx.meds.compliance !== null && ctx.meds.compliance >= 95) {
        bullets.push({
            priority: 'LOW',
            title: 'Cumplimiento eMAR Excelente',
            description: `Cumplimiento de medicamentos al ${ctx.meds.compliance}%.`,
            action: 'Felicita al equipo de enfermería por el excelente cumplimiento en la próxima reunión.',
            link: BULLET_LINKS.emar,
        });
    }

    // Aseguremos al menos 1 bullet
    if (bullets.length === 0) {
        bullets.push({
            priority: 'LOW',
            title: 'Día Clínico Estable',
            description: `${ctx.patientsCount} residentes activos, sin desviaciones críticas registradas.`,
            action: 'Mantener supervisión de rutina y confirmar cierre de turno.',
            link: BULLET_LINKS.default,
        });
    }

    return {
        summary: `${ctx.patientsCount} residentes activos · eMAR ${ctx.meds.compliance ?? '—'}% · ${ctx.vitals.abnormal} vitales anómalos.`,
        bullets: bullets.slice(0, 5),
    };
}

/**
 * POST /api/corporate/director-briefing
 * Body: { hqId?: 'ALL' | string, forceRefresh?: boolean }
 * Retorna el briefing del día clínico actual. Cacheado por (scope, clinicalDay)
 * salvo forceRefresh.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo director/admin' }, { status: 403 });
        }
        const sessionHqId = (session.user as any).headquartersId;
        if (!sessionHqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const requestedHqId = body?.hqId as string | undefined;
        const forceRefresh = Boolean(body?.forceRefresh);

        let scope: string;
        if (MULTI_HQ_ROLES.includes(role)) {
            scope = (!requestedHqId || requestedHqId === 'ALL') ? 'ALL' : requestedHqId;
        } else {
            scope = sessionHqId;
        }

        const clinicalDay = todayStartAST();

        // Cache hit
        if (!forceRefresh) {
            const cached = await prisma.directorBriefing.findUnique({
                where: { scope_clinicalDay: { scope, clinicalDay } },
            });
            if (cached) {
                return NextResponse.json({
                    success: true,
                    cached: true,
                    briefing: {
                        id: cached.id,
                        scope: cached.scope,
                        clinicalDay: cached.clinicalDay,
                        generatedAt: cached.generatedAt,
                        summary: cached.summary,
                        bullets: cached.bullets,
                        model: cached.model,
                    },
                });
            }
        }

        // Build context & call GPT
        const context = await buildContext(scope as any);
        const { summary, bullets } = await generateBriefing(context);

        // Upsert
        const saved = await prisma.directorBriefing.upsert({
            where: { scope_clinicalDay: { scope, clinicalDay } },
            update: {
                summary,
                bullets: bullets as any,
                generatedAt: new Date(),
                generatedById: (session.user as any).id || null,
                model: process.env.OPENAI_API_KEY ? 'gpt-4o' : 'fallback',
            },
            create: {
                scope,
                clinicalDay,
                summary,
                bullets: bullets as any,
                generatedById: (session.user as any).id || null,
                model: process.env.OPENAI_API_KEY ? 'gpt-4o' : 'fallback',
            },
        });

        return NextResponse.json({
            success: true,
            cached: false,
            briefing: {
                id: saved.id,
                scope: saved.scope,
                clinicalDay: saved.clinicalDay,
                generatedAt: saved.generatedAt,
                summary: saved.summary,
                bullets: saved.bullets,
                model: saved.model,
            },
            context,
        });
    } catch (err: any) {
        console.error('[director-briefing POST]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}

/**
 * GET /api/corporate/director-briefing?hqId=X
 * Retorna el briefing cacheado del día (si existe) sin regenerar.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo director/admin' }, { status: 403 });
        }
        const sessionHqId = (session.user as any).headquartersId;
        const requestedHqId = request.nextUrl.searchParams.get('hqId');
        let scope: string;
        if (MULTI_HQ_ROLES.includes(role)) {
            scope = (!requestedHqId || requestedHqId === 'ALL') ? 'ALL' : requestedHqId;
        } else {
            scope = sessionHqId;
        }

        const clinicalDay = todayStartAST();
        const cached = await prisma.directorBriefing.findUnique({
            where: { scope_clinicalDay: { scope, clinicalDay } },
        });
        if (!cached) {
            return NextResponse.json({ success: true, briefing: null });
        }
        return NextResponse.json({
            success: true,
            briefing: {
                id: cached.id,
                scope: cached.scope,
                clinicalDay: cached.clinicalDay,
                generatedAt: cached.generatedAt,
                summary: cached.summary,
                bullets: cached.bullets,
                model: cached.model,
            },
        });
    } catch (err: any) {
        console.error('[director-briefing GET]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
