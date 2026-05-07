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

        // --- Zendi AI — Evaluación por grupos de rol ---
        const roleLabel: Record<string, string> = {
            NURSE: 'Enfermera/o',
            CAREGIVER: 'Cuidador/a',
            SUPERVISOR: 'Supervisor/a',
            DIRECTOR: 'Director/a',
            ADMIN: 'Administrador/a',
            MAINTENANCE: 'Mantenimiento',
            KITCHEN: 'Cocina y Nutrición',
            CLEANING: 'Limpieza y Sanitización',
            SOCIAL_WORKER: 'Trabajador/a Social',
            THERAPIST: 'Terapeuta',
            BEAUTY_SPECIALIST: 'Especialista de Belleza',
        };
        const prettyRole = roleLabel[employee.role] || employee.role;

        // Grupo A: Clínico directo — responsables de eMAR, vitales y turnos de cuidado
        const isClinico = ['CAREGIVER', 'NURSE'].includes(employee.role);
        // Grupo B: Supervisión y dirección — gestión de equipo y cumplimiento operativo
        const isSupervisor = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(employee.role);
        // Grupo C: Servicios de apoyo — no tienen eMAR ni shiftSession
        const isApoyo = ['KITCHEN', 'CLEANING', 'MAINTENANCE', 'THERAPIST', 'BEAUTY_SPECIALIST', 'SOCIAL_WORKER'].includes(employee.role);

        // dataSummary por grupo — solo incluye métricas relevantes al rol
        let dataSummary = '';
        let roleContext = '';

        if (isClinico) {
            roleContext = employee.role === 'NURSE'
                ? 'Enfermería: responsable de la precisión del eMAR, supervisión clínica, toma y documentación de signos vitales, y coordinación del relevo de turno.'
                : 'Cuidado directo: responsable de la administración del eMAR bajo supervisión, atención al residente, cierre del turno con wizard y toma de vitales.';
            dataSummary = [
                `- eMAR (Medicamentos): ${compliancePct}% cumplimiento (${administered}/${medTotal} administrados, ${missed} perdidos, ${refused} rehusados${omitted > 0 ? `, ${omitted} omitidos` : ''})${avgDelayMinutes !== null ? ` — puntualidad promedio: ${avgDelayMinutes > 0 ? '+' : ''}${avgDelayMinutes} min vs horario` : ''}`,
                `- Cierre de turno: ${handoverCompleted}/${shiftTotal} turnos cerrados con wizard (${handoverPct}%)`,
                `- Vitales: ${vitalsTotal} tomas registradas, ${vitalsCritical} con valores críticos (SpO2<94 o presión >160/100)`,
                `- Observaciones HR: ${incidents.length} — Obs:${bySeverity.OBSERVATION} / Amonestación:${bySeverity.WARNING} / Suspensión:${bySeverity.SUSPENSION} — puntos deducidos: ${pointsDeducted}`,
                recentIncidents.length > 0 ? `  Recientes: ${recentIncidents.map(r => `"${r.description.slice(0, 80)}"`).join(' | ')}` : '',
                `- Academy: ${academyCompleted}/${academyAssigned} cursos completados (${academyPct}%)`,
                `- Ausencias injustificadas: ${absences} en el período`,
                `- Score de compliance: ${employee.complianceScore} pts — Ranking: #${position} de ${totalStaff}`,
            ].filter(Boolean).join('\n');

        } else if (isSupervisor) {
            roleContext = employee.role === 'DIRECTOR'
                ? 'Dirección: responsable del cumplimiento operativo global, supervisión del equipo clínico y administrativo, toma de decisiones estratégicas y auditoría de desempeño.'
                : employee.role === 'SUPERVISOR'
                ? 'Supervisión de turno: responsable de validar el cierre de turno del equipo, gestionar ausencias, coordinar redistribución de colores y dar seguimiento a incidentes clínicos.'
                : 'Administración: responsable de procesos operativos, cumplimiento normativo, gestión de accesos y soporte al equipo directivo.';
            dataSummary = [
                `- Observaciones HR propias: ${incidents.length} — Obs:${bySeverity.OBSERVATION} / Amonestación:${bySeverity.WARNING} / Suspensión:${bySeverity.SUSPENSION} — puntos deducidos: ${pointsDeducted}`,
                recentIncidents.length > 0 ? `  Recientes: ${recentIncidents.map(r => `"${r.description.slice(0, 80)}"`).join(' | ')}` : '',
                `- Academy: ${academyCompleted}/${academyAssigned} cursos completados (${academyPct}%)`,
                `- Ausencias: ${absences} en el período`,
                `- Score de compliance: ${employee.complianceScore} pts — Ranking: #${position} de ${totalStaff}`,
                `⚠️ NOTA: Las métricas de eMAR, vitales y wizard de turno corresponden al equipo bajo su supervisión, no a este rol directamente.`,
            ].filter(Boolean).join('\n');

        } else {
            // Grupo C: Servicios de apoyo
            const roleContextMap: Record<string, string> = {
                KITCHEN: 'Cocina y Nutrición: responsable de la preparación y distribución de alimentos bajo estándares sanitarios, cumplimiento de dietas terapéuticas y protocolos de higiene de cocina.',
                CLEANING: 'Limpieza y Sanitización: responsable del cumplimiento de protocolos de limpieza por área, sanitización periódica y mantenimiento de condiciones higiénicas de la instalación.',
                MAINTENANCE: 'Mantenimiento: responsable de la resolución de órdenes de trabajo, mantenimiento preventivo de instalaciones y equipos, y prevención de riesgos físicos.',
                THERAPIST: 'Terapia: responsable de la aplicación de planes terapéuticos individualizados a los residentes, documentación de progreso y coordinación con el equipo clínico.',
                BEAUTY_SPECIALIST: 'Bienestar y Belleza: responsable de servicios de bienestar personal para residentes, contribuyendo a su calidad de vida y dignidad.',
                SOCIAL_WORKER: 'Trabajo Social: responsable de la gestión de casos, coordinación con familias, procesos de admisión y seguimiento del bienestar social de los residentes.',
            };
            roleContext = roleContextMap[employee.role] || `Servicios de apoyo (${prettyRole}): rol operativo de soporte a la operación del hogar.`;
            dataSummary = [
                `- Observaciones HR: ${incidents.length} — Obs:${bySeverity.OBSERVATION} / Amonestación:${bySeverity.WARNING} / Suspensión:${bySeverity.SUSPENSION} — puntos deducidos: ${pointsDeducted}`,
                recentIncidents.length > 0 ? `  Recientes: ${recentIncidents.map(r => `"${r.description.slice(0, 80)}"`).join(' | ')}` : '',
                `- Academy: ${academyCompleted}/${academyAssigned} cursos completados (${academyPct}%)`,
                `- Ausencias: ${absences} en el período`,
                `- Score de compliance: ${employee.complianceScore} pts — Ranking: #${position} de ${totalStaff}`,
                `⚠️ NOTA: Este rol no opera eMAR, vitales ni wizard de turno. Las métricas clínicas no aplican. La evaluación debe enfocarse en conducta, puntualidad, capacitación y observaciones disciplinarias.`,
            ].filter(Boolean).join('\n');
        }

        const system = `Eres Zendi, asistente de Zéndity (plataforma healthcare para hogares de envejecientes en Puerto Rico).
Generas informes pre-auditoría objetivos, justos y estrictamente basados en datos reales.
CRÍTICO: Evalúa al empleado EXCLUSIVAMENTE según las métricas de su rol — no extrapoles criterios clínicos a roles de apoyo ni viceversa.
Tono profesional en español. No inventes datos. Si una métrica no aplica al rol, no la menciones.`;

        const prompt = `Genera un Informe Pre-Auditoría profesional en español para ${employee.name} (${prettyRole}).
Período analizado: últimos ${days} días.

ROL Y RESPONSABILIDADES:
${roleContext}

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
- Evalúa ÚNICAMENTE según el rol y las métricas indicadas arriba. No menciones medicamentos, vitales ni wizard de turno si el rol no los maneja.
- Las preguntas sugeridas deben ser pertinentes al rol real (no preguntas clínicas a un cocinero o de cocina a una enfermera).
- Sé específico con los números reales; no inventes datos.
- Si un área tiene 0 datos en el período, dilo con honestidad y explica si eso es normal para el rol.
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

        // Bug fix: cargar historial DESPUÉS del create para que incluya el registro recién creado
        const freshHistory = await prisma.performanceScore.findMany({
            where: { userId: employeeId, headquartersId: hqId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, periodStart: true, periodEnd: true, systemScore: true, humanScore: true, finalScore: true, feedback: true, createdAt: true },
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
            previousAudits: freshHistory.map(p => ({
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
            select: { id: true, systemScore: true, userId: true },
        });
        if (!existing) {
            return NextResponse.json({ success: false, error: 'Auditoría no encontrada' }, { status: 404 });
        }

        const human = typeof humanScore === 'number' ? humanScore : null;
        // finalScore = humanScore si existe, si no = systemScore (auditoría cerrada sin ajuste manual)
        const finalScore = human !== null ? human : existing.systemScore;
        const invokerId = (session.user as any).id;

        // Actualizar PerformanceScore + propagar finalScore a User.complianceScore +
        // crear EmployeeEvaluation para que Insights refleje el score de la auditoría
        const [updated] = await Promise.all([
            prisma.performanceScore.update({
                where: { id: performanceScoreId },
                data: {
                    humanScore: human,
                    finalScore,
                    feedback: feedback || null,
                },
                select: { id: true, humanScore: true, finalScore: true, feedback: true },
            }),
            prisma.user.update({
                where: { id: existing.userId },
                data: { complianceScore: Math.round(finalScore) },
            }),
            // Sincronizar con EmployeeEvaluation para que Insights, HR page y
            // el directorio muestren el score actualizado sin intervención manual
            prisma.employeeEvaluation.create({
                data: {
                    headquartersId: hqId,
                    employeeId: existing.userId,
                    evaluatorId: invokerId,
                    score: Math.round(finalScore),
                    categoryScores: { auditoria_formal: Math.round(finalScore) },
                    feedback: feedback || `Auditoría formal cerrada por dirección. Score: ${Math.round(finalScore)}/100`,
                },
            }),
        ]);

        return NextResponse.json({ success: true, performanceScore: updated, finalScore: Math.round(finalScore) });
    } catch (error: any) {
        console.error('audit-report PATCH error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
    }
}
