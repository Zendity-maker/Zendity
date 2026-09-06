/**
 * REPORTE SEMANAL DE DIRECCIÓN — lunes 9:00 AM AST ("0 13 * * 1" en UTC).
 *
 * MEDIA HORA DESPUÉS QUE LOS OTROS DOS, a propósito: lee los dos y dice qué
 * haría con ellos. Llega cuando los otros ya están en la bandeja de quien los
 * tiene que ejecutar.
 *
 * Lo que lo hace distinto es que no repite listas: da un ORDEN. Nueve frentes
 * abiertos a la vez no se atienden por igual, y decidir cuál va primero es
 * trabajo de dirección.
 *
 * Las recomendaciones salen de reglas sobre números medidos, no de una IA. El
 * porqué está escrito en src/lib/reporte-direccion.ts.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
import { construirReporteDireccion } from '@/lib/reporte-direccion';
import { enviarReporte, verificarCron, type ResultadoEnvio } from '@/lib/enviar-reporte';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ROLES: Role[] = ['DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    const denegado = verificarCron(req);
    if (denegado) return denegado;

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true }, select: { id: true, name: true },
        });
        const resultados: ResultadoEnvio[] = [];
        for (const sede of sedes) {
            const reporte = await construirReporteDireccion(sede.id, sede.name);
            resultados.push(await enviarReporte(reporte, ROLES, {
                rutaCron: '/api/cron/reporte-direccion',
                recurso: 'ReporteDireccion',
                entrada: 'Insights',
            }));
        }
        return NextResponse.json({ success: true, sedes: resultados });
    } catch (e) {
        console.error('[cron/reporte-direccion]', e);
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
