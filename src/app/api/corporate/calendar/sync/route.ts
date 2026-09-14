import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sincronizarCalendario } from '@/lib/calendar-sync';

export const dynamic = 'force-dynamic';

const ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'HR_MANAGER'];

/**
 * POST /api/corporate/calendar/sync — sincronizar a mano.
 *
 * La lógica se mudó a src/lib/calendar-sync.ts el 14-sep-2026 para que el cron
 * y este botón hagan EXACTAMENTE lo mismo. Antes vivía aquí dentro, y como
 * nadie llamaba a esta ruta el calendario llevaba cero eventos en toda su
 * historia: el trabajo estaba hecho y le faltaba el cable.
 *
 * Se queda para poder forzar un barrido sin esperar a la hora en punto.
 */
export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        // La sede SIEMPRE de la sesión, nunca del body.
        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Sin sede asignada' }, { status: 400 });
        }

        const r = await sincronizarCalendario(hqId);
        return NextResponse.json({ success: true, ...r });
    } catch (error) {
        console.error('[calendar/sync]', error);
        return NextResponse.json({ success: false, error: 'Error sincronizando' }, { status: 500 });
    }
}
