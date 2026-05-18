import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { applyScoreEvent } from '@/lib/score-event';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { logError, logWarn } from '@/lib/logger';

const CompleteBody = z.object({
    employeeId: z.string().min(1, 'employeeId requerido'),
    courseId:   z.string().min(1, 'courseId requerido'),
    hqId:       z.string().min(1, 'hqId requerido'),
    examScore:  z.coerce.number().int().min(0).max(100).optional(),
});

// 1. OBTENER CURSOS DISPONIBLES O HISTORIAL POR EMPLEADO
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const hqId = searchParams.get('hqId');
    const employeeId = searchParams.get('employeeId');

    if (!hqId) {
        return NextResponse.json({ success: false, error: "Headquarters ID requerido" }, { status: 400 });
    }

    try {
        if (employeeId) {
            // Historial de un Solo Empleado
            const enrollments = await prisma.userCourse.findMany({
                where: { employeeId },
                include: { course: true }
            });
            return NextResponse.json({ success: true, enrollments });

        } else {
            const userRole = searchParams.get('role') || '';
            // Catálogo Completo Sede — incluye cursos globales + cursos de la sede
            const catalog = await prisma.course.findMany({
                where: {
                    isActive: true,
                    headquartersId: hqId,
                    OR: [
                        { isGlobal: true, targetRole: null },
                        { targetRole: userRole }
                    ]
                },
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
            });
            return NextResponse.json({ success: true, catalog });
        }

    } catch (error) {
        logError('academy.get', error);
        return NextResponse.json({ success: false, error: "Fallo leyendo el catálogo formativo" }, { status: 500 });
    }
}

// 2. CERTIFICAR COMPLETACIÓN DE CURSO Y AUMENTAR SCORE DEL USUARIO
//
// Comportamiento (post-fix):
//   - Idempotente: si el curso ya está COMPLETED para el empleado, devuelve
//     éxito sin re-otorgar puntos ni re-notificar (evita doble-click bug).
//   - Delta real en la notificación: usa scoreAfter - scoreBefore (no el
//     `bonusCompliance` declarado del curso) para no mentir cuando el score
//     ya está en el cap de 100.
//   - Auto-desbloqueo: si el empleado tenía isShiftBlocked=true (bloqueado
//     por RRHH), completar un curso lo desbloquea automáticamente.
//   - Notificación al supervisor con link='/academy' para abrir el catálogo
//     en lugar de caer al fallback de SHIFT_ALERT.
export async function POST(req: Request) {
    try {
        const rawBody = await req.json().catch(() => null);
        const parsed = CompleteBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { employeeId, courseId, hqId, examScore } = parsed.data;

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
            return NextResponse.json({ success: false, error: "Curso no encontrado" }, { status: 404 });
        }

        // Idempotencia: si ya está COMPLETED, no re-aplicar nada.
        const existing = await prisma.userCourse.findUnique({
            where: { employeeId_courseId: { employeeId, courseId } },
            select: { id: true, status: true },
        });
        if (existing?.status === 'COMPLETED') {
            return NextResponse.json({
                success: true,
                alreadyCompleted: true,
                message: 'Este curso ya estaba completado.',
            });
        }

        const bonus = course.bonusCompliance;

        // 1. Marcar completado (upsert por si no existía enrollment previo)
        const enrollment = await prisma.userCourse.upsert({
            where: { employeeId_courseId: { employeeId, courseId } },
            update: { status: 'COMPLETED', score: examScore ?? 100, completedAt: new Date() },
            create: { employeeId, courseId, headquartersId: hqId, status: 'COMPLETED', score: examScore ?? 100, completedAt: new Date() },
        });

        // 2. Sumar puntos al Z-Score (clamp [0,100] interno)
        const employee = await prisma.user.findUnique({
            where: { id: employeeId },
            select: { name: true, headquartersId: true, isShiftBlocked: true },
        });
        const scoreEvt = await applyScoreEvent(
            employeeId, hqId, bonus,
            `Curso completado: ${course.title || course.id}`,
            'ACADEMY',
        );
        // Delta REAL aplicado (puede ser menor que bonus si el score llegó al cap).
        const realDelta = scoreEvt ? scoreEvt.scoreAfter - scoreEvt.scoreBefore : 0;

        // 3. Auto-desbloqueo si el empleado estaba bloqueado por RRHH.
        let unblocked = false;
        if (employee?.isShiftBlocked) {
            await prisma.user.update({
                where: { id: employeeId },
                data: { isShiftBlocked: false, blockReason: null },
            });
            unblocked = true;
        }

        // 4. Notificación al empleado con delta REAL.
        const scoreMessage = realDelta > 0
            ? `Tu Z-Score subió +${realDelta} puntos. ¡Sigue aprendiendo!`
            : `Ya estás en el máximo de Z-Score (100). ¡Excelente!`;
        const unblockMessage = unblocked
            ? ' Además, tu acceso a turnos fue restablecido.'
            : '';
        await notifyUser(employeeId, {
            type: 'COURSE_COMPLETED',
            title: '🎉 ¡Curso completado!',
            message: `Completaste "${course.title || 'el curso'}". ${scoreMessage}${unblockMessage}`,
            link: '/academy',
        });

        // 5. Notificación al equipo supervisor (best-effort) con link al catálogo.
        try {
            await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'COURSE_COMPLETED',
                title: '🎓 Logro del equipo',
                message: `${employee?.name || 'Un empleado'} completó el curso "${course.title || course.id}" en Academy.`,
                link: '/academy',
            });
        } catch (e) {
            logWarn('academy.post.notify_supervision', e, { employeeId, courseId });
        }

        return NextResponse.json({
            success: true,
            enrollment,
            newComplianceScore: scoreEvt?.scoreAfter ?? null,
            delta: realDelta,
            unblocked,
        });

    } catch (error) {
        logError('academy.post', error);
        return NextResponse.json({ success: false, error: "Fallo emitiendo Certificación Zendity" }, { status: 500 });
    }
}
