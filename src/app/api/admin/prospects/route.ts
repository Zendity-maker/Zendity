import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/prospects — pipeline completo de ventas SaaS.
 * Orden: ALTA primero, luego updatedAt desc.
 */
export async function GET() {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const prospects = await prisma.saaSProspect.findMany({
            orderBy: [
                { priority: 'asc' }, // ALTA < BAJA alfabéticamente → usamos post-sort
                { updatedAt: 'desc' },
            ],
            include: {
                assignedTo: { select: { id: true, name: true, email: true } },
            },
        });

        // Prisma no ordena enums por valor semántico. Reordenamos ALTA > MEDIA > BAJA.
        const priorityRank: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
        prospects.sort((a, b) => {
            const rA = priorityRank[a.priority] ?? 99;
            const rB = priorityRank[b.priority] ?? 99;
            if (rA !== rB) return rA - rB;
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        });

        return NextResponse.json({ success: true, prospects });
    } catch (e: any) {
        console.error('[/api/admin/prospects]', e);
        return NextResponse.json({ success: false, error: 'Error cargando prospectos' }, { status: 500 });
    }
}

/**
 * POST /api/admin/prospects — crear nuevo prospecto manualmente.
 */
export async function POST(req: Request) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const body = await req.json();
        const { name, municipality, phone, email, contactName, priority, estimatedBeds, planInterest, notes, nextFollowUp } = body;
        if (!name || !municipality) {
            return NextResponse.json({ success: false, error: 'name y municipality son obligatorios' }, { status: 400 });
        }
        const prospect = await prisma.saaSProspect.create({
            data: {
                name,
                municipality,
                phone: phone || null,
                email: email || null,
                contactName: contactName || null,
                priority: priority || 'MEDIA',
                estimatedBeds: estimatedBeds ? Number(estimatedBeds) : null,
                planInterest: planInterest || null,
                notes: notes || null,
                nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
            },
        });
        return NextResponse.json({ success: true, prospect });
    } catch (e: any) {
        console.error('[/api/admin/prospects POST]', e);
        return NextResponse.json({ success: false, error: 'Error creando prospecto' }, { status: 500 });
    }
}
