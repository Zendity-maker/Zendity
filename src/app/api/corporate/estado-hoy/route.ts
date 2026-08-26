import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { estadoOperativo } from '@/lib/estado-operativo';

/**
 * GET /api/corporate/estado-hoy?hqId=…
 *
 * Lo que el director abre a mirar cada mañana: quien esta en turno, quien se
 * ausento, que corre ahora y como va el turno.
 *
 * Usa las MISMAS definiciones que el panel del supervisor (src/lib/
 * estado-operativo.ts). Son la misma vista a distinta altura: el supervisor ve
 * su piso y su turno, el director la sede entera.
 */
export const dynamic = 'force-dynamic';

const ROLES = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'];

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ROLES);
        if (auth instanceof NextResponse) return auth;

        const session = await getServerSession(authOptions);
        const pedida = new URL(req.url).searchParams.get('hqId');
        const hqId = await resolveEffectiveHqId(session!, pedida);

        return NextResponse.json({ success: true, estado: await estadoOperativo(hqId) });
    } catch (e: any) {
        console.error('[estado-hoy] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
