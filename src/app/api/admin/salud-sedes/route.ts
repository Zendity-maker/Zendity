import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { puestaEnMarcha } from '@/lib/puesta-en-marcha';
import { verificarSede } from '@/lib/verificaciones';

/**
 * Cómo está cada cliente — vista de Zéndity como empresa.
 *
 * El listado de sedes mostraba camas, ocupación y facturación: cuánto vendí.
 * No mostraba si esa sede PUEDE OPERAR ni si su información dice la verdad.
 * Las dos cosas ya se calculaban —puestaEnMarcha y verificarSede— y desde el
 * panel del dueño no se veían.
 *
 * Va en su propio endpoint y no dentro del listado de sedes a propósito:
 * verificarSede hace bastantes consultas por sede, y no debe frenar la carga de
 * la tabla. La tabla pinta primero; esto llega después y la enriquece.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if ((session?.user as any)?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ success: false, error: 'Solo Zéndity' }, { status: 403 });
        }

        const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });

        const filas = await Promise.all(sedes.map(async hq => {
            try {
                const [pm, hallazgos] = await Promise.all([
                    puestaEnMarcha(hq.id),
                    verificarSede(hq.id),
                ]);
                return {
                    id: hq.id,
                    sede: hq.name,
                    completados: pm.completados,
                    total: pm.total,
                    puedeOperar: pm.puedeOperar,
                    // Los bloqueantes que le faltan, por nombre: sin eso el numero
                    // no dice que hacer.
                    faltan: pm.pasos.filter(p => p.bloqueante && !p.hecho).map(p => p.titulo),
                    criticos: hallazgos.filter(h => h.severidad === 'CRITICA').length,
                    altos: hallazgos.filter(h => h.severidad === 'ALTA').length,
                };
            } catch (e) {
                // Una sede que falle no puede tumbar la vista de las demas.
                console.error(`[salud-sedes] ${hq.name}:`, e);
                return { id: hq.id, sede: hq.name, error: true };
            }
        }));

        return NextResponse.json({ success: true, sedes: filas });
    } catch (e: any) {
        console.error('[admin/salud-sedes]', e);
        return NextResponse.json({ success: false, error: 'Error de lectura' }, { status: 500 });
    }
}
