import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emitirCodigo } from '@/lib/certificado';

/**
 * GET /api/academy/certificado/[userCourseId]
 *
 * Devuelve los datos con los que se dibuja el certificado, emitiendo el código
 * si aún no existía. El PDF ya no se arma con lo que el navegador tenga a mano:
 * antes recibía nombre, curso y `new Date()` como textos sueltos, así que la
 * fecha era la del día en que se pulsaba imprimir y no la de aprobación.
 *
 * Solo lo puede pedir la propia persona, o quien administra la Academy.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ userCourseId: string }> },
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const { userCourseId } = await params;
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHq = (session.user as any).headquartersId;

        const uc = await prisma.userCourse.findUnique({
            where: { id: userCourseId },
            select: {
                id: true,
                status: true,
                completedAt: true,
                certificateExpiresAt: true,
                headquartersId: true,
                employeeId: true,
                certificateRevokedAt: true,
                employee: { select: { name: true } },
                course: { select: { title: true } },
                headquarters: { select: { name: true } },
            },
        });

        if (!uc || uc.headquartersId !== invokerHq) {
            return NextResponse.json({ success: false, error: 'Certificado no encontrado' }, { status: 404 });
        }

        const PUEDE_ADMINISTRAR = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'];
        const esSuyo = uc.employeeId === invokerId;
        if (!esSuyo && !PUEDE_ADMINISTRAR.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

        if (uc.status !== 'COMPLETED') {
            return NextResponse.json({ success: false, error: 'El curso no está aprobado' }, { status: 400 });
        }
        if (uc.certificateRevokedAt) {
            return NextResponse.json({ success: false, error: 'Este certificado fue revocado' }, { status: 410 });
        }

        const codigo = await emitirCodigo(userCourseId);
        if (!codigo) {
            return NextResponse.json({ success: false, error: 'No se pudo emitir el código' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            codigo,
            nombre: uc.employee.name,
            curso: uc.course.title,
            // La fecha real de aprobación, no la de hoy.
            aprobadoEl: uc.completedAt,
            // Se relee tras emitir: emitirCodigo lo escribe, asi que el objeto
            // de arriba puede traerlo nulo la primera vez.
            venceEl: (await prisma.userCourse.findUnique({
                where: { id: userCourseId }, select: { certificateExpiresAt: true },
            }))?.certificateExpiresAt ?? null,
            sede: uc.headquarters.name,
        });
    } catch (e: any) {
        console.error('[academy/certificado] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
