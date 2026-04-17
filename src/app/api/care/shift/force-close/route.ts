import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SystemAuditAction } from '@prisma/client';
import { notifyUser } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * POST /api/care/shift/force-close
 * Permite a un SUPERVISOR/DIRECTOR/ADMIN cerrar manualmente la sesión de turno
 * de otro cuidador de su misma sede. Registra audit log con el invocador real
 * y notifica al dueño del turno.
 *
 * Body: { shiftSessionId: string, reason?: string }
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const invokerId = (session.user as any).id;
        const invokerName = (session.user as any).name || 'Supervisor';
        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;

        if (!SUPERVISOR_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Solo SUPERVISOR, DIRECTOR o ADMIN pueden forzar cierre' }, { status: 403 });
        }

        const { shiftSessionId, reason } = await req.json();
        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: 'shiftSessionId requerido' }, { status: 400 });
        }

        const shiftSession = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: { caregiver: { select: { id: true, name: true } } }
        });

        if (!shiftSession) {
            return NextResponse.json({ success: false, error: 'Sesión no encontrada' }, { status: 404 });
        }

        // Tenant check
        if (shiftSession.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'La sesión no pertenece a tu sede' }, { status: 403 });
        }

        if (shiftSession.actualEndTime) {
            return NextResponse.json({ success: false, error: 'La sesión ya fue cerrada' }, { status: 400 });
        }

        const now = new Date();
        const reasonText = (reason && typeof reason === 'string' && reason.trim()) || 'Sin razón especificada';

        // Cierre + reporte
        const closed = await prisma.shiftSession.update({
            where: { id: shiftSessionId },
            data: {
                actualEndTime: now,
                aiSummaryReport: `Cierre forzado por ${invokerName} — Razón: ${reasonText}`,
            },
        });

        // Audit log con el invocador real
        await prisma.systemAuditLog.create({
            data: {
                headquartersId: shiftSession.headquartersId,
                entityName: 'ShiftSession',
                entityId: shiftSession.id,
                action: SystemAuditAction.SYSTEM_ABANDONED,
                performedById: invokerId,
                payloadChanges: {
                    closedBySupervisor: true,
                    supervisorName: invokerName,
                    supervisorRole: invokerRole,
                    ownerCaregiverId: shiftSession.caregiverId,
                    ownerCaregiverName: shiftSession.caregiver?.name || null,
                    reason: reasonText,
                    hoursOpen: ((now.getTime() - new Date(shiftSession.startTime).getTime()) / 3600000).toFixed(2),
                },
            },
        });

        // Notificar al cuidador afectado
        try {
            await notifyUser(shiftSession.caregiverId, {
                type: 'SHIFT_ALERT',
                title: 'Tu turno fue cerrado por el supervisor',
                message: `${invokerName} cerró tu sesión. Razón: ${reasonText}`,
            });
        } catch (e) {
            console.error('[force-close notify]', e);
        }

        return NextResponse.json({
            success: true,
            closedBy: invokerName,
            shiftSession: closed,
        });

    } catch (err: any) {
        console.error('[force-close]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error cerrando turno' }, { status: 500 });
    }
}
