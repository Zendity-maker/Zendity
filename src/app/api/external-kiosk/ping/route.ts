import { NextResponse } from 'next/server';
import { requireKioskDevice, touchKioskDevice } from '@/lib/external-kiosk-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external-kiosk/ping
 *
 * Heartbeat. La tablet llama cada ~5min para que el director vea en el admin
 * "última actividad: hace 3 min" y sepa que el kiosko está vivo. Si pasa más
 * de 30 min sin ping, el admin asume tablet apagada/desconectada.
 *
 * Auth: header `x-device-token`.
 *
 * Devuelve: { ok, serverTime } — el cliente puede sincronizar reloj si quiere.
 */
export async function GET(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    await touchKioskDevice(device.id);

    return NextResponse.json({
        ok: true,
        serverTime: new Date().toISOString(),
    });
}
