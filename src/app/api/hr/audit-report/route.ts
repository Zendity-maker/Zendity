import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const AUDIT_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

type SystemFindings = {
    meds: { total: number; administered: number; missed: number; refused: number; held: number; omitted: number; pending: number; compliancePct: number; avgDelayMinutes: number | null };
    shifts: { total: number; handoverCompleted: number; handoverPct: number };
    vitals: { total: number; critical: number };
    incidents: { total: number; bySeverity: Record<string, number>; pointsDeducted: number; recent: Array<{ description: string; severity: string; createdAt: string }> };
    academy: { assigned: number; completed: number; completionPct: number };
    absences: number;
    ranking: { position: number; totalStaff: number };
};

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!AUDIT_ROLES.includes(session.user.role)) {
            return NextResponse.json({ success: false, error: 'Rol sin permiso para auditar' }, { status: 403 });
        }

        const hqId = session.user.headquartersId;
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employeeId');
        const daysParam = parseInt(searchParams.get('days') || '30', 10);
        const days = [30, 60, 90].includes(daysParam) ? daysParam : 30;

        if (!employeeId) {
            return NextResponse.json({ success: false, error: 'employeeId requerido' }, { status: 400 });
        }

        const periodEnd = new Date();
        const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);

        // FIX 1 — Warmup: previene cold start 500 en Neon serverless
        await prisma.$queryRaw`SELECT 1`;

        // FIX 4 — Timeout explícito de 10s en las queries paralelas
        // Si Neon no responde en 10s → 503 claro en vez de 500 genérico
        const queryTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('QUERY_TIMEOUT')), 10_000)
        );

        const [
            employee,
            medAdmins,
            shifts,
            vitals,
            incidents,
            courseEnrollments,
            absences,
            allStaff,
            previousAudits,
        ] = await Promise.race([
            Promise.all([
                prisma.user.findFirst({
                    where: { id: employeeId, headquartersId: hqId },
                    select: { id: true, name: true, role: true, email: true, complianceScore: true, createdAt: true, hiredAt: true, photoUrl: true, image: true },
                }),
                prisma.medicationAdministration.findMany({
                    where: {
                        administeredById: employeeId,
                        OR: [
                            { createdAt: { gte: periodStart, lte: periodEnd } },
                            { administeredAt: { gte: periodStart, lte: periodEnd } },
                        ],
                    },
                    select: { status: true, scheduledTime: true, administeredAt: true },
                }),
                prisma.shiftSession.findMany({
                    where: { caregiverId: employeeId, headquartersId: hqId, startTime: { gte: periodStart, lte: periodEnd } },
                    select: { handoverCompleted: true },
                }),
                prisma.vitalSigns.findMany({
                    where: { measuredById: employeeId, createdAt: { gte: periodStart, lte: periodEnd } },
                    select: { systolic: true, diastolic: true, spo2: true },
                }),
                prisma.incidentReport.findMany({
                    where: { employeeId, headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd } },
                    orderBy: { createdAt: 'desc' },
                    select: { severity: true, pointsDeducted: true, description: true, createdAt: true },
                }),
                prisma.userCourse.findMany({
                    where: { employeeId, headquartersId: hqId },
                    select: { status: true, completedAt: true },
                }),
                prisma.scheduledShift.count({
                    where: { userId: employeeId, isAbsent: true, date: { gte: periodStart, lte: periodEnd } },
                }),
                prisma.user.findMany({
                    where: { headquartersId: hqId, isActive: true, isDeleted: false },
                    select: { id: true, complianceScore: true },
                    orderBy: { complianceScore: 'desc' },
                }),
                prisma.performanceScore.findMany({
                    where: { userId: employeeId, headquartersId: hqId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: { id: true, periodStart: true, periodEnd: true, systemScore: true, humanScore: true, finalScore: true, feedback: true, createdAt: true, systemFindings: true },
                }),
            ]),
            queryTimeout,
        ]).catch((err: Error) => {
            if (err.message === 'QUERY_TIMEOUT') throw err; // re-lanzar para el catch externo
            throw err;
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado en esta sede' }, { status: 404 });
        }

        // --- Meds ---
        const medTotal = medAdmins.length;
        const administered = medAdmins.filter(m => m.status === 'ADMINISTERED').length;
        const missed = medAdmins.filter(m => m.status === 'MISSED').length;
        const refused = medAdmins.filter(m => m.status === 'REFUSED').length;
        const held = medAdmins.filter(m => m.status === 'HELD').length;
        const omitted = medAdmins.filter(m => m.status === 'OMITTED').length;
        const pending = medAdmins.filter(m => m.status === 'PENDING').length;
        const compliancePct = medTotal > 0 ? Math.round((administered / medTotal) * 100) : 0;

        const punctualityMins: number[] = [];
        for (const m of medAdmins) {
            if (m.status === 'ADMINISTERED' && m.scheduledTime && m.administeredAt) {
                const delta = (m.administeredAt.getTime() - m.scheduledTime.getTime()) / 60000;
                punctualityMins.push(delta);
            }
        }
        const avgDelayMinutes = punctualityMins.length > 0
            ? Math.round(punctualityMins.reduce((a, b) => a + b, 0) / punctualityMins.length)
            : null;

        // --- Shifts ---
        const shiftTotal = shifts.length;
        const handoverCompleted = shifts.filter(s => s.handoverCompleted).length;
        const handoverPct = shiftTotal > 0 ? Math.round((handoverCompleted / shiftTotal) * 100) : 0;

        // --- Vitals ---
        const vitalsTotal = vitals.length;
        const vitalsCritical = vitals.filter(v =>
            (v.spo2 != null && v.spo2 < 94) || v.systolic > 160 || v.diastolic > 100
        ).length;

        // --- Incidents ---
        const bySeverity: Record<string, number> = { OBSERVATION: 0, WARNING: 0, SUSPENSION: 0, TERMINATION: 0 };
        let pointsDeducted = 0;
        for (const i of incidents) {
            bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
            pointsDeducted += i.pointsDeducted || 0;
        }
        const recentIncidents = incidents.slice(0, 3).map(i => ({
            description: i.description.length > 200 ? i.description.slice(0, 200) + '…' : i.description,
            severity: i.severity,
            createdAt: i.createdAt.toISOString(),
        }));

        // --- Academy ---
        const academyAssigned = courseEnrollments.length;
        const academyCompleted = courseEnrollments.filter(c => c.status === 'COMPLETED').length;
        const academyPct = academyAssigned > 0 ? Math.round((academyCompleted / academyAssigned) * 100) : 0;

        // --- Ranking ---
        // FIX 2 — findIndex devuelve -1 si el empleado no está en allStaff (ej. isActive=false)
        // En ese caso lo ponemos al final del ranking en vez de posición 0
        const idx = allStaff.findIndex(u => u.id === employeeId);
        const position = idx >= 0 ? idx + 1 : allStaff.length;
        const totalStaff = allStaff.length;

        const findings: SystemFindings = {
            meds: { total: medTotal, administered, missed, refused, held, omitted, pending, compliancePct, avgDelayMinutes },
            shifts: { total: shiftTotal, handoverCompleted, handoverPct },
            vitals: { total: vitalsTotal, critical: vitalsCritical },
            incidents: { total: incidents.length, bySeverity, pointsDeducted, recent: recentIncidents },
            academy: { assigned: academyAssigned, completed: academyCompleted, completionPct: academyPct },
            absences,
            ranking: { position, totalStaff },
        };

        // --- Zendi AI ---
        const roleLabel: Record<string, string> = {
            NURSE: 'Enfermera/o',
            CAREGIVER: 'Cuidador/a',
            SUPERVISOR: 'Supervisor/a',
            DIRECTOR: 'Director/a',
            ADMIN: 'Admin',
            MAINTENANCE: 'Mantenimiento',
            KITCHEN: 'Cocina',
            CLEANING: 'Limpieza',
            SOCIAL_WORKER: 'Trabajador/a Social',
            THERAPIST: 'Terapeuta',
            BEAUTY_SPECIALIST: 'Especialista Belleza',
        };
        const prettyRole = roleLabel[employee.role] || employee.role;

        const dataSummary = `
- Medicamentos: ${compliancePct}% cumplimiento (${administered}/${medTotal} administrados, ${missed} perdidos, ${refused} rehusados)${avgDelayMinutes !== null ? `, puntualidad promedio: ${avgDelayMinutes > 0 ? '+' : ''}${avgDelayMinutes} min vs horario` : ''}
- Turnos: ${handoverCompleted}/${shiftTotal} cerrados con wizard (${handoverPct}%)
- Vitales: ${vitalsTotal} tomas, ${vitalsCritical} con valores críticos (SpO2<94 o presión >160/100)
- Observaciones HR: ${incidents.length} total — Obs:${bySeverity.OBSERVATION} / Amonestación:${bySeverity.WARNING} / Suspensión:${bySeverity.SUSPENSION} / Despido:${bySeverity.TERMINATION} — puntos deducidos: ${pointsDeducted}
${recentIncidents.length > 0 ? `  Últimas: ${recentIncidents.map(r => `"${r.description.slice(0, 80)}"`).join(' | ')}` : ''}
- Academy: ${academyCompleted}/${academyAssigned} cursos completados (${academyPct}%)
- Ausencias: ${absences} en el período
- Score actual: ${employee.complianceScore} pts — Ranking: #${position} de ${totalStaff}
`.trim();

        // FIX 3 — Empleados con historial vacío (rol KITCHEN, CLEANING, nuevo ingreso, etc.)
        // Si no hay meds, turnos ni vitales en el período → nota honesta al informe, sin inventar datos.
        const hasNoData = medTotal === 0 && shiftTotal === 0 && vitalsTotal === 0;

        const system = 'Eres Zendi, asistente de Zéndity (plataforma healthcare para hogares de envejecientes en Puerto Rico). Generas informes pre-auditoría objetivos, justos y basados en datos reales. Tono profesional en español.';
        const prompt = `Genera un Informe Pre-Auditoría profesional en español para ${employee.name} (${prettyRole}).
Período analizado: últimos ${days} días.
${hasNoData ? '\n⚠️ AVISO: Este empleado no tiene registros clínicos en el período (sin meds, sin turnos, sin vitales). Puede ser personal de apoyo (cocina, limpieza) o empleado de ingreso reciente. Genera el informe indicando honestamente la ausencia de historial clínico medible y sugiere una evaluación presencial.\n' : ''}
DATOS REALES DEL PERÍODO:
${dataSummary}

Genera el informe con este formato EXACTO en Markdown:

## Resumen Ejecutivo
2-3 oraciones con una lectura global del desempeño, citando números concretos.

## Fortalezas
- (máximo 3 bullets, cada uno respaldado con un número real)

## Áreas de Mejora
- (máximo 3 bullets, cada uno respaldado con un número real)

## Recomendación
Una sola línea que termine con uno de estos tags literales entre corchetes: [DESTACADO], [SATISFACTORIO], [EN DESARROLLO], [ACCIÓN REQUERIDA].

## Preguntas Sugeridas para la Auditoría Formal
1. (pregunta específica basada en los datos)
2. (pregunta específica basada en los datos)
3. (pregunta específica basada en los datos)

Reglas:
- Sé específico con los números reales; no inventes datos.
- Si un área tiene 0 datos en el período, dilo con honestidad.
- Mantén un tono profesional y justo — ni punitivo ni complaciente.
- No incluyas preámbulos ni despedidas. Empieza directo con "## Resumen Ejecutivo".`;

        let aiReport = '';
        try {
            const { text } = await generateText({
                model: openai('gpt-4o-mini'),
                system,
                prompt,
                temperature: 0.3,
            });
            aiReport = text.trim();
        } catch (aiErr) {
            console.error('Zendi AI error:', aiErr);
            aiReport = `## Resumen Ejecutivo\nNo se pudo generar el análisis de Zendi en este momento. Los datos del período están disponibles abajo para revisión manual.\n\n## Recomendación\nRevisar los KPIs con el equipo de supervisión. [EN DESARROLLO]`;
        }

        const saved = await prisma.performanceScore.create({
            data: {
                userId: employeeId,
                headquartersId: hqId,
                periodStart,
                periodEnd,
                systemScore: employee.complianceScore,
                humanScore: null,
                finalScore: null,
                systemFindings: findings as any,
                aiReport,
            },
            select: { id: true, createdAt: true },
        });

        return NextResponse.json({
            success: true,
            performanceScoreId: saved.id,
            createdAt: saved.createdAt,
            employee: {
                id: employee.id,
                name: employee.name,
                role: employee.role,
                email: employee.email,
                photoUrl: employee.photoUrl || employee.image || null,
                complianceScore: employee.complianceScore,
                hiredAt: employee.hiredAt || employee.createdAt,
            },
            period: { days, start: periodStart.toISOString(), end: periodEnd.toISOString() },
            findings,
            aiReport,
            previousAudits: previousAudits.map(p => ({
                id: p.id,
                createdAt: p.createdAt.toISOString(),
                periodStart: p.periodStart.toISOString(),
                periodEnd: p.periodEnd.toISOString(),
                systemScore: p.systemScore,
                humanScore: p.humanScore,
                finalScore: p.finalScore,
                feedback: p.feedback,
            })),
        });
    } catch (error: any) {
        console.error('audit-report GET error:', error);
        // FIX 4 — timeout de queries → 503 claro en vez de 500 genérico
        if (error.message === 'QUERY_TIMEOUT') {
            return NextResponse.json(
                { success: false, error: 'Base de datos no respondió a tiempo. Intenta de nuevo en unos segundos.' },
                { status: 503 }
            );
        }
        return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!AUDIT_ROLES.includes(session.user.role)) {
            return NextResponse.json({ success: false, error: 'Rol sin permiso' }, { status: 403 });
        }

        const hqId = session.user.headquartersId;
        const body = await request.json();
        const { performanceScoreId, humanScore, feedback } = body as {
            performanceScoreId?: string;
            humanScore?: number | null;
            feedback?: string;
        };

        if (!performanceScoreId) {
            return NextResponse.json({ success: false, error: 'performanceScoreId requerido' }, { status: 400 });
        }

        const existing = await prisma.performanceScore.findFirst({
            where: { id: performanceScoreId, headquartersId: hqId },
            select: { id: true, systemScore: true },
        });
        if (!existing) {
            return NextResponse.json({ success: false, error: 'Auditoría no encontrada' }, { status: 404 });
        }

        const human = typeof humanScore === 'number' ? humanScore : null;
        // finalScore = humanScore si existe, si no = systemScore (auditoría cerrada sin ajuste manual)
        const finalScore = human !== null ? human : existing.systemScore;

        const updated = await prisma.performanceScore.update({
            where: { id: performanceScoreId },
            data: {
                humanScore: human,
                finalScore,
                feedback: feedback || null,
            },
            select: { id: true, humanScore: true, finalScore: true, feedback: true },
        });

        return NextResponse.json({ success: true, performanceScore: updated });
    } catch (error: any) {
        console.error('audit-report PATCH error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
    }
}
