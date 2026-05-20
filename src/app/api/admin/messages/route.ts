import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/messages
 * Lista de mensajes Zéndity → sedes.
 * ?hqId=xxx  → solo mensajes para esa sede (broadcast + específicos)
 * Sin param  → todos los mensajes (vista SUPER_ADMIN)
 */
export async function GET(req: Request) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');

        const messages = await prisma.zendityMessage.findMany({
            where: hqId
                ? { OR: [{ targetHqId: hqId }, { targetHqId: null }] }
                : {},
            include: {
                author: { select: { id: true, name: true } },
                targetHq: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return NextResponse.json({ success: true, messages });
    } catch (e: any) {
        console.error('[/api/admin/messages GET]', e);
        return NextResponse.json({ success: false, error: 'Error cargando mensajes' }, { status: 500 });
    }
}

/**
 * POST /api/admin/messages
 * Crea un nuevo mensaje. Si targetHqId es null → broadcast a todas las sedes.
 */
export async function POST(req: Request) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const body = await req.json();
        const { targetHqId, title, body: msgBody, category } = body;

        if (!title || !msgBody) {
            return NextResponse.json(
                { success: false, error: 'title y body son obligatorios' },
                { status: 400 },
            );
        }

        const adminId = (guard.session.user as any).id;

        const message = await prisma.zendityMessage.create({
            data: {
                targetHqId: targetHqId || null,
                authorId: adminId,
                title: title.trim(),
                body: msgBody.trim(),
                category: category || 'ANNOUNCEMENT',
            },
            include: {
                author: { select: { id: true, name: true } },
                targetHq: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, message });
    } catch (e: any) {
        console.error('[/api/admin/messages POST]', e);
        return NextResponse.json({ success: false, error: 'Error creando mensaje' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/messages
 * Marcar un mensaje como leído (llamado desde /corporate al abrir el mensaje).
 * Body: { messageId: string }
 * No requiere SUPER_ADMIN — lo llaman sedes normales.
 */
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { messageId } = body;
        if (!messageId) {
            return NextResponse.json({ success: false, error: 'messageId requerido' }, { status: 400 });
        }

        await prisma.zendityMessage.update({
            where: { id: messageId },
            data: { isRead: true, readAt: new Date() },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[/api/admin/messages PATCH]', e);
        return NextResponse.json({ success: false, error: 'Error marcando mensaje' }, { status: 500 });
    }
}
