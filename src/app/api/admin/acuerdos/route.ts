import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BAA_VERSION } from '@/lib/baa-texto';

/**
 * Estado del BAA de TODAS las sedes — vista de Zéndity como empresa.
 *
 * La pantalla /admin/baa se titulaba "gestión centralizada" y no leía ni un
 * dato: 503 líneas de maqueta con un badge "2 pendientes" escrito a mano, que
 * decía lo mismo hubiera lo que hubiera. En una pantalla de cumplimiento eso no
 * es un placeholder, es una respuesta inventada a una pregunta seria.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if ((session?.user as any)?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ success: false, error: 'Solo Zéndity' }, { status: 403 });
        }

        const sedes = await prisma.headquarters.findMany({
            select: {
                id: true, name: true, createdAt: true, isActive: true,
                acuerdos: {
                    where: { tipo: 'BAA' },
                    select: {
                        version: true, aceptadoEn: true, firmanteNombre: true,
                        firmanteCargo: true, aceptadoIp: true,
                    },
                    orderBy: { aceptadoEn: 'desc' },
                },
                _count: { select: { patients: true } },
            },
            orderBy: { name: 'asc' },
        });

        const filas = sedes.map(h => {
            const firmado = h.acuerdos.find(a => a.aceptadoEn);
            return {
                id: h.id,
                sede: h.name,
                activa: h.isActive,
                residentes: h._count.patients,
                creada: h.createdAt,
                firmado: !!firmado,
                version: firmado?.version ?? null,
                // Una sede que firmó una version vieja necesita firmar la nueva.
                alDia: firmado?.version === BAA_VERSION,
                firmante: firmado?.firmanteNombre ?? null,
                cargo: firmado?.firmanteCargo ?? null,
                fecha: firmado?.aceptadoEn ?? null,
                ip: firmado?.aceptadoIp ?? null,
            };
        });

        return NextResponse.json({
            success: true,
            versionVigente: BAA_VERSION,
            sedes: filas,
            pendientes: filas.filter(f => !f.alDia).length,
        });
    } catch (e: any) {
        console.error('[admin/acuerdos]', e);
        return NextResponse.json({ success: false, error: 'Error de lectura' }, { status: 500 });
    }
}
