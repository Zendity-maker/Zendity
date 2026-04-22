import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction, ColorGroup } from '@prisma/client';

// Vercel Cron: cada 6 horas (vercel.json: "0 */6 * * *")
// Detecta anomalías en DB de producción y notifica a DIRECTOR/ADMIN.
// Crea SystemAuditLog por cada sede con problemas detectados.
// Solo lectura — ningún check modifica datos.

interface AnomalyItem {
    check: string;
    count: number;
    detail?: string;
}

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL'}`) {
        return NextResponse.json({ error: 'Firma CRON Inválida' }, { status: 401 });
    }

    try {
        const now = new Date();
        const h14ago = new Date(now.getTime() - 14 * 60 * 60 * 1000);
        const h4ago  = new Date(now.getTime() -  4 * 60 * 60 * 1000);
        const h1ago  = new Date(now.getTime() -  1 * 60 * 60 * 1000);
        const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const d7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

        // ── Todos los HQs activos ─────────────────────────────────────
        const headquarters = await prisma.headquarters.findMany({
            select: { id: true, name: true },
        });

        const globalReport: Record<string, AnomalyItem[]> = {};
        let totalAnomalies = 0;

        // ── Checks GLOBALES (no por HQ) ───────────────────────────────
        const [
            badScores,
            orphanedFamily,
            nullScheduleTimes,
            staleIntake,
            dupeEmails,
        ] = await Promise.allSettled([
            // complianceScore fuera de rango (Int non-nullable, @default(50))
            prisma.user.findMany({
                where: {
                    isActive: true, isDeleted: false,
                    OR: [{ complianceScore: { lt: 0 } }, { complianceScore: { gt: 100 } }],
                },
                select: { name: true, complianceScore: true, headquartersId: true },
            }),
            // FamilyMember sin Patient
            prisma.$queryRaw<{ id: string; name: string; headquartersId: string }[]>`
                SELECT fm.id, fm.name, fm."headquartersId"
                FROM "FamilyMember" fm
                LEFT JOIN "Patient" p ON p.id = fm."patientId"
                WHERE p.id IS NULL
            `,
            // PatientMedication ACTIVE con scheduleTimes vacío (String non-nullable)
            prisma.patientMedication.findMany({
                where: { status: 'ACTIVE', isActive: true, scheduleTimes: '' },
                include: { patient: { select: { name: true, headquartersId: true } } },
            }),
            // IntakeData PENDING > 7 días
            prisma.intakeData.findMany({
                where: { status: 'PENDING', updatedAt: { lt: d7ago } },
                include: { patient: { select: { name: true, headquartersId: true } } },
            }),
            // Emails duplicados en FamilyMember
            prisma.$queryRaw<{ email: string; count: number }[]>`
                SELECT email, COUNT(*)::int AS count
                FROM "FamilyMember"
                GROUP BY email HAVING COUNT(*) > 1
            `,
        ]);

        // ── Checks POR HQ ─────────────────────────────────────────────
        await Promise.allSettled(
            headquarters.map(async (hq) => {
                const anomalies: AnomalyItem[] = [];

                const [
                    zombieSessions,
                    noColorPatients,
                    staleVitals,
                    staleFastActions,
                    oldNotifications,
                ] = await Promise.allSettled([
                    prisma.shiftSession.count({
                        where: { headquartersId: hq.id, actualEndTime: null, startTime: { lt: h14ago } },
                    }),
                    // colorGroup es enum ColorGroup con @default(UNASSIGNED) — no es nullable
                    prisma.patient.count({
                        where: { headquartersId: hq.id, status: 'ACTIVE', colorGroup: ColorGroup.UNASSIGNED },
                    }),
                    prisma.vitalsOrder.count({
                        where: { headquartersId: hq.id, status: 'PENDING', expiresAt: { lt: h4ago } },
                    }),
                    prisma.fastActionAssignment.count({
                        where: { headquartersId: hq.id, status: 'PENDING', expiresAt: { lt: h1ago } },
                    }),
                    prisma.notification.count({
                        where: { isRead: false, createdAt: { lt: h48ago }, user: { headquartersId: hq.id } },
                    }),
                ]);

                const z  = zombieSessions.status  === 'fulfilled' ? zombieSessions.value  : 0;
                const nc = noColorPatients.status  === 'fulfilled' ? noColorPatients.value : 0;
                const sv = staleVitals.status      === 'fulfilled' ? staleVitals.value     : 0;
                const sf = staleFastActions.status === 'fulfilled' ? staleFastActions.value : 0;
                const on = oldNotifications.status === 'fulfilled' ? oldNotifications.value : 0;

                if (z  > 0) anomalies.push({ check: 'ShiftSessions zombi (>14h sin cierre)', count: z });
                if (nc > 0) anomalies.push({ check: 'Patients ACTIVE sin colorGroup', count: nc });
                if (sv > 0) anomalies.push({ check: 'VitalsOrders PENDING vencidas >4h', count: sv });
                if (sf > 0) anomalies.push({ check: 'FastActionAssignment PENDING expiradas >1h', count: sf });
                if (on >= 50) anomalies.push({ check: 'Notifications no leídas >48h (acumulación)', count: on });

                // Añadir anomalías globales filtradas por HQ
                if (badScores.status === 'fulfilled') {
                    const hqBad = (badScores.value as any[]).filter((u: any) => u.headquartersId === hq.id);
                    if (hqBad.length > 0) anomalies.push({ check: 'complianceScore fuera de rango 0-100', count: hqBad.length });
                }
                if (orphanedFamily.status === 'fulfilled') {
                    const hqOrph = (orphanedFamily.value as any[]).filter((f: any) => f.headquartersId === hq.id);
                    if (hqOrph.length > 0) anomalies.push({ check: 'FamilyMember sin Patient válido', count: hqOrph.length });
                }
                if (nullScheduleTimes.status === 'fulfilled') {
                    const hqNull = (nullScheduleTimes.value as any[]).filter(
                        (m: any) => m.patient?.headquartersId === hq.id
                    );
                    if (hqNull.length > 0) anomalies.push({ check: 'PatientMedication ACTIVE sin scheduleTimes', count: hqNull.length });
                }
                if (staleIntake.status === 'fulfilled') {
                    const hqStale = (staleIntake.value as any[]).filter(
                        (i: any) => i.patient?.headquartersId === hq.id
                    );
                    if (hqStale.length > 0) anomalies.push({ check: 'IntakeData PENDING >7 días sin actualizar', count: hqStale.length });
                }

                if (anomalies.length === 0) return;

                totalAnomalies += anomalies.length;
                globalReport[hq.id] = anomalies;

                const summary = anomalies
                    .map(a => `• ${a.check}: ${a.count}`)
                    .join('\n');

                // ── Notificar a DIRECTOR y ADMIN de esta sede ──────────
                await notifyRoles(hq.id, ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'], {
                    type: 'SHIFT_ALERT',
                    title: `⚠️ Health Monitor — ${anomalies.length} alerta${anomalies.length > 1 ? 's' : ''} en ${hq.name}`,
                    message: `Zéndity detectó anomalías operativas:\n${summary}\n\nRevisa el panel de administración.`,
                });

                // ── Crear SystemAuditLog ────────────────────────────────
                await prisma.systemAuditLog.create({
                    data: {
                        headquartersId: hq.id,
                        entityName: 'HealthMonitor',
                        entityId: `health_${hq.id}_${now.toISOString().slice(0, 13)}`,
                        action: SystemAuditAction.AUDIT_REPORT_SENT,
                        clientIp: 'SystemCRON',
                        // Serializar a plain object para compatibilidad con Prisma Json
                        payloadChanges: JSON.parse(JSON.stringify({
                            anomaliesDetected: anomalies.length,
                            checks: anomalies,
                            runAt: now.toISOString(),
                        })),
                    },
                });
            })
        );

        // ── Reporte global de emails duplicados (no por HQ) ───────────
        const dupCount = dupeEmails.status === 'fulfilled' ? (dupeEmails.value as any[]).length : 0;

        return NextResponse.json({
            ok: true,
            message: 'Health Monitor completado.',
            runAt: now.toISOString(),
            headquartersScanned: headquarters.length,
            totalAnomalies,
            globalChecks: {
                duplicateFamilyEmails: dupCount,
            },
            reportByHq: globalReport,
        });

    } catch (error: any) {
        console.error('[cron/health-monitor] error:', error);
        return NextResponse.json(
            { error: 'Fallo interno en Health Monitor', detail: error.message },
            { status: 500 }
        );
    }
}
