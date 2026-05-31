import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/corporate/external-services/[id]/approve
 *
 * El director aprueba una visita PENDING_REVIEW → status PUBLISHED.
 *
 * Efectos:
 *   1. Actualiza visit: status, reviewedById, reviewedAt
 *   2. Si notifyFamilies=true: notifica al FamilyMember registrado de cada
 *      paciente afectado. Si isFacilityWide, "paciente afectado" = todos los
 *      ACTIVE/TEMPORARY_LEAVE de la sede al momento de la aprobación.
 *   3. Audit log
 *
 * Si la visita no está en PENDING_REVIEW (ya aprobada/rechazada/auto-publicada),
 * devuelve 409 con info del estado actual.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: visitId } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const visit = await prisma.externalServiceVisit.findFirst({
            where: { id: visitId, headquartersId: hqId },
            include: {
                provider: { include: { category: true } },
                patientVisits: { select: { patientId: true } },
            },
        });
        if (!visit) {
            return NextResponse.json({ success: false, error: 'Visita no encontrada' }, { status: 404 });
        }
        if (visit.status !== 'PENDING_REVIEW') {
            return NextResponse.json(
                { success: false, error: `Esta visita ya está en estado ${visit.status}` },
                { status: 409 },
            );
        }

        // Resolver patientIds afectados (incluye facilityWide)
        let affectedPatientIds: string[];
        if (visit.isFacilityWide) {
            const active = await prisma.patient.findMany({
                where: { headquartersId: hqId, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
                select: { id: true },
            });
            affectedPatientIds = active.map(p => p.id);
        } else {
            affectedPatientIds = visit.patientVisits.map(pv => pv.patientId);
        }

        // Actualizar visita
        await prisma.externalServiceVisit.update({
            where: { id: visitId },
            data: {
                status: 'PUBLISHED',
                reviewedById: auth.id,
                reviewedAt: new Date(),
            },
        });

        // Notificar familias por email — best effort.
        // Notification.userId tiene FK a User; los FamilyMember no son User,
        // así que la campana de la app no aplica. Email vía SendGrid es la vía.
        // La familia descubre la visita al abrir su portal /family/feed.
        let notifiedFamilies = 0;
        if (visit.notifyFamilies && affectedPatientIds.length > 0 && process.env.SENDGRID_API_KEY) {
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
                const icon = visit.provider.category.icon || '🏷️';
                const providerName = visit.provider.name;
                const serviceLabel = visit.serviceType ? ` · ${visit.serviceType}` : '';
                const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
                for (const fm of families) {
                    if (!fm.email) continue;
                    try {
                        await sgMail.send({
                            to: fm.email,
                            from: fromEmail,
                            subject: `${icon} Nueva visita a ${fm.patient?.name || 'tu ser querido'}`,
                            text: `Hola ${fm.name || ''},\n\n${providerName}${serviceLabel} visitó hoy en Vivid Senior Living Cupey.\n\nEntra a app.zendity.com/family/feed para ver detalles.\n\n— Equipo Zéndity`,
                            html: `<div style="font-family: system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
                                <h2 style="color:#0F6E56;">${icon} Visita externa registrada</h2>
                                <p>Hola <strong>${fm.name || ''}</strong>,</p>
                                <p><strong>${providerName}</strong>${serviceLabel} visitó hoy a <strong>${fm.patient?.name || 'tu ser querido'}</strong> en Vivid Senior Living Cupey.</p>
                                <p><a href="https://app.zendity.com/family/feed" style="display:inline-block;background:#0F6E56;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver en el portal →</a></p>
                                <p style="color:#64748b;font-size:13px;margin-top:32px;">— Equipo Zéndity</p>
                            </div>`,
                        });
                        notifiedFamilies++;
                    } catch (e) {
                        logWarn('external-services.approve.email', e, { familyMemberId: fm.id });
                    }
                }
            } catch (e) {
                logWarn('external-services.approve.notify_families', e, { visitId });
            }
        }

        // Audit log
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ExternalServiceVisit',
                    entityId: visitId,
                    action: SystemAuditAction.STATE_CHANGED,
                    performedById: auth.id,
                    payloadChanges: {
                        trigger: 'DIRECTOR_APPROVE',
                        from: 'PENDING_REVIEW',
                        to: 'PUBLISHED',
                        affectedPatients: affectedPatientIds.length,
                        notifiedFamilies,
                    },
                },
            });
        } catch (e) {
            logWarn('external-services.approve.audit', e, { visitId });
        }

        return NextResponse.json({
            success: true,
            visitId,
            affectedPatients: affectedPatientIds.length,
            notifiedFamilies,
            message: `Visita publicada. ${notifiedFamilies} familia${notifiedFamilies === 1 ? '' : 's'} notificada${notifiedFamilies === 1 ? '' : 's'}.`,
        });
    } catch (err: any) {
        logError('corporate.external-services.approve', err);
        return NextResponse.json({ success: false, error: 'Error aprobando visita' }, { status: 500 });
    }
}
