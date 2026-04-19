import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * Helpers server-side para resolver la sede efectiva de un request,
 * respetando el rol de la session y validando contra la DB.
 *
 * El contexto cliente (ActiveHqContext) permite a DIRECTOR/ADMIN
 * alternar de sede vía `?hqId=` en los fetches. Estos helpers
 * garantizan que el servidor respete el rol y nunca exponga datos
 * de una sede ajena a un usuario limitado.
 */

const MULTI_HQ_ROLES = ["DIRECTOR", "ADMIN"] as const;

function readUser(session: Session): { role: string; hqId: string } {
    const user = session.user as any;
    const role = user?.role as string | undefined;
    const hqId = user?.headquartersId as string | undefined;
    if (!role) throw new Error("Sesión sin rol");
    if (!hqId) throw new Error("Usuario sin sede asignada");
    return { role, hqId };
}

function isMultiHq(role: string): boolean {
    return (MULTI_HQ_ROLES as readonly string[]).includes(role);
}

/**
 * Devuelve un hqId concreto (siempre string, nunca 'ALL').
 *
 * Reglas:
 *  - SUPERVISOR/CAREGIVER/NURSE/etc. → SIEMPRE su propia sede, ignora requestedHqId.
 *  - DIRECTOR/ADMIN sin requestedHqId o con 'ALL' → su propia sede.
 *  - DIRECTOR/ADMIN con requestedHqId → validado contra DB (existe y activa).
 *
 * Para endpoints que necesitan un hqId único (ej. el tablet del caregiver,
 * el schedule builder, el supervisor live).
 */
export async function resolveEffectiveHqId(
    session: Session,
    requestedHqId?: string | null
): Promise<string> {
    const { role, hqId: sessionHqId } = readUser(session);

    if (!isMultiHq(role)) {
        return sessionHqId;
    }

    if (!requestedHqId || requestedHqId === "ALL") {
        return sessionHqId;
    }

    const hq = await prisma.headquarters.findFirst({
        where: { id: requestedHqId, isActive: true },
        select: { id: true },
    });
    if (!hq) {
        throw new Error("Sede no encontrada o inactiva");
    }
    return requestedHqId;
}

/**
 * Devuelve un filtro de Prisma `{ headquartersId: X }` o `{}` (todas las sedes).
 *
 * Reglas:
 *  - SUPERVISOR/CAREGIVER/NURSE/etc. → `{ headquartersId: su sede }`, sin importar requestedHqId.
 *  - DIRECTOR/ADMIN con 'ALL' o sin requestedHqId → `{}` (todas las sedes, sin filtro).
 *  - DIRECTOR/ADMIN con requestedHqId → `{ headquartersId: validado }`.
 *
 * Para endpoints que agregan entre sedes (ej. dashboard gerencial, trends).
 */
export async function resolveHqFilter(
    session: Session,
    requestedHqId?: string | null
): Promise<{ headquartersId: string } | {}> {
    const { role, hqId: sessionHqId } = readUser(session);

    if (!isMultiHq(role)) {
        return { headquartersId: sessionHqId };
    }

    if (!requestedHqId || requestedHqId === "ALL") {
        return {};
    }

    const effective = await resolveEffectiveHqId(session, requestedHqId);
    return { headquartersId: effective };
}

/**
 * Helper de conveniencia: devuelve un literal `'ALL' | string` para endpoints
 * que necesitan distinguir ambos casos explícitamente en su lógica (ej.
 * /api/corporate, /api/corporate/trends que exponen effectiveHqId en la respuesta).
 */
export async function resolveEffectiveHqIdOrAll(
    session: Session,
    requestedHqId?: string | null
): Promise<string | "ALL"> {
    const { role } = readUser(session);
    if (!isMultiHq(role)) {
        const { hqId } = readUser(session);
        return hqId;
    }
    if (!requestedHqId || requestedHqId === "ALL") {
        return "ALL";
    }
    // Valida contra DB
    return await resolveEffectiveHqId(session, requestedHqId);
}
