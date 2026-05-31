import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/external-services/providers/[id]
 * Body: { name?, categoryId?, contactPhone?, contactEmail?, notes?, isActive? }
 *
 * DELETE /api/admin/external-services/providers/[id]
 * Bloquea si tiene visitas registradas — sugiere desactivar en su lugar.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const existing = await prisma.externalProvider.findFirst({
            where: { id, headquartersId: auth.headquartersId },
        });
        if (!existing) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });

        const body = await req.json().catch(() => ({}));
        const data: any = {};
        if (typeof body.name === 'string') data.name = body.name.trim();
        if (typeof body.contactPhone === 'string' || body.contactPhone === null) data.contactPhone = body.contactPhone || null;
        if (typeof body.contactEmail === 'string' || body.contactEmail === null) data.contactEmail = body.contactEmail || null;
        if (typeof body.notes === 'string' || body.notes === null) data.notes = body.notes || null;
        if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
        if (typeof body.categoryId === 'string') {
            const cat = await prisma.externalServiceCategory.findFirst({
                where: { id: body.categoryId, headquartersId: auth.headquartersId },
                select: { id: true },
            });
            if (!cat) return NextResponse.json({ success: false, error: 'Categoría destino no válida' }, { status: 400 });
            data.categoryId = body.categoryId;
        }

        const updated = await prisma.externalProvider.update({ where: { id }, data });
        return NextResponse.json({ success: true, provider: updated });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Ya existe un proveedor con ese nombre' }, { status: 409 });
        }
        logError('admin.external-services.providers.patch', err);
        return NextResponse.json({ success: false, error: 'Error actualizando' }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const existing = await prisma.externalProvider.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            include: { _count: { select: { visits: true } } },
        });
        if (!existing) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
        if (existing._count.visits > 0) {
            return NextResponse.json(
                { success: false, error: `Este proveedor tiene ${existing._count.visits} visitas en historial. No se puede eliminar (rompería el audit log). Desactívalo (isActive: false) en su lugar.` },
                { status: 409 },
            );
        }

        await prisma.externalProvider.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        logError('admin.external-services.providers.delete', err);
        return NextResponse.json({ success: false, error: 'Error eliminando' }, { status: 500 });
    }
}
