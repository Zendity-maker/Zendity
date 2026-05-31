import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';
import sgMail from '@sendgrid/mail';

export const dynamic = 'force-dynamic';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * GET /api/cron/external-services-sla
 *
 * Cron horario que mantiene el SLA del flujo de aprobación de visitas externas.
 *
 * Reglas:
 *   1. Visitas PENDING_REVIEW con registeredAt > 12h y <24h
 *      → notifica al director con recordatorio (UNA vez por visita, vía flag
 *        en payload del SystemAuditLog para evitar spam).
 *   2. Visitas PENDING_REVIEW con registeredAt ≥ 24h
 *      → auto-publica con status=PUBLISHED, autoPublished=true.
 *        Envía email a las familias (igual que approve manual) si
 *        notifyFamilies=true. Audit log.
 *
 * Auth: Bearer CRON_SECRET (mismo patrón que otros crons en /api/cron/*).
 * Schedule: vercel.json — sugerido every hour.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
        // ── (1) Recordatorios: 12-24h ───────────────────────────────────────
        // Encuentra pendientes en ventana 12-24h y verifica si ya se recordó.
        // El recordatorio se loguea en SystemAuditLog con trigger='SLA_REMINDER'
        // y entityId=visit.id. Si ya hay uno, no reenviamos.
        const reminderCandidates = await prisma.externalServiceVisit.findMany({
            where: {
                status: 'PENDING_REVIEW',
                registeredAt: { gte: twentyFourHoursAgo, lt: twelveHoursAgo },
            },
            include: {
                provider: { include: { category: true } },
            },
        });

        let remindersSent = 0;
        for (const v of reminderCandidates) {
            const alreadyReminded = await prisma.systemAuditLog.findFirst({
                where: {
                    entityName: 'ExternalServiceVisit',
                    entityId: v.id,
                    payloadChanges: { path: ['trigger'], equals: 'SLA_REMINDER' },
                },
                select: { id: true },
            });
            if (alreadyReminded) continue;

            await notifyRoles(v.headquartersId, ['DIRECTOR', 'ADMIN'], {
                type: 'EXTERNAL_VISIT_PENDING',
                title: '⏰ Visita externa pendiente (>12h)',
                message: `${v.provider.category.icon || ''} ${v.provider.name}: lleva 12h sin aprobar. Si pasa 24h se publicará automáticamente.`,
                link: '/corporate/external-services',
            });
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: v.headquartersId,
                    entityName: 'ExternalServiceVisit',
                    entityId: v.id,
                    action: SystemAuditAction.STATE_CHANGED,
                    payloadChanges: { trigger: 'SLA_REMINDER', sentAt: now.toISOString() },
                },
            }).catch(() => null);
            remindersSent++;
        }

        // ── (2) Auto-publish: ≥24h ──────────────────────────────────────────
        const autoCandidates = await prisma.externalServiceVisit.findMany({
            where: {
                status: 'PENDING_REVIEW',
                registeredAt: { lte: twentyFourHoursAgo },
            },
            include: {
                provider: { include: { category: true } },
                patientVisits: { select: { patientId: true } },
            },
        });

        let autoPublishedCount = 0;
        let totalFamiliesEmailed = 0;

        for (const v of autoCandidates) {
            // Resolver pacientes afectados
            let affectedPatientIds: string[];
            if (v.isFacilityWide) {
                const active = await prisma.patient.findMany({
                    where: { headquartersId: v.headquartersId, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
                    select: { id: true },
                });
                affectedPatientIds = active.map(p => p.id);
            } else {
                affectedPatientIds = v.patientVisits.map(pv => pv.patientId);
            }

            // Actualizar status
            await prisma.externalServiceVisit.update({
                where: { id: v.id },
                data: { status: 'PUBLISHED', autoPublished: true, reviewedAt: now },
            });
            autoPublishedCount++;

            // Notif familias por email — mismo template que approve manual
            if (v.notifyFamilies && affectedPatientIds.length > 0 && process.env.SENDGRID_API_KEY) {
                try {
                    const families = await prisma.familyMember.findMany({
                        where: {
                            patientId: { in: affectedPatientIds },
                            isRegistered: true,
                            passcode: { not: null },
                            patient: { status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
                        },
                        select: { id: true, email: true, name: true, patient: { select: { name: true } } },
                    });
                    const icon = v.provider.category.icon || '🏷️';
                    const providerName = v.provider.name;
                    const serviceLabel = v.serviceType ? ` · ${v.serviceType}` : '';
                    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
                    for (const fm of families) {
                        if (!fm.email) continue;
                        try {
                            await sgMail.send({
                                to: fm.email,
                                from: fromEmail,
                                subject: `${icon} Visita a ${fm.patient?.name || 'tu ser querido'}`,
                                text: `Hola ${fm.name || ''},\n\n${providerName}${serviceLabel} visitó en Vivid Senior Living Cupey.\n\nEntra a app.zendity.com/family/feed para ver detalles.\n\n— Equipo Zéndity`,
                                html: `<div style="font-family: system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
                                    <h2 style="color:#0F6E56;">${icon} Visita externa registrada</h2>
                                    <p>Hola <strong>${fm.name || ''}</strong>,</p>
                                    <p><strong>${providerName}</strong>${serviceLabel} visitó a <strong>${fm.patient?.name || 'tu ser querido'}</strong> en Vivid Senior Living Cupey.</p>
                                    <p><a href="https://app.zendity.com/family/feed" style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver en el portal →</a></p>
                                    <p style="color:#64748b;font-size:13px;margin-top:32px;">— Equipo Zéndity</p>
                                </div>`,
                            });
                            totalFamiliesEmailed++;
                        } catch (e) {
                            logWarn('cron.external-sla.email', e, { familyMemberId: fm.id });
                        }
                    }
                } catch (e) {
                    logWarn('cron.external-sla.families', e, { visitId: v.id });
                }
            }

            // Audit log
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: v.headquartersId,
                    entityName: 'ExternalServiceVisit',
                    entityId: v.id,
                    action: SystemAuditAction.STATE_CHANGED,
                    payloadChanges: {
                        trigger: 'SLA_AUTO_PUBLISH',
                        from: 'PENDING_REVIEW',
                        to: 'PUBLISHED',
                        affectedPatients: affectedPatientIds.length,
                    },
                },
            }).catch(() => null);
        }

        return NextResponse.json({
            success: true,
            remindersSent,
            autoPublishedCount,
            totalFamiliesEmailed,
        });
    } catch (err: any) {
        logError('cron.external-services-sla', err);
        return NextResponse.json({ success: false, error: err.message || 'Error en cron SLA' }, { status: 500 });
    }
}
