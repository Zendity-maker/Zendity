import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
import { notifyUser } from '@/lib/notifications';

// POST /api/care/supervisor/close-task
//
// Permite a un supervisor cerrar manualmente una FastActionAssignment
// como COMPLETED o FAILED — sin penalidad automática de compliance.
// El cuidador recibe notificación del cierre.

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

const CloseTaskBody = z.object({
    assignmentId: z.string().min(1, 'assignmentId requerido'),
    status:       z.enum(['COMPLETED', 'FAILED']),
});

export async function POST(req: Request) {
    try {
        // requireRole soporta secondaryRoles por diseño (FASE 51: SUPERVISOR + CAREGIVER)
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { headquartersId: invokerHqId } = auth;
        const supervisorName = auth.name || 'Supervisor';

        const rawBody = await req.json().catch(() => null);
        const parsed = CloseTaskBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { assignmentId, status } = parsed.data;

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
            link: '/care',
        });

        return NextResponse.json({ success: true, task: updated });
    } catch (error: any) {
        logError('care.supervisor.close_task.post', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error cerrando tarea' },
            { status: 500 }
        );
    }
}
