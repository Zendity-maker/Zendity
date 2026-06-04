import { NextResponse } from 'next/server';

/**
 * requireCronSecret — guard único para los endpoints /api/cron/*.
 *
 * Valida el header `Authorization: Bearer <CRON_SECRET>` que Vercel Cron
 * inyecta automáticamente en cada invocación agendada.
 *
 * Fail-CLOSED: si `CRON_SECRET` no está configurado en el entorno, RECHAZA.
 * Antes, el patrón inline dominante era condicional —
 *   `if (process.env.CRON_SECRET && authHeader !== 'Bearer ' + ...)`—
 * que se SALTABA el check cuando CRON_SECRET estaba ausente, dejando el cron
 * abierto a invocación anónima de forma silenciosa. Este helper invierte esa
 * rama (ausente → 401) sin cambiar la comparación para tráfico real: con
 * CRON_SECRET presente el comportamiento es idéntico al guard previo.
 *
 * Uso:
 *   export async function GET(req: Request) {
 *     const denied = requireCronSecret(req);
 *     if (denied) return denied;
 *     // ... lógica del cron
 *   }
 */
export function requireCronSecret(req: Request): NextResponse | null {
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}
