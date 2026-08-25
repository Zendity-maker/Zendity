import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

/**
 * GET /api/corporate/senalamientos
 *
 * Señalamientos de familia para dirección.
 *
 * Un señalamiento es lo que una familia —o el propio residente— le plantea
 * formalmente a alguien del personal. El supervisor es el canal de ENTRADA:
 * lo recibe y lo registra. Quien decide qué se hace es dirección.
 *
 * Hasta hoy esto no tenía pantalla. El endpoint de triaje existía con sus
 * acciones y nadie lo llamaba, así que el único sitio donde un señalamiento se
 * veía era el panel operativo del supervisor — donde la única acción posible
 * era despacharlo a una cuidadora. Eso está medido: 8 despachos completados
 * frente a 22 vencidos sin atender. No se le asigna a alguien algo que no está
 * en su mano resolver.
 */
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const incluirCerrados = searchParams.get('cerrados') === '1';

        const items = await prisma.complaint.findMany({
            where: {
                headquartersId: auth.headquartersId,
                ...(incluirCerrados ? {} : { status: { not: 'RESOLVED' } }),
            },
            orderBy: { createdAt: 'asc' },
            take: 200,
            select: {
                id: true,
                description: true,
                status: true,
                photoUrl: true,
                resolutionNote: true,
                createdAt: true,
                planteadoPorResidente: true,
                patient: { select: { id: true, name: true, roomNumber: true } },
                familyMember: { select: { name: true, relationship: true } },
            },
        });

        const ahora = Date.now();
        return NextResponse.json({
            success: true,
            items: items.map(i => ({
                ...i,
                dias: Math.floor((ahora - i.createdAt.getTime()) / 86400000),
                // Quién lo planteó, resuelto para la UI. Antes el familiar se
                // adjudicaba solo tomando el primero de la lista del residente,
                // tuviera o no algo que ver.
                planteadoPor: i.planteadoPorResidente
                    ? 'El propio residente'
                    : i.familyMember
                        ? `${i.familyMember.name}${i.familyMember.relationship ? ` (${i.familyMember.relationship})` : ''}`
                        : 'Sin especificar',
            })),
        });
    } catch (e: any) {
        console.error('[corporate/senalamientos] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
