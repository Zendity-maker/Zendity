/**
 * CIERRE DE UNA SALIDA QUE EL VISITANTE NO REGISTRÓ
 * ────────────────────────────────────────────────
 * La hora de salida solo sirve si la gente la marca, y no la van a marcar
 * siempre. Sin esto, la lista de "quién está en el edificio" acumula gente que
 * se fue hace días y deja de servir para lo único que sirve: saber a quién hay
 * que buscar en una evacuación.
 *
 * QUEDA DICHO QUE LA CERRÓ EL PERSONAL. `salidaCerradaPorId` y
 * `salidaCerradaAt` son campos distintos de `departedAt` a propósito: una
 * salida firmada por quien se va y una cerrada por supervisión no son el mismo
 * hecho, y la bitácora —que es un documento— no puede fingir que sí.
 *
 * NO SE INVENTA LA HORA. `departedAt` se deja en null. Poner una hora de salida
 * que nadie observó en un registro que se enseña a un inspector sería
 * falsearlo; lo que se registra es que a esta hora, esta persona del personal,
 * dio la visita por terminada.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const PUEDEN_CERRAR = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    const auth = await requireRole(PUEDEN_CERRAR);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json().catch(() => ({}));
        const ids: string[] = Array.isArray(body.visitIds)
            ? body.visitIds.map(String).filter(Boolean)
            : (body.visitId ? [String(body.visitId)] : []);

        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'No se indicó ninguna visita' }, { status: 400 });
        }

        // La sede va en el WHERE, no se comprueba antes: una visita de otra
        // sede no encuentra fila en vez de dar un 403 que confirma que existe.
        const { count } = await prisma.familyVisit.updateMany({
            where: {
                id: { in: ids },
                headquartersId: auth.headquartersId,
                departedAt: null,
                salidaCerradaAt: null,
            },
            data: {
                salidaCerradaPorId: auth.id,
                salidaCerradaAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, cerradas: count });
    } catch (error) {
        console.error('Cerrar salida error:', error);
        return NextResponse.json({ success: false, error: 'No se pudo cerrar' }, { status: 500 });
    }
}
