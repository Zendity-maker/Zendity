import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/external-services/categories/[id]
 * Body: { name?, icon?, displayOrder?, isActive? }
 *
 * DELETE /api/admin/external-services/categories/[id]
 * Bloquea si hay providers activos vinculados (sugiere desactivar primero).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const existing = await prisma.externalServiceCategory.findFirst({
            where: { id: params.id, headquartersId: auth.headquartersId },
        });
        if (!existing) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 });

        const body = await req.json().catch(() => ({}));
        const data: any = {};
        if (typeof body.name === 'string') data.name = body.name.trim();
        if (typeof body.icon === 'string' || body.icon === null) data.icon = body.icon ? body.icon.slice(0, 8) : null;
        if (typeof body.displayOrder === 'number') data.displayOrder = body.displayOrder;
        if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

        const updated = await prisma.externalServiceCategory.update({ where: { id: params.id }, data });
        return NextResponse.json({ success: true, category: updated });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
        }
        logError('admin.external-services.categories.patch', err);
        return NextResponse.json({ success: false, error: 'Error actualizando' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const existing = await prisma.externalServiceCategory.findFirst({
            where: { id: params.id, headquartersId: auth.headquartersId },
            include: { _count: { select: { providers: true } } },
        });
        if (!existing) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 });
        if (existing._count.providers > 0) {
            return NextResponse.json(
                { success: false, error: `Esta categoría tiene ${existing._count.providers} proveedores. Bórralos o muévelos antes de eliminar la categoría. Alternativa: desactívala (isActive: false).` },
                { status: 409 },
            );
        }

        await prisma.externalServiceCategory.delete({ where: { id: params.id } });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        logError('admin.external-services.categories.delete', err);
        return NextResponse.json({ success: false, error: 'Error eliminando' }, { status: 500 });
    }
}
