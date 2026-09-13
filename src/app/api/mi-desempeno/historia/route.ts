import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcularHistoria } from '@/lib/desempeno-historia';

export const dynamic = 'force-dynamic';

/** Quién puede mirar la historia de OTRA persona. La misma lista que el resumen. */
const PUEDEN_VER_A_OTROS = ['DIRECTOR', 'ADMIN', 'HR_MANAGER', 'SUPERVISOR'];

/**
 * GET /api/mi-desempeno/historia            → la tuya
 * GET /api/mi-desempeno/historia?userId=X   → la de otro (dirección, RRHH, supervisión)
 *
 * UNA PERSONA POR PETICIÓN, A PROPÓSITO.
 *
 * No acepta `?userIds=` ni devuelve series de varias personas. Es la
 * restricción que impide que esto se convierta en el Z-Score otra vez: el día
 * que una respuesta traiga N series juntas, alguien arma el ranking en una
 * tarde — y ordenar a la plantilla por una métrica de documentación es
 * exactamente lo que se apagó el 09-sep-2026 (ver src/lib/z-score-visible.ts:
 * el "Top 5" de la pared eran los cuatro que menos documentan).
 *
 * Tampoco hay parámetro de rango: la serie es siempre desde su primer turno.
 * No hay nada que acotar — la base entera son cinco meses.
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

        let objetivo = invokerId;
        if (pedido && pedido !== invokerId) {
            if (!PUEDEN_VER_A_OTROS.includes(invokerRole)) {
                return NextResponse.json({ success: false, error: 'Solo puedes ver la tuya' }, { status: 403 });
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

        const historia = await calcularHistoria(objetivo);
        if (!historia) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ success: true, historia, esPropia: objetivo === invokerId });
    } catch (error: any) {
        console.error('[mi-desempeno/historia]', error);
        return NextResponse.json({ success: false, error: 'Error calculando la historia' }, { status: 500 });
    }
}
