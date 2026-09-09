import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcularDesempeno } from '@/lib/desempeno';

export const dynamic = 'force-dynamic';

/** Quién puede mirar el desempeño de OTRA persona. */
const PUEDEN_VER_A_OTROS = ['DIRECTOR', 'ADMIN', 'HR_MANAGER', 'SUPERVISOR'];

/**
 * GET /api/mi-desempeno            → el tuyo
 * GET /api/mi-desempeno?userId=X   → el de otro (dirección, RRHH, supervisión)
 *
 * ES LA MISMA CUENTA PARA LOS DOS. Hoy no lo es: el complianceScore RAW que ve
 * RRHH y el dinámico que ve la cuidadora en su perfil pueden dar números
 * distintos de la misma persona el mismo día. Que la empleada y su director
 * miren cifras distintas es lo que convierte una conversación de desempeño en
 * una discusión sobre el dato.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHq = (session.user as any).headquartersId;

        const { searchParams } = new URL(req.url);
        const pedido = searchParams.get('userId');
        const dias = Math.min(90, Math.max(7, parseInt(searchParams.get('dias') || '30', 10)));

        let objetivo = invokerId;
        if (pedido && pedido !== invokerId) {
            if (!PUEDEN_VER_A_OTROS.includes(invokerRole)) {
                return NextResponse.json({ success: false, error: 'Solo puedes ver el tuyo' }, { status: 403 });
            }
            // Y solo de su propia sede: el rol no basta.
            const otro = await prisma.user.findFirst({
                where: { id: pedido, headquartersId: invokerHq },
                select: { id: true },
            });
            if (!otro) {
                return NextResponse.json({ success: false, error: 'Empleado fuera de tu sede' }, { status: 403 });
            }
            objetivo = pedido;
        }

        const desempeno = await calcularDesempeno(objetivo, dias);
        if (!desempeno) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ success: true, desempeno, esPropio: objetivo === invokerId });
    } catch (error: any) {
        console.error('[mi-desempeno]', error);
        return NextResponse.json({ success: false, error: 'Error calculando el desempeño' }, { status: 500 });
    }
}
