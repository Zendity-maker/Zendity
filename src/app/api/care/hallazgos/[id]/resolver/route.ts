/**
 * CONFIRMAR O DESCARTAR UN HALLAZGO
 * ─────────────────────────────────
 * Es el paso que convierte una sospecha de la IA en algo o en nada. Sin él,
 * esto sería una lista que crece — y una lista que crece y nadie cierra es
 * exactamente lo que enseña a ignorar la pantalla.
 *
 * DESCARTAR EXIGE UNA RAZÓN. No por burocracia: sin ella, dentro de dos meses
 * nadie sabrá si se descartó porque era falso o porque ese día no había tiempo,
 * y la misma discusión se repite. Confirmar no la exige — confirmar ya viene
 * con la evidencia al lado.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { PUEDEN_RESOLVER } from '@/lib/hallazgos-zendi';

export const dynamic = 'force-dynamic';

const ESTADOS = ['CONFIRMADO', 'DESCARTADO'];
const MINIMO_RAZON = 10;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN_RESOLVER);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;
        const body = await req.json().catch(() => ({}));
        const estado = String(body.estado ?? '').trim();
        const nota = String(body.nota ?? '').trim();

        if (!ESTADOS.includes(estado)) {
            return NextResponse.json({ success: false, error: 'Diga si es real o no' }, { status: 400 });
        }
        if (estado === 'DESCARTADO' && nota.length < MINIMO_RAZON) {
            return NextResponse.json({
                success: false,
                error: `Para descartarlo, diga por qué — al menos ${MINIMO_RAZON} caracteres.`,
            }, { status: 400 });
        }

        // Ownership por id: el rol no basta.
        const h = await prisma.hallazgoZendi.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            select: { id: true, estado: true },
        });
        if (!h) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
        if (h.estado !== 'PENDIENTE') {
            return NextResponse.json({ success: false, error: 'Ya fue revisado.' }, { status: 409 });
        }

        await prisma.hallazgoZendi.update({
            where: { id },
            data: {
                estado,
                revisadoAt: new Date(),
                revisadoPorId: auth.id,
                nota: nota.slice(0, 2000) || null,
            },
        });

        return NextResponse.json({
            success: true,
            mensaje: estado === 'CONFIRMADO' ? 'Confirmado.' : 'Descartado.',
        });
    } catch (error) {
        console.error('Resolver hallazgo:', error);
        return NextResponse.json({ success: false, error: 'No se pudo guardar' }, { status: 500 });
    }
}
