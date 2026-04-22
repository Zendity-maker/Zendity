import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser } from '@/lib/notifications';

// Sprint FastAction Fix:
// GET  — auth con session. Solo devuelve PENDING no expiradas del cuidador en sesión.
//         Auto-fail eliminado: tareas vencidas no se muestran, sin penalidad.
// POST — deprecado (410). Usar POST /api/care/supervisor/dispatch.
// PATCH — auth con session. Solo el cuidador asignado puede marcar su tarea COMPLETED.
//          Supervisores cierran tareas vía POST /api/care/supervisor/close-task (sin penalidad).

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const caregiverId = session.user.id;
        const now = new Date();

        // Devuelve solo PENDING activas (no expiradas) — sin auto-fail, sin deducción.
        const validTasks = await prisma.fastActionAssignment.findMany({
            where: {
                caregiverId,
                status: 'PENDING',
                expiresAt: { gt: now },
            },
            include: {
                supervisor: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, tasks: validTasks });
    } catch (error) {
        console.error('[fast-actions] GET error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// POST — deprecado. El despacho autenticado vive en /api/care/supervisor/dispatch.
export async function POST() {
    return NextResponse.json(
        {
            success: false,
            error: 'Este endpoint fue deprecado. Usar POST /api/care/supervisor/dispatch para crear tareas.',
        },
        { status: 410 }
    );
}

// PATCH — solo el cuidador asignado puede completar su propia tarea.
// Supervisores usan POST /api/care/supervisor/close-task.
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const id = body.id || body.taskId;

        if (!id) {
            return NextResponse.json({ success: false, error: 'id es requerido' }, { status: 400 });
        }

        const task = await prisma.fastActionAssignment.findUnique({
            where: { id },
            include: {
                caregiver: { select: { id: true, name: true } },
            },
        });

        if (!task) {
            return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 });
        }

        // Solo el cuidador asignado puede completar por este endpoint
        if (task.caregiverId !== session.user.id) {
            return NextResponse.json(
                { success: false, error: 'Solo el cuidador asignado puede completar esta tarea' },
                { status: 403 }
            );
        }

        if (task.status !== 'PENDING') {
            return NextResponse.json(
                { success: false, error: `La tarea ya está ${task.status}` },
                { status: 400 }
            );
        }

        const now = new Date();

        // Si la ventana venció, informar sin penalidad — supervisor cierra vía close-task
        if (now > task.expiresAt) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'La ventana de esta tarea ya venció. El supervisor puede cerrarla manualmente.',
                },
                { status: 400 }
            );
        }

        // Completar a tiempo
        const updatedTask = await prisma.fastActionAssignment.update({
            where: { id },
            data: { status: 'COMPLETED', completedAt: now },
        });

        // FIX 5 — Notificar al supervisor que la tarea fue completada
        await notifyUser(task.supervisorId, {
            type: 'SHIFT_ALERT',
            title: '✅ Tarea completada',
            message: `${task.caregiver?.name || 'El cuidador'} completó: ${task.description}`,
        });

        return NextResponse.json({ success: true, task: updatedTask });
    } catch (error) {
        console.error('[fast-actions] PATCH error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
