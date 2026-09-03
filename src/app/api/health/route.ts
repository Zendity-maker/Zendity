import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * SALUD DE LA APLICACIÓN — para monitoreo externo.
 *
 * El 28-ago-2026 el login estuvo caído 28 horas y nadie se enteró hasta que el
 * personal no pudo trabajar. Las verificaciones del health-monitor responden
 * "¿dice la verdad?"; esta responde la pregunta anterior: "¿está viva?".
 *
 * Va sin autenticación a propósito: un monitor externo (Better Stack,
 * UptimeRobot) la consulta cada minuto sin credenciales. Por eso NO devuelve
 * nada que sirva a quien no deba verlo — ni conteos, ni nombres, ni versiones,
 * ni detalles del error. Solo si responde y si la base contesta.
 *
 * 200 = viva.  503 = algo está roto, y el monitor debe avisar.
 *
 * Comprueba la BASE DE DATOS, no solo que Next responda. Una app que sirve
 * páginas pero no puede leer un expediente está caída para quien la usa, y un
 * monitor que solo pide la portada no lo nota.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    const inicio = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return NextResponse.json(
            { ok: true, db: 'ok', ms: Date.now() - inicio },
            { status: 200, headers: { 'Cache-Control': 'no-store' } },
        );
    } catch {
        // Sin detalle del error: el mensaje de Prisma lleva el host de la base.
        return NextResponse.json(
            { ok: false, db: 'error', ms: Date.now() - inicio },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
    }
}
