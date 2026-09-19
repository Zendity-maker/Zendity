import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { construirPantallaDireccion } from '@/lib/pantalla-direccion';
import { puedeVerInversion } from '@/lib/acceso-inversion';

export const dynamic = 'force-dynamic';

const ROLES = ['DIRECTOR', 'ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'];

/**
 * GET /api/corporate/hoy — las cuatro franjas de la pantalla de dirección.
 *
 * UN SOLO ENDPOINT PARA TODA LA PANTALLA, a propósito.
 *
 * El panel anterior se surtía de siete, y de ahí salía el desorden que Andrés
 * describió: el estado del turno se pintaba dos veces desde dos endpoints con
 * dos aritméticas —el chip decía "Baños 31" y la barra de encima "30/30"— y el
 * triage salía tres veces con tres números distintos (2, 1 y 18). Dos cifras
 * del mismo hecho en la misma pantalla es peor que no enseñar ninguna: quien la
 * mira deja de creerse las dos.
 *
 * La sede sale del resolver y NO cruda del query: /api/corporate/live y
 * /director-briefing la tomaban tal cual venía, sin comprobar nada.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, searchParams.get('headquartersId'));
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        const sede = await prisma.headquarters.findUnique({
            where: { id: hqId }, select: { name: true },
        });
        if (!sede) {
            return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });
        }

        const pantalla = await construirPantallaDireccion(hqId, sede.name);

        // El botón del área de inversión se decide aquí, donde la sesión está
        // en mano: `construirPantallaDireccion` solo recibe id y nombre de sede
        // y no sabe quién mira. Viaja en el mismo payload que el resto para que
        // el enlace aparezca en el mismo instante que la pantalla — un botón
        // que se pinta y se quita es peor que no tenerlo.
        //
        // Es solo la puerta visible: quien la fuerce por URL choca igual con la
        // guarda de /api/corporate/investors/kpis. Ver acceso-inversion.ts.
        const puedeInversion = await puedeVerInversion({
            id: (session.user as any).id,
            role: (session.user as any).role,
        });

        return NextResponse.json({
            success: true,
            pantalla: { ...pantalla, puedeVerInversion: puedeInversion },
        });
    } catch (error: any) {
        console.error('[corporate/hoy]', error);
        return NextResponse.json({ success: false, error: 'Error cargando la pantalla' }, { status: 500 });
    }
}
