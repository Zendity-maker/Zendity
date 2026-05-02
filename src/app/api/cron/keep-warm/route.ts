import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 10;

/**
 * GET /api/cron/keep-warm
 * Mantiene la conexión de Neon caliente disparando un SELECT 1 cada 4 minutos.
 * Elimina los cold starts (Neon se duerme tras ~5 min de inactividad) que
 * causaban timeouts y 500s en /api/care/shift/coverage.
 *
 * Autenticado con CRON_SECRET (header Authorization: Bearer <secret>).
 * Vercel Cron lo inyecta automáticamente.
 */
export async function GET(req: Request) {
    const secret = req.headers.get('authorization')?.replace('Bearer ', '');

    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - start;

    return NextResponse.json({
        ok: true,
        ms,
        ts: new Date().toISOString(),
    });
}
