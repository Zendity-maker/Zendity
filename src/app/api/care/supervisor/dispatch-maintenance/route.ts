import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError, logWarn } from '@/lib/logger';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const DispatchMaintBody = z.object({
    headquartersId: z.string().optional(),
    sourceId:       z.string().min(1, 'sourceId requerido'),
    description:    z.string().min(1, 'descripción requerida').max(1000),
});

/**
 * Sprint R — Despachar ticket de mantenimiento al rol MAINTENANCE.
 *
 * Notifica a todos los usuarios MAINTENANCE + deja una notificación
 * informativa a DIRECTOR para visibilidad. Si el sourceId corresponde
 * a una Complaint, la marca con status ROUTED_MAINTENANCE.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: invokerHqId } = auth;
        const invokerName = auth.name || 'Supervisor';

        const rawBody = await req.json().catch(() => null);
        const parsed = DispatchMaintBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { headquartersId: bodyHqId, sourceId, description } = parsed.data;

        if (bodyHqId && bodyHqId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Sede fuera de tu alcance' }, { status: 403 });
        }
        const hqId = invokerHqId;

        const notifiedMaintenance = await notifyRoles(hqId, ['MAINTENANCE'], {
            type: 'SHIFT_ALERT',
            title: 'Tarea de Mantenimiento',
            message: description.slice(0, 500),
        });

        const notifiedDirector = await notifyRoles(hqId, ['DIRECTOR'], {
            type: 'SHIFT_ALERT',
            title: 'Mantenimiento notificado',
            message: `Ticket de mantenimiento enviado al área: ${description.slice(0, 300)}`,
        });

        // Si corresponde a una Complaint → marcar ROUTED_MAINTENANCE
        let complaintUpdated = false;
        const complaintCheck = await prisma.complaint.findUnique({
            where: { id: sourceId },
            select: { headquartersId: true },
        });
        if (complaintCheck && complaintCheck.headquartersId === hqId) {
            await prisma.complaint.update({
                where: { id: sourceId },
                data: { status: 'ROUTED_MAINTENANCE' },
            });
            complaintUpdated = true;
        }

        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: complaintUpdated ? 'Complaint' : 'TriageFeed',
                    entityId: sourceId,
                    action: SystemAuditAction.STATE_CHANGED,
                    performedById: invokerId,
                    payloadChanges: {
                        kind: 'DISPATCHED_MAINTENANCE',
                        sourceId,
                        description: description.slice(0, 500),
                        notifiedMaintenance,
                        notifiedDirector,
                        complaintUpdated,
                        invokerName,
                    } as any,
                },
            });
        } catch (e) { logWarn('care.supervisor.dispatch_maintenance.audit', e, { sourceId }); }

        return NextResponse.json({
            success: true,
            notifiedMaintenance,
            notifiedDirector,
            complaintUpdated,
        });
    } catch (error: any) {
        logError('care.supervisor.dispatch_maintenance.post', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error despachando a mantenimiento',
        }, { status: 500 });
    }
}
