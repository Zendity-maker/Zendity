import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/external-services/providers?categoryId=XXX (opcional)
 * POST /api/admin/external-services/providers
 *   Body: { categoryId, name, contactPhone?, contactEmail?, notes? }
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const categoryId = searchParams.get('categoryId') || undefined;

        const providers = await prisma.externalProvider.findMany({
            where: { headquartersId: auth.headquartersId, ...(categoryId ? { categoryId } : {}) },
            orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
            include: { category: { select: { id: true, name: true, icon: true } } },
        });
        return NextResponse.json({ success: true, providers });
    } catch (err: any) {
        logError('admin.external-services.providers.get', err);
        return NextResponse.json({ success: false, error: 'Error cargando proveedores' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const body = await req.json().catch(() => ({}));
        const categoryId = (body.categoryId || '').toString().trim();
        const name = (body.name || '').toString().trim();
        if (!categoryId || !name) {
            return NextResponse.json({ success: false, error: 'categoryId y name requeridos' }, { status: 400 });
        }
        // Tenant guard: la categoría debe pertenecer a la misma sede
        const cat = await prisma.externalServiceCategory.findFirst({
            where: { id: categoryId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!cat) return NextResponse.json({ success: false, error: 'Categoría no válida' }, { status: 404 });

        const created = await prisma.externalProvider.create({
            data: {
                headquartersId: auth.headquartersId,
                categoryId,
                name,
                contactPhone: body.contactPhone?.toString().trim() || null,
                contactEmail: body.contactEmail?.toString().trim() || null,
                notes: body.notes?.toString().trim() || null,
                isActive: true,
            },
        });
        return NextResponse.json({ success: true, provider: created });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Ya existe un proveedor con ese nombre en esta sede' }, { status: 409 });
        }
        logError('admin.external-services.providers.post', err);
        return NextResponse.json({ success: false, error: 'Error creando proveedor' }, { status: 500 });
    }
}
