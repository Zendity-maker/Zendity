import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel Cron: cada 2 horas (vercel.json: "0 */2 * * *")
// Detecta pacientes sin rotación postural >2h con nortonRisk=true
// O con UPP activa (status ACTIVE/HEALING) — aunque nortonRisk sea false.
// FIX: antes solo filtraba nortonRisk=true, ignorando pacientes con UPP activa.
// FIX: ahora envía notificaciones reales vía notifyRoles.
// FIX: eliminado PosturalChangeLog con nurseId="system_cron" (violaba FK).

export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no configurado en entorno' }, { status: 500 });
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON Inválida' }, { status: 401 });
    }

    try {
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const now = new Date();
        const limitTime = new Date(now.getTime() - TWO_HOURS_MS);

        // Pacientes en riesgo: requiresPosturalChanges=true (flag clínico
        // explícito, p.ej. encamado), nortonRisk=true (escala predictiva),
        // O tienen UPP activa.
        //
        // FIX 2026-05-31: filtrar status ACTIVE/TEMPORARY_LEAVE — antes el cron
        // disparaba notificaciones de rotación postural a cuidadores por
        // residentes DISCHARGED/DECEASED con UPPs históricas no marcadas como
        // RESOLVED. Falsa alerta = ruido operativo y erosiona la confianza
        // en las alertas reales.
        //
        // FIX 2026-06-16 (sprint nursing-upp-dashboard): añadido
        // requiresPosturalChanges al OR. Antes los pacientes flag-only
        // (encamado sin Norton sin úlcera) entraban al dashboard pero NO al
        // cron — quedaban sin push proactivo cuando se vencía la ventana.
        // Inconsistencia threshold cron-vs-postural (flat 2h vs 120/135)
        // sigue como follow-up — este cambio amplía señales, no umbrales.
        const atRiskPatients = await prisma.patient.findMany({
            where: {
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
                OR: [
                    { requiresPosturalChanges: true },
                    { nortonRisk: true },
                    { pressureUlcers: { some: { status: { not: 'RESOLVED' } } } }
                ]
            },
            select: {
                id: true,
                name: true,
                headquartersId: true,
                // Multi-señal: necesario para renderizar el fallback correcto
                // del activeUlcer string cuando NO hay UPP activa pero el
                // paciente está enrolado via flag o norton.
                requiresPosturalChanges: true,
                nortonRisk: true,
                posturalChanges: {
                    orderBy: { performedAt: 'desc' },
                    take: 1,
                    select: { performedAt: true, isComplianceAlert: true }
                },
                pressureUlcers: {
                    where: { status: { not: 'RESOLVED' } },
                    orderBy: { stage: 'desc' },
                    take: 1,
                    select: { stage: true, bodyLocation: true, status: true }
                }
            }
        });

        // ── Targeting + dedup (recorte de ruido, 17-ago-2026) ────────────
        //
        // Antes: por CADA paciente vencido, notificación a TODOS los
        // CAREGIVER+NURSE+SUPERVISOR de la sede, repetida cada corrida (2h).
        // Medido en prod: 36,500 notificaciones/30 días — el 86% de TODO el
        // ruido del sistema. Una cuidadora en su casa recibía "requiere cambio
        // de posición inmediato" 60 veces al día. Como advierte el comentario
        // de arriba: falsa alerta erosiona la confianza en las alertas reales.
        //
        // Ahora:
        //   1. CAREGIVERs: solo con turno ACTIVO (sesión abierta <14h) —
        //      el resto no puede rotar a nadie desde su casa.
        //   2. NURSE/SUPERVISOR: siguen (son la ruta de escalamiento).
        //   3. Dedup: máx 1 notificación por paciente/usuario/día. La
        //      persistencia del estado vive en el dashboard UPP, no en
        //      martillar la campana.
        const fourteenHrsAgo = new Date(now.getTime() - 14 * 3600 * 1000);
        // 00:00 AST de hoy = 04:00 UTC del día AST en curso
        const nowAST = new Date(now.getTime() - 4 * 3600 * 1000);
        const todayStart = new Date(Date.UTC(nowAST.getUTCFullYear(), nowAST.getUTCMonth(), nowAST.getUTCDate(), 4, 0, 0));

        const hqIds = [...new Set(atRiskPatients.map(p => p.headquartersId))];
        const [escalationStaff, activeSessions, notifiedToday] = await Promise.all([
            prisma.user.findMany({
                where: { headquartersId: { in: hqIds }, role: { in: ['NURSE', 'SUPERVISOR'] as any }, isActive: true, isDeleted: false },
                select: { id: true, headquartersId: true },
            }),
            prisma.shiftSession.findMany({
                where: { headquartersId: { in: hqIds }, actualEndTime: null, startTime: { gte: fourteenHrsAgo } },
                select: { caregiverId: true, headquartersId: true },
            }),
            prisma.notification.findMany({
                where: { type: 'SHIFT_ALERT', title: { startsWith: 'Alerta UPP' }, createdAt: { gte: todayStart } },
                select: { userId: true, title: true },
            }),
        ]);
        const targetsByHq = new Map<string, Set<string>>();
        for (const u of escalationStaff) {
            if (!targetsByHq.has(u.headquartersId)) targetsByHq.set(u.headquartersId, new Set());
            targetsByHq.get(u.headquartersId)!.add(u.id);
        }
        for (const s of activeSessions) {
            if (!targetsByHq.has(s.headquartersId)) targetsByHq.set(s.headquartersId, new Set());
            targetsByHq.get(s.headquartersId)!.add(s.caregiverId);
        }
        // Clave de dedup: userId + título (el título lleva el nombre del paciente)
        const alreadyNotified = new Set(notifiedToday.map(n => `${n.userId}|${n.title}`));

        const violations: object[] = [];
        const toCreate: { userId: string; type: string; title: string; message: string; link: string; isRead: boolean }[] = [];

        for (const patient of atRiskPatients) {
            const lastRotation = patient.posturalChanges[0];
            const activeUlcer = patient.pressureUlcers[0] ?? null;

            const isSlaViolation = !lastRotation || lastRotation.performedAt < limitTime;
            if (!isSlaViolation) continue;

            const hoursOverdue = lastRotation
                ? ((now.getTime() - lastRotation.performedAt.getTime()) / (1000 * 60 * 60)).toFixed(1)
                : 'Crítico (+24h)';

            // Fallback text del campo activeUlcer del audit: refleja POR QUÉ
            // el paciente entró al at-risk set cuando no hay UPP material.
            // Antes: hardcoded "Sin UPP (nortonRisk)" — incorrecto para
            // flag-only o pacientes con ambos triggers.
            const enrollmentReason = activeUlcer
                ? `Estadio ${activeUlcer.stage} — ${activeUlcer.bodyLocation}`
                : patient.requiresPosturalChanges
                    ? 'Sin UPP (encamado)'
                    : patient.nortonRisk
                        ? 'Sin UPP (nortonRisk)'
                        : 'Sin UPP';

            violations.push({
                patientId: patient.id,
                patientName: patient.name,
                lastRotationTime: lastRotation?.performedAt ?? 'Ninguna',
                hoursOverdue,
                activeUlcer: enrollmentReason,
            });

            const ulcerDetail = activeUlcer
                ? ` UPP Estadio ${activeUlcer.stage} en ${activeUlcer.bodyLocation}.`
                : '';

            // El título lleva el nombre para que el dedup sea por paciente.
            const title = `Alerta UPP — ${patient.name.trim()}`;
            const message = `Lleva más de ${hoursOverdue}h sin rotación postural.${ulcerDetail} Requiere cambio de posición inmediato.`;
            const targets = targetsByHq.get(patient.headquartersId) ?? new Set<string>();
            for (const userId of targets) {
                if (alreadyNotified.has(`${userId}|${title}`)) continue;
                toCreate.push({ userId, type: 'SHIFT_ALERT', title, message, link: '/care', isRead: false });
            }
        }

        if (toCreate.length > 0) {
            await prisma.notification.createMany({ data: toCreate });
        }

        return NextResponse.json({
            ok: true,
            message: 'Auditoría UPP completada.',
            scannedPatients: atRiskPatients.length,
            violationsDetected: violations.length,
            notificationsSent: toCreate.length,
            onShiftCaregivers: activeSessions.length,
            violations,
        });

    } catch (error: any) {
        console.error('[cron/upp-alerts] error:', error);
        return NextResponse.json(
            { error: 'Fallo interno en auditoría UPP', detail: error.message },
            { status: 500 }
        );
    }
}
