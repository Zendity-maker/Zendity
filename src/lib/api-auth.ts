import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Tipo concreto del usuario de sesión que usan los route handlers.
 * `session.user` ya está tipado en src/types/next-auth.d.ts; este
 * helper sólo lo expone con un alias estable y campos no opcionales.
 */
export interface SessionUser {
    id: string;
    role: string;
    headquartersId: string;
    name?: string | null;
    email?: string | null;
    secondaryRoles: string[];
    photoUrl?: string | null;
}

/**
 * Lee la sesión actual. Devuelve null si no hay sesión válida.
 * Para guardas con respuesta 401/403 ver requireSession / requireRole.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    return {
        id: session.user.id,
        role: session.user.role,
        headquartersId: session.user.headquartersId,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        secondaryRoles: session.user.secondaryRoles ?? [],
        photoUrl: session.user.photoUrl ?? null,
    };
}

/**
 * Garantiza una sesión válida. Devuelve SessionUser o un NextResponse 401
 * listo para retornar.
 *
 * Patrón de uso en route handlers:
 *
 *   export async function POST(req: Request) {
 *       const auth = await requireSession();
 *       if (auth instanceof NextResponse) return auth;
 *       // a partir de aquí, auth: SessionUser
 *   }
 */
export async function requireSession(): Promise<SessionUser | NextResponse> {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json(
            { success: false, error: 'No autorizado' },
            { status: 401 }
        );
    }
    return user;
}

/**
 * Garantiza sesión + uno de los roles permitidos (primary O secondary).
 * Devuelve SessionUser o NextResponse 401/403.
 *
 * Incluye secondaryRoles por diseño: usuarios con doble rol (ej. SUPERVISOR
 * + CAREGIVER) deben poder ejecutar acciones de cualquiera de sus roles.
 * Si un endpoint necesita ser estricto sobre el rol primario, debe hacer
 * el chequeo extra explícitamente tras requireRole.
 *
 * Patrón de uso:
 *
 *   const auth = await requireRole(['CAREGIVER', 'NURSE']);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth: SessionUser
 */
export async function requireRole(
    allowedRoles: string[]
): Promise<SessionUser | NextResponse> {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json(
            { success: false, error: 'No autorizado' },
            { status: 401 }
        );
    }
    const hasPrimary = allowedRoles.includes(user.role);
    const hasSecondary = user.secondaryRoles.some(r => allowedRoles.includes(r));
    if (!hasPrimary && !hasSecondary) {
        return NextResponse.json(
            { success: false, error: 'Rol no autorizado' },
            { status: 403 }
        );
    }
    return user;
}
