/**
 * Helper centralizado para crear Notifications.
 * Uso: never throw — si falla, hace log y sigue. El flujo principal no se rompe.
 */
import { prisma } from "@/lib/prisma";

type NotifType = "TRIAGE" | "HANDOVER" | "COURSE_COMPLETED" | "EMAR_ALERT" | "FAMILY_VISIT" | "SCHEDULE_PUBLISHED" | "SHIFT_ALERT" | "STAFF_MESSAGE";

/**
 * Crea notificaciones para todos los usuarios de una sede con los roles indicados.
 */
export async function notifyRoles(
    hqId: string,
    roles: string[],
    payload: { type: NotifType; title: string; message: string }
): Promise<number> {
    try {
        const users = await prisma.user.findMany({
            where: { headquartersId: hqId, role: { in: roles as any } },
            select: { id: true },
        });
        if (users.length === 0) return 0;

        const result = await prisma.notification.createMany({
            data: users.map(u => ({
                userId: u.id,
                type: payload.type,
                title: payload.title,
                message: payload.message,
                isRead: false,
            })),
        });
        return result.count;
    } catch (err) {
        console.error(`[notifyRoles] Fallo creando notificaciones (${payload.type}):`, err);
        return 0;
    }
}

/**
 * Crea notificación individual para un usuario específico.
 */
export async function notifyUser(
    userId: string,
    payload: { type: NotifType; title: string; message: string }
): Promise<boolean> {
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: payload.type,
                title: payload.title,
                message: payload.message,
                isRead: false,
            },
        });
        return true;
    } catch (err) {
        console.error(`[notifyUser] Fallo creando notificación (${payload.type}):`, err);
        return false;
    }
}
