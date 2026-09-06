/**
 * LO QUE ZENDI ENCONTRÓ, ESPERANDO UN SÍ O UN NO
 * ──────────────────────────────────────────────
 * GET lista lo pendiente. El porqué está en src/lib/hallazgos-zendi.ts.
 *
 * `?historial=1` trae también los cerrados: quien decide necesita ver si algo
 * parecido ya se descartó antes, y por qué. Un descarte sin memoria hace que la
 * misma discusión se repita cada semana.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { PUEDEN_RESOLVER, ETIQUETA_TIPO, type TipoHallazgo } from '@/lib/hallazgos-zendi';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const auth = await requireRole(PUEDEN_RESOLVER);
    if (auth instanceof NextResponse) return auth;

    try {
        const historial = new URL(req.url).searchParams.get('historial') === '1';

        const hallazgos = await prisma.hallazgoZendi.findMany({
            where: {
                headquartersId: auth.headquartersId,
                ...(historial ? {} : { estado: 'PENDIENTE' }),
            },
            select: {
                id: true, tipo: true, resumen: true, evidencia: true, sugerencia: true,
                fuente: true, estado: true, nota: true, createdAt: true, revisadoAt: true,
                revisadoPorId: true,
                patient: { select: { id: true, name: true, roomNumber: true } },
            },
            orderBy: historial ? { createdAt: 'desc' } : { createdAt: 'asc' },
            take: 200,
        });

        const ids = [...new Set(hallazgos.map(h => h.revisadoPorId).filter(Boolean) as string[])];
        const personas = ids.length
            ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
            : [];
        const nombre = new Map(personas.map(p => [p.id, p.name ?? 'Personal']));

        return NextResponse.json({
            success: true,
            hallazgos: hallazgos.map(h => ({
                id: h.id,
                tipo: h.tipo,
                tipoEtiqueta: ETIQUETA_TIPO[h.tipo as TipoHallazgo] ?? h.tipo,
                resumen: h.resumen,
                evidencia: h.evidencia,
                sugerencia: h.sugerencia,
                fuente: h.fuente,
                estado: h.estado,
                nota: h.nota,
                diasEsperando: Math.floor((Date.now() - h.createdAt.getTime()) / 86400000),
                revisadoAt: h.revisadoAt,
                revisadoPor: h.revisadoPorId ? nombre.get(h.revisadoPorId) ?? 'Personal' : null,
                residente: h.patient
                    ? { id: h.patient.id, nombre: h.patient.name.trim(), habitacion: h.patient.roomNumber }
                    : null,
            })),
        });
    } catch (error) {
        console.error('Hallazgos GET:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
