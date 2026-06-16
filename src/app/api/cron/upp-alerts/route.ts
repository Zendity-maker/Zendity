import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';

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

        const violations: object[] = [];
        const notifyPromises: Promise<unknown>[] = [];

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

            notifyPromises.push(
                notifyRoles(
                    patient.headquartersId,
                    ['CAREGIVER', 'NURSE', 'SUPERVISOR'],
                    {
                        type: 'SHIFT_ALERT',
                        title: 'Alerta UPP — Rotación vencida',
                        message: `${patient.name} lleva más de ${hoursOverdue}h sin rotación postural.${ulcerDetail} Requiere cambio de posición inmediato.`,
                        link: '/care',
                    }
                )
            );
        }

        await Promise.allSettled(notifyPromises);

        return NextResponse.json({
            ok: true,
            message: 'Auditoría UPP completada.',
            scannedPatients: atRiskPatients.length,
            violationsDetected: violations.length,
            notificationsSent: notifyPromises.length,
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
