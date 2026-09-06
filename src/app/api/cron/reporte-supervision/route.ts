/**
 * REPORTE SEMANAL DE SUPERVISIÓN — lunes 8:30 AM AST ("30 12 * * 1" en UTC).
 *
 * A supervisión y dirección. El piso y las cuidadoras; nada clínico, que va en
 * el reporte de enfermería.
 *
 * El porqué de la separación está en src/lib/reporte-supervision.ts: un reporte
 * con cosas ajenas se lee una vez y se archiva.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
import { construirReporteSupervision } from '@/lib/reporte-supervision';
import { enviarReporte, verificarCron, type ResultadoEnvio } from '@/lib/enviar-reporte';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLES: Role[] = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    const denegado = verificarCron(req);
    if (denegado) return denegado;

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true }, select: { id: true, name: true },
        });
        const resultados: ResultadoEnvio[] = [];
        for (const sede of sedes) {
            const reporte = await construirReporteSupervision(sede.id, sede.name);
            resultados.push(await enviarReporte(reporte, ROLES, {
                rutaCron: '/api/cron/reporte-supervision',
                recurso: 'ReporteSupervision',
                entrada: 'Triage & Supervisión',
                canal: 'supervision',
            }));
        }
        return NextResponse.json({ success: true, sedes: resultados });
    } catch (e) {
        console.error('[cron/reporte-supervision]', e);
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
