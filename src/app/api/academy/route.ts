import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyScoreEvent } from '@/lib/score-event';
import { notifyUser, notifyRoles } from '@/lib/notifications';



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
        console.error("Academy GET Error:", error);
        return NextResponse.json({ success: false, error: "Fallo leyendo el catálogo formativo" }, { status: 500 });
    }
}

// 2. CERTIFICAR COMPLETACIÓN DE CURSO Y AUMENTAR SCORE DEL USUARIO
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employeeId, courseId, hqId, examScore } = body;

        if (!employeeId || !courseId || !hqId) {
            return NextResponse.json({ success: false, error: "Datos de certificación incompletos" }, { status: 400 });
        }

        // Obtener Cuántos puntos vale el curso
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new Error("Course not found");

        const bonus = course.bonusCompliance;

        // 1. Certificar curso
        const enrollment = await prisma.userCourse.upsert({
            where: { employeeId_courseId: { employeeId, courseId } },
            update:  { status: 'COMPLETED', score: examScore || 100, completedAt: new Date() },
            create:  { employeeId, courseId, headquartersId: hqId, status: 'COMPLETED', score: examScore || 100, completedAt: new Date() },
        });

        // 2. Score con historial + notificaciones celebración
        const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { name: true, headquartersId: true } });
        const scoreEvt = await applyScoreEvent(employeeId, hqId, bonus,
            `Curso completado: ${course.title || course.id}`, 'ACADEMY');

        // 3. Notificación de celebración al empleado
        await notifyUser(employeeId, {
            type:    'COURSE_COMPLETED',
            title:   '🎉 ¡Curso completado!',
            message: `Completaste "${course.title || 'el curso'}". Tu Z-Score subió +${bonus} puntos. ¡Sigue aprendiendo!`,
        });

        // 4. Notificación al equipo supervisor (best-effort)
        try {
            await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type:    'SHIFT_ALERT',
                title:   '🎓 Logro del equipo',
                message: `${employee?.name || 'Un empleado'} completó el curso "${course.title || course.id}" en Academy. ¡Felicitaciones!`,
            });
        } catch { /* no-fatal */ }

        return NextResponse.json({ success: true, enrollment, newComplianceScore: scoreEvt?.scoreAfter ?? null });

    } catch (error) {
        console.error("Academy POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo emitiendo Certificación Zendity" }, { status: 500 });
    }
}
