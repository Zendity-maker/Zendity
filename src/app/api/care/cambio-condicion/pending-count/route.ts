/**
 * CAMBIOS QUE ESPERAN UNA REVISIÓN
 * ────────────────────────────────
 * El número que va junto a "Cambios del piso" en el menú.
 *
 * Mismo instrumento que los contadores de PAI y de observaciones de personal, y
 * por la misma razón medida: una notificación se lee una vez y se va. Dos
 * observaciones de personal se quedaron 56 y 45 días paradas HABIENDO disparado
 * su notificación. Un contador insiste hasta que alguien resuelve.
 *
 * `viejos` viaja aparte para que la pantalla pueda decir "3, y uno lleva 5
 * días" en vez de solo un número. Un cambio de condición sin mirar durante días
 * es distinto de uno reportado esta mañana.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { PUEDEN_REVISAR_CAMBIO } from '@/lib/cambios-de-condicion';

export const dynamic = 'force-dynamic';

/** A partir de aquí, un cambio sin revisar deja de ser normal. */
const DIAS_VIEJO = 3;

export async function GET() {
    const auth = await requireRole(PUEDEN_REVISAR_CAMBIO);
    if (auth instanceof NextResponse) return auth;

    try {
        const limite = new Date(Date.now() - DIAS_VIEJO * 86400000);
        const [pendientes, viejos] = await Promise.all([
            prisma.cambioDeCondicion.count({
                where: { headquartersId: auth.headquartersId, revisadoAt: null },
            }),
            prisma.cambioDeCondicion.count({
                where: { headquartersId: auth.headquartersId, revisadoAt: null, reportadoAt: { lt: limite } },
            }),
        ]);

        return NextResponse.json({ success: true, pendientes, viejos, diasViejo: DIAS_VIEJO });
    } catch (error) {
        console.error('Cambios pending-count:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
