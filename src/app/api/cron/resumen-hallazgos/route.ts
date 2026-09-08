/**
 * RESUMEN SEMANAL DE ATAJOS — lunes 9:30 AM AST ("30 13 * * 1" en UTC).
 *
 * Va DESPUÉS del cron que genera los hallazgos (7:45) y después de los tres
 * reportes (8:30), para que lo que dirección resuelva el lunes temprano entre
 * en el mismo envío. Lo que se resuelva más tarde sale el lunes siguiente: un
 * atajo no es urgente, y esperar seis días es mejor que mandar goteo.
 *
 * Solo manda lo que alguien marcó "Ya se puede documentar" y todavía no se ha
 * avisado. Al mandarlo pasa a AVISADO, así que no se repite.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verificarCron } from '@/lib/enviar-reporte';
import { enviarResumenHallazgos, type ResultadoResumen } from '@/lib/resumen-hallazgos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
    const denegado = verificarCron(req);
    if (denegado) return denegado;

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true }, select: { id: true, name: true },
        });
        const resultados: ResultadoResumen[] = [];
        for (const sede of sedes) {
            resultados.push(await enviarResumenHallazgos(sede.id, sede.name));
        }
        return NextResponse.json({ success: true, sedes: resultados });
    } catch (e) {
        console.error('[cron/resumen-hallazgos]', e);
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
