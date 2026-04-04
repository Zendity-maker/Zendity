import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



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
                    OR: [
                        { isGlobal: true, targetRole: null },
                        { headquartersId: hqId, targetRole: null },
                        { targetRole: userRole }
                    ]
                },
                orderBy: [{ isGlobal: 'desc' }, { createdAt: 'asc' }]
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

        // Transacción Atómica Zendity: Certificar & Actualizar Usuario
        const [enrollment, updatedUser] = await prisma.$transaction([
            prisma.userCourse.upsert({
                where: { employeeId_courseId: { employeeId, courseId } },
                update: {
                    status: 'COMPLETED',
                    score: examScore || 100,
                    completedAt: new Date()
                },
                create: {
                    employeeId,
                    courseId,
                    headquartersId: hqId,
                    status: 'COMPLETED',
                    score: examScore || 100,
                    completedAt: new Date()
                }
            }),
            // Incrementa score. Faltaría la doble verificación para isShiftBlocked desde CRON job u otro sistema, por ahora sumamos.
            prisma.user.update({
                where: { id: employeeId },
                data: {
                    complianceScore: { increment: bonus }
                }
            })
        ]);

        return NextResponse.json({ success: true, enrollment, newComplianceScore: updatedUser.complianceScore });

    } catch (error) {
        console.error("Academy POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo emitiendo Certificación Zendity" }, { status: 500 });
    }
}
