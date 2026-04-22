import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser } from '@/lib/notifications';

// POST /api/care/supervisor/close-task
//
// Permite a un supervisor cerrar manualmente una FastActionAssignment
// como COMPLETED o FAILED — sin penalidad automática de compliance.
// El cuidador recibe notificación del cierre.
//
// Body: { assignmentId: string, status: 'COMPLETED' | 'FAILED' }

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        // Soporta dual role (FASE 51): SUPERVISOR + CAREGIVER secundario
        const userRole = (session.user as any).role;
        const secondaryRoles: string[] = (session.user as any).secondaryRoles ?? [];
        const hasAccess =
            ALLOWED_ROLES.includes(userRole) ||
            secondaryRoles.some(r => ALLOWED_ROLES.includes(r));

        if (!hasAccess) {
            return NextResponse.json(
                { success: false, error: 'Solo supervisores pueden cerrar tareas' },
                { status: 403 }
            );
        }

        const invokerHqId = (session.user as any).headquartersId;
        const supervisorName = (session.user as any).name || 'Supervisor';

        const body = await req.json();
        const { assignmentId, status } = body;

        if (!assignmentId || !['COMPLETED', 'FAILED'].includes(status)) {
            return NextResponse.json(
                { success: false, error: 'assignmentId y status (COMPLETED|FAILED) son requeridos' },
                { status: 400 }
            );
        }

        const task = await prisma.fastActionAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                caregiver: { select: { id: true, name: true } },
            },
        });

        if (!task) {
            return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 });
        }

        // Tenant check — supervisor solo puede cerrar tareas de su sede
        if (task.headquartersId !== invokerHqId) {
            return NextResponse.json(
                { success: false, error: 'Esta tarea no pertenece a tu sede' },
                { status: 403 }
            );
        }

        if (task.status !== 'PENDING') {
            return NextResponse.json(
                { success: false, error: `La tarea ya está ${task.status}` },
                { status: 400 }
            );
        }

        const updated = await prisma.fastActionAssignment.update({
            where: { id: assignmentId },
            data: { status, completedAt: new Date() },
        });

        // Notificar al cuidador — sin penalidad, solo informativo
        await notifyUser(task.caregiverId, {
            type: 'SHIFT_ALERT',
            title: status === 'COMPLETED' ? '✅ Tarea cerrada por supervisor' : '❌ Tarea cerrada por supervisor',
            message: `${supervisorName} cerró la tarea "${task.description}" como ${status === 'COMPLETED' ? 'completada' : 'fallida'}.`,
        });

        return NextResponse.json({ success: true, task: updated });
    } catch (error: any) {
        console.error('[close-task] error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error cerrando tarea' },
            { status: 500 }
        );
    }
}
