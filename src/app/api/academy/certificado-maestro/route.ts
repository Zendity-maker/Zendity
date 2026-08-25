import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emitirCodigoMaestro } from '@/lib/certificado';

/**
 * GET /api/academy/certificado-maestro
 *
 * Datos del certificado maestro de quien pide, emitiendo el codigo si aun no
 * lo tenia. Solo para uno mismo: el maestro se descarga desde la propia
 * Academy y no hay caso de uso para pedir el de otro.
 *
 * Comprueba en el servidor que estan TODOS los cursos aprobados. El boton de
 * la UI ya lo mira, pero un boton no es una comprobacion.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const codigo = await emitirCodigoMaestro(userId);
        if (!codigo) {
            return NextResponse.json(
                { success: false, error: 'Aun no has aprobado todos los cursos del programa.' },
                { status: 400 },
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                name: true,
                masterCertIssuedAt: true,
                headquarters: { select: { name: true } },
            },
        });

        // La fecha del maestro es la del ultimo curso aprobado: es cuando la
        // persona termino el programa, no cuando pulso descargar.
        const ultimo = await prisma.userCourse.findFirst({
            where: { employeeId: userId, status: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
            select: { completedAt: true },
        });

        return NextResponse.json({
            success: true,
            codigo,
            nombre: user?.name ?? 'Empleado',
            aprobadoEl: ultimo?.completedAt ?? user?.masterCertIssuedAt ?? new Date(),
            sede: user?.headquarters?.name ?? '',
        });
    } catch (e: any) {
        console.error('[certificado-maestro] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
