import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { avisoFamiliaSinPHI } from '@/lib/family-email';
import { notifyRoles } from '@/lib/notifications';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { requireCronSecret } from '@/lib/cron-auth';

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
    const denied = requireCronSecret(req);
    if (denied) return denied;

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
                    // El proveedor NO va por correo: si es un hospicio, el nombre del
                    // proveedor ES el diagnóstico. Ver src/lib/family-email.ts.
                    const aviso = avisoFamiliaSinPHI({
                        hqName: 'Vivid Senior Living Cupey',
                        titulo: 'Visita registrada',
                        detalle: 'Se registró una visita de servicio en el hogar. Los detalles están en el portal familiar.',
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
                                subject: aviso.subject,
                                text: aviso.text,
                                html: avisoFamiliaSinPHI({
                                    familyName: fm.name,
                                    hqName: 'Vivid Senior Living Cupey',
                                    titulo: 'Visita registrada',
                                    detalle: 'Se registró una visita de servicio en el hogar. Los detalles están en el portal familiar.',
                                }).html,
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
