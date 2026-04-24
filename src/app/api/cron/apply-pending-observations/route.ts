import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { IncidentStatus } from '@prisma/client';

// Vercel Cron: cada 6 horas (vercel.json: "0 */6 * * *")
// Aplica automáticamente las observaciones PENDING_EXPLANATION
// que no recibieron respuesta del empleado en 72 horas.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL'}`) {
        return NextResponse.json({ error: 'Firma CRON inválida' }, { status: 401 });
    }

    try {
        const now = new Date();
        const threshold72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

        // Buscar todas las observaciones PENDING_EXPLANATION sin respuesta
        // que superaron las 72 horas desde su creación
        const overdue = await prisma.incidentReport.findMany({
            where: {
                status: IncidentStatus.PENDING_EXPLANATION,
                createdAt: { lt: threshold72h },
                employeeResponse: null,
            },
            include: {
                employee: {
                    select: { id: true, name: true, complianceScore: true }
                },
                hq: { select: { name: true } }
            }
        });

        if (overdue.length === 0) {
            return NextResponse.json({
                ok: true,
                message: 'Sin observaciones vencidas.',
                applied: 0,
                runAt: now.toISOString(),
            });
        }

        const results: { id: string; employee: string; hq: string; status: string }[] = [];

        for (const incident of overdue) {
            try {
                // severity OBSERVATION → 0 puntos; otros tipos deducen
                const delta = incident.severity === 'OBSERVATION' ? 0
                    : incident.severity === 'WARNING' ? -5
                    : incident.severity === 'SUSPENSION' ? -15
                    : 0;
                const currentScore = incident.employee?.complianceScore ?? 50;
                const newScore = Math.max(0, currentScore + delta);
                const pointsDeducted = Math.abs(delta);

                await prisma.$transaction([
                    prisma.incidentReport.update({
                        where: { id: incident.id },
                        data: {
                            status: IncidentStatus.APPLIED,
                            appliedAt: now,
                            pointsDeducted,
                        }
                    }),
                    prisma.user.update({
                        where: { id: incident.employeeId },
                        data: { complianceScore: newScore }
                    })
                ]);

                // Notificación in-app al empleado
                await notifyUser(incident.employeeId, {
                    type: 'EMAR_ALERT',
                    title: 'Observación aplicada automáticamente',
                    message: `Observación aplicada automáticamente por no responder en 72 horas. Puntos deducidos: ${pointsDeducted}.`,
                    link: `/my-observations/${incident.id}`,
                });

                results.push({
                    id: incident.id,
                    employee: incident.employee?.name || incident.employeeId,
                    hq: incident.hq?.name || incident.headquartersId,
                    status: 'APPLIED',
                });

                console.log(`[cron/apply-pending-observations] APPLIED ${incident.id} — ${incident.employee?.name} (${incident.hq?.name})`);
            } catch (err: any) {
                console.error(`[cron/apply-pending-observations] Error en ${incident.id}:`, err.message);
                results.push({
                    id: incident.id,
                    employee: incident.employee?.name || incident.employeeId,
                    hq: incident.hq?.name || incident.headquartersId,
                    status: `ERROR: ${err.message}`,
                });
            }
        }

        const appliedCount = results.filter(r => r.status === 'APPLIED').length;

        return NextResponse.json({
            ok: true,
            message: `${appliedCount} observación(es) aplicada(s) automáticamente por vencimiento de 72h.`,
            applied: appliedCount,
            errors: results.length - appliedCount,
            runAt: now.toISOString(),
            details: results,
        });

    } catch (error: any) {
        console.error('[cron/apply-pending-observations] error fatal:', error);
        return NextResponse.json(
            { error: 'Fallo interno en cron', detail: error.message },
            { status: 500 }
        );
    }
}
