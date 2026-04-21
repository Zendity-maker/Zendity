import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyRoles, notifyUser } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CAREGIVER', 'KITCHEN', 'MAINTENANCE'];
const BROADCAST_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

/**
 * GET — Inbox del usuario autenticado.
 * Devuelve: directos al user + broadcasts de su sede.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const userId = (session.user as any).id;
        const hqId = (session.user as any).headquartersId;
        const role = (session.user as any).role;
        if (role === 'FAMILY') return NextResponse.json({ success: false, error: 'Prohibido' }, { status: 403 });

        const messages = await prisma.staffMessage.findMany({
            where: {
                headquartersId: hqId,
                OR: [
                    { recipientId: userId },
                    { senderId: userId, type: 'DIRECT' },
                    { type: 'BROADCAST' },
                ],
            },
            include: {
                sender: { select: { id: true, name: true, role: true, image: true, photoUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // unreadCount: directos no leídos al user + broadcasts no leídos
        // Como `isRead` es flag único por row, los broadcasts tienen un solo isRead compartido.
        // Para conteo por-usuario preciso se necesitaría tabla pivote; aquí usamos heurística:
        // contamos directos no leídos (recipientId=user && !isRead) + broadcasts sin leer del día.
        const unreadDirect = await prisma.staffMessage.count({
            where: { headquartersId: hqId, recipientId: userId, isRead: false },
        });
        const unreadBroadcast = await prisma.staffMessage.count({
            where: { headquartersId: hqId, type: 'BROADCAST', isRead: false, senderId: { not: userId } },
        });

        return NextResponse.json({
            success: true,
            messages,
            unreadCount: unreadDirect + unreadBroadcast,
        });
    } catch (err: any) {
        console.error('[StaffMessages GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST — Enviar mensaje (DIRECT o BROADCAST)
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const userId = (session.user as any).id;
        const senderName = (session.user as any).name || 'Staff';
        const hqId = (session.user as any).headquartersId;
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'No autorizado para enviar mensajes' }, { status: 403 });
        }

        const { content, recipientId } = await req.json();
        if (!content || typeof content !== 'string' || !content.trim()) {
            return NextResponse.json({ success: false, error: 'Contenido requerido' }, { status: 400 });
        }

        const type = recipientId ? 'DIRECT' : 'BROADCAST';

        // Solo DIRECTOR/ADMIN/SUPERVISOR pueden hacer broadcast
        if (type === 'BROADCAST' && !BROADCAST_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo supervisores pueden enviar anuncios' }, { status: 403 });
        }

        // Validar que el recipient pertenece a la misma sede
        // (Los FAMILY usan modelo FamilyMember aparte — no aparecen en User)
        if (type === 'DIRECT') {
            const recipient = await prisma.user.findUnique({
                where: { id: recipientId },
                select: { headquartersId: true },
            });
            if (!recipient || recipient.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: 'Destinatario inválido' }, { status: 400 });
            }
        }

        const message = await prisma.staffMessage.create({
            data: {
                headquartersId: hqId,
                senderId: userId,
                content: content.trim(),
                type,
                recipientId: type === 'DIRECT' ? recipientId : null,
            },
            include: {
                sender: { select: { id: true, name: true, role: true, image: true, photoUrl: true } },
            },
        });

        // Notificación
        try {
            const preview = content.trim().substring(0, 80);
            if (type === 'DIRECT') {
                await notifyUser(recipientId, {
                    type: 'STAFF_MESSAGE',
                    title: `Mensaje de ${senderName}`,
                    message: preview,
                });
            } else {
                await notifyRoles(hqId, ALLOWED_ROLES, {
                    type: 'STAFF_MESSAGE',
                    title: `Anuncio de ${senderName}`,
                    message: preview,
                });
            }
        } catch (e) { console.error('[notify STAFF_MESSAGE]', e); }

        return NextResponse.json({ success: true, message });
    } catch (err: any) {
        console.error('[StaffMessages POST]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * PATCH — Marcar mensajes como leídos
 * body: { messageIds: string[] }
 */
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const userId = (session.user as any).id;
        const hqId = (session.user as any).headquartersId;

        const { messageIds } = await req.json();
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return NextResponse.json({ success: false, error: 'messageIds requerido' }, { status: 400 });
        }

        // Solo puede marcar los propios (recipientId=user o broadcasts de su sede)
        const result = await prisma.staffMessage.updateMany({
            where: {
                id: { in: messageIds },
                headquartersId: hqId,
                OR: [
                    { recipientId: userId },
                    { type: 'BROADCAST' },
                ],
            },
            data: { isRead: true },
        });

        return NextResponse.json({ success: true, updated: result.count });
    } catch (err: any) {
        console.error('[StaffMessages PATCH]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
