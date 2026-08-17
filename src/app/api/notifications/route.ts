import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * GET — Notificaciones del usuario autenticado.
 *
 * Auth hardening (Sprint O): antes el endpoint aceptaba ?userId=X sin
 * validar sesión, lo que permitía leer notifications de cualquier
 * empleado (fuga de datos clínicos). Ahora usa siempre session.user.id
 * y descarta cualquier userId del query param.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
            prisma.notification.count({
                where: { userId, isRead: false },
            }),
        ]);

        return NextResponse.json({ success: true, notifications, unreadCount });
    } catch (error) {
        console.error('Notifications GET Error:', error);
        return NextResponse.json({ success: false, notifications: [], unreadCount: 0 });
    }
}

/**
 * PATCH — Marcar notificaciones como leídas.
 *
 * Body: { ids?: string[], all?: boolean, link?: string, type?: string }
 *
 * `link`/`type` marcan por alcance: todas las no leídas del usuario cuyo link
 * o type coincida. Existe para que "leer el chat" limpie sus notificaciones:
 * antes, abrir mensajes familiares marcaba los MENSAJES como leídos pero las
 * notificaciones 💬 de la campana quedaban vivas para siempre (o hasta que el
 * cron de 48h las ejecutara). El cliente no conoce los ids (la campana solo
 * trae 20), así que marcar por alcance es la única vía práctica.
 *
 * Solo opera sobre notifications del session.user.id. Cualquier userId
 * del body se ignora.
 */
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const body = await req.json().catch(() => ({}));
        const { ids, all, link, type } = body;

        if (all) {
            await prisma.notification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true },
            });
        } else if (typeof link === 'string' && link.length > 0) {
            await prisma.notification.updateMany({
                where: { userId, isRead: false, link },
                data: { isRead: true },
            });
        } else if (typeof type === 'string' && type.length > 0) {
            await prisma.notification.updateMany({
                where: { userId, isRead: false, type },
                data: { isRead: true },
            });
        } else if (Array.isArray(ids) && ids.length > 0) {
            await prisma.notification.updateMany({
                where: { id: { in: ids }, userId },
                data: { isRead: true },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Notifications PATCH Error:', error);
        return NextResponse.json({ success: false });
    }
}
