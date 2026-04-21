import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * Sprint R — Despachar ticket de mantenimiento al rol MAINTENANCE.
 *
 * Notifica a todos los usuarios MAINTENANCE + deja una notificación
 * informativa a DIRECTOR para visibilidad. Si el sourceId corresponde
 * a una Complaint, la marca con status ROUTED_MAINTENANCE.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerId = (session.user as any).id;
        const invokerName = (session.user as any).name || 'Supervisor';
        const invokerHqId = (session.user as any).headquartersId;

        const body = await req.json();
        const { headquartersId: bodyHqId, sourceId, description } = body;

        if (!sourceId || !description) {
            return NextResponse.json({ success: false, error: 'sourceId y description requeridos' }, { status: 400 });
        }

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
        } catch (e) { console.error('[dispatch-maintenance audit]', e); }

        return NextResponse.json({
            success: true,
            notifiedMaintenance,
            notifiedDirector,
            complaintUpdated,
        });
    } catch (error: any) {
        console.error('dispatch-maintenance error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error despachando a mantenimiento',
        }, { status: 500 });
    }
}
