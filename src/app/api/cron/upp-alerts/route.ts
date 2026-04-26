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

        // Pacientes en riesgo: nortonRisk=true O tienen UPP activa
        const atRiskPatients = await prisma.patient.findMany({
            where: {
                OR: [
                    { nortonRisk: true },
                    { pressureUlcers: { some: { status: { not: 'RESOLVED' } } } }
                ]
            },
            select: {
                id: true,
                name: true,
                headquartersId: true,
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

            violations.push({
                patientId: patient.id,
                patientName: patient.name,
                lastRotationTime: lastRotation?.performedAt ?? 'Ninguna',
                hoursOverdue,
                activeUlcer: activeUlcer
                    ? `Estadio ${activeUlcer.stage} — ${activeUlcer.bodyLocation}`
                    : 'Sin UPP (nortonRisk)',
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
