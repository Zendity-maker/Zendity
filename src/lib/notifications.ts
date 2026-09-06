/**
 * Helper centralizado para crear Notifications.
 * Uso: never throw — si falla, hace log y sigue. El flujo principal no se rompe.
 */
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

type NotifType = "TRIAGE" | "HANDOVER" | "COURSE_COMPLETED" | "EMAR_ALERT" | "FAMILY_VISIT" | "SCHEDULE_PUBLISHED" | "SHIFT_ALERT" | "STAFF_MESSAGE" | "CONCIERGE_SERVICE" | "SHIFT_BLOCKED" | "EVALUATION_COMPLETE" | "EXTERNAL_VISIT_PENDING" | "EXTERNAL_VISIT_PUBLISHED"
    /**
     * Observaciones de personal. Antes viajaban como "EMAR_ALERT" —el tipo de
     * las alertas de medicacion— porque no habia uno propio, y eso las metia en
     * la misma bolsa que lo clinico. Una llamada de atencion a una empleada y
     * un medicamento sin administrar no son la misma clase de cosa.
     */
    | "HR_OBSERVATION";

interface NotifPayload {
    type: NotifType;
    title: string;
    message: string;
    /** Sprint S — ruta opcional para navegación al tocar la notif en la campana. */
    link?: string;
}

/**
 * Crea notificaciones para todos los usuarios de una sede con los roles indicados.
 *
 * DOS COSAS QUE ESTA FUNCION HACIA MAL, medidas en Cupey el 05-sep-2026.
 *
 * 1. NO MIRABA SI LA CUENTA ESTABA ACTIVA. 49 238 de 115 305 notificaciones
 *    —el 42.7%— estaban escritas a cuentas que no pueden entrar al sistema.
 *    8 032 de ellas en los ultimos 30 dias. La cuenta desactivada de la
 *    enfermera jefe acumulaba 4 841 avisos, entre ellos 45 alertas de eMAR y
 *    193 de triage, con el mas reciente del mismo dia en que se midio.
 *
 * 2. SOLO MIRABA EL ROL PRIMARIO. Y el rol de enfermeria en Cupey no es
 *    primario de nadie: la unica cuenta NURSE esta desactivada, y quien hace
 *    enfermeria es Celia Sierra, DIRECTOR con NURSE secundario.
 *
 *    Las dos cosas juntas daban el peor resultado posible:
 *
 *        notifyRoles(hq, ['NURSE'], ...)  ->  1 usuario, 0 activos
 *
 *    Ese es exactamente el aviso que manda "Referir a enfermeria" desde el
 *    panel de triage. Se escribia, devolvia exito, y no llegaba a nadie.
 *
 * EFECTO DEL ARREGLO, simulado contra los datos reales antes de aplicarlo:
 * ninguna cuenta activa deja de recibir nada. Quienes dejan de recibir son
 * las 15 cuentas desactivadas. Quienes empiezan a recibir son las personas
 * que de verdad tienen el rol: Celia los avisos de enfermeria, y las dos
 * supervisoras con CAREGIVER secundario los de cuidado — unos 10 al dia mas
 * cada una, que es lo que recibe una cuidadora.
 */
export async function notifyRoles(
    hqId: string,
    roles: string[],
    payload: NotifPayload,
    excludeUserId?: string
): Promise<number> {
    try {
        // La firma publica acepta string[] — la usan ~40 llamadas con literales.
        const rolesDeLaBusqueda = roles as Role[];
        const users = await prisma.user.findMany({
            where: {
                headquartersId: hqId,
                // Una notificacion a una cuenta que no puede entrar no es una
                // notificacion: es una fila.
                isActive: true,
                isDeleted: false,
                // El rol que alguien ejerce puede ser el secundario. Mismo
                // criterio que requireRole() en src/lib/api-auth.ts, que acepta
                // primario O secundario desde FASE 51.
                OR: [
                    { role: { in: rolesDeLaBusqueda } },
                    { secondaryRoles: { hasSome: rolesDeLaBusqueda } },
                ],
                ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
            },
            select: { id: true },
        });
        if (users.length === 0) return 0;

        const result = await prisma.notification.createMany({
            data: users.map(u => ({
                userId: u.id,
                type: payload.type,
                title: payload.title,
                message: payload.message,
                link: payload.link || null,
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
    payload: NotifPayload
): Promise<boolean> {
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: payload.type,
                title: payload.title,
                message: payload.message,
                link: payload.link || null,
                isRead: false,
            },
        });
        return true;
    } catch (err) {
        console.error(`[notifyUser] Fallo creando notificación (${payload.type}):`, err);
        return false;
    }
}
