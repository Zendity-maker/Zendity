/**
 * REPORTE SEMANAL DE ENFERMERÍA — lunes 8:30 AM AST ("30 12 * * 1" en UTC).
 *
 * A enfermería y dirección. Las supervisoras NO: lo suyo es el piso y va en
 * /api/cron/reporte-supervision. El panel del supervisor se decidió que fuera
 * piso —lo resoluble en una o dos horas— y mandarle el conteo de planes de
 * cuido sin firmar es darle un número sobre el que no puede hacer nada.
 *
 * POR QUÉ EXISTE SI LA PANTALLA YA ESTÁ. /care/enfermeria es una foto de AHORA:
 * dice qué hay pendiente, no qué lleva tres semanas pendiente ni qué se
 * resolvió. Y hay que entrar a mirarla — quien no sabe que hay algo pendiente
 * no entra a comprobarlo. Es la misma razón por la que 16 planes de cuido
 * completos pasaron 106 días sin firmar.
 *
 * El reparto de PHI, los destinatarios y el "si no hay nada no se envía" viven
 * en src/lib/enviar-reporte.ts, compartidos con los otros dos.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
import { construirReporte } from '@/lib/reporte-enfermeria';
import { enviarReporte, verificarCron, type ResultadoEnvio } from '@/lib/enviar-reporte';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLES: Role[] = ['NURSE', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    const denegado = verificarCron(req);
    if (denegado) return denegado;

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true }, select: { id: true, name: true },
        });
        const resultados: ResultadoEnvio[] = [];
        for (const sede of sedes) {
            const reporte = await construirReporte(sede.id, sede.name);
            resultados.push(await enviarReporte(reporte, ROLES, {
                rutaCron: '/api/cron/reporte-enfermeria',
                recurso: 'ReporteEnfermeria',
                entrada: 'Enfermería',
                canal: 'enfermeria',
            }));
        }
        return NextResponse.json({ success: true, sedes: resultados });
    } catch (e) {
        console.error('[cron/reporte-enfermeria]', e);
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
