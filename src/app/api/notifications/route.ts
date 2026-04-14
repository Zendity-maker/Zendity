import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — Fetch notificaciones del usuario activo
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 });
    }

    try {
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

// PATCH — Marcar como leidas
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { userId, ids, all } = body;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 });
        }

        if (all) {
            await prisma.notification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true },
            });
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
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
