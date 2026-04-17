import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, courseId } = body;

        const existing = await prisma.userCourse.findFirst({
            where: { employeeId: userId, courseId }
        });

        if (existing) {
            // Marcar como completado
            await prisma.userCourse.update({
                where: { id: existing.id },
                data: { status: 'COMPLETED' }
            });

            // DESBLOQUEO AUTOMÁTICO RRHH
            // Si el usuario estaba bloqueado por RRHH, este curso de refuerzo le devuelve el pase operativo.
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user?.isShiftBlocked) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        isShiftBlocked: false,
                        blockReason: null
                    }
                });
            }

            // Notificar al mismo usuario que completó el curso
            try {
                const course = await prisma.course.findUnique({
                    where: { id: courseId },
                    select: { title: true }
                });
                const courseName = course?.title || 'el curso';
                await notifyUser(userId, {
                    type: 'COURSE_COMPLETED',
                    title: '¡Curso completado!',
                    message: `Completaste '${courseName}'. Tu certificado está listo.`,
                });
            } catch (e) { console.error('[notify COURSE_COMPLETED]', e); }

            return NextResponse.json({ success: true, unblocked: user?.isShiftBlocked }, { status: 200 });
        }

        return NextResponse.json({ success: false, error: 'Not enrolled' }, { status: 400 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to complete course' }, { status: 500 });
    }
}
