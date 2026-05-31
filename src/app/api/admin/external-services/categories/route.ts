import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/external-services/categories
 * Lista todas las categorías de la sede (activas e inactivas) con count de providers.
 *
 * POST /api/admin/external-services/categories
 * Body: { name, icon?, displayOrder? }
 */
export async function GET() {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const cats = await prisma.externalServiceCategory.findMany({
            where: { headquartersId: auth.headquartersId },
            orderBy: { displayOrder: 'asc' },
            include: { _count: { select: { providers: true } } },
        });
        return NextResponse.json({ success: true, categories: cats });
    } catch (err: any) {
        logError('admin.external-services.categories.get', err);
        return NextResponse.json({ success: false, error: 'Error cargando categorías' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const body = await req.json().catch(() => ({}));
        const name = (body.name || '').toString().trim();
        const icon = body.icon ? body.icon.toString().trim().slice(0, 8) : null;
        const displayOrder = typeof body.displayOrder === 'number' ? body.displayOrder : 999;

        if (!name) return NextResponse.json({ success: false, error: 'Nombre requerido' }, { status: 400 });

        const created = await prisma.externalServiceCategory.create({
            data: { headquartersId: auth.headquartersId, name, icon, displayOrder, isActive: true },
        });
        return NextResponse.json({ success: true, category: created });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
        }
        logError('admin.external-services.categories.post', err);
        return NextResponse.json({ success: false, error: 'Error creando categoría' }, { status: 500 });
    }
}
