import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getEntitlements } from '@/lib/entitlements';

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
/**
 * Corta el acceso de una sede suspendida por facturación.
 *
 * Vive aquí porque requireSession/requireRole es el punto ÚNICO por donde pasa
 * toda la API autenticada: ponerlo en cada endpoint sería inviable (cientos) y
 * dejaría huecos. `getEntitlements` cachea 30s en memoria, así que no agrega
 * una query por request.
 *
 * Devuelve 402 Payment Required — código correcto y distinguible del 401/403,
 * para que el cliente muestre la pantalla de facturación y no un "no
 * autorizado" genérico que confunda al usuario.
 *
 * SUPER_ADMIN nunca se bloquea: es Zendity, y necesita entrar precisamente
 * para resolver la suspensión.
 */
async function billingBlock(user: SessionUser): Promise<NextResponse | null> {
    if (user.role === 'SUPER_ADMIN') return null;
    try {
        const ent = await getEntitlements(user.headquartersId);
        if (!ent.suspended) return null;
        return NextResponse.json(
            {
                success: false,
                error: 'Servicio suspendido por facturación',
                code: 'BILLING_SUSPENDED',
                message: 'El servicio está temporalmente suspendido por un asunto de facturación. La operación debe continuar con documentación manual. Contacta a Zendity para restablecerlo.',
            },
            { status: 402 }
        );
    } catch {
        // Fail-open deliberado: si el chequeo de licencia falla (DB caída,
        // timeout), NO se bloquea el hogar. Un falso positivo aquí apagaría el
        // eMAR de un hogar que sí paga, a mitad de turno, con residentes reales.
        return null;
    }
}

export async function requireSession(): Promise<SessionUser | NextResponse> {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json(
            { success: false, error: 'No autorizado' },
            { status: 401 }
        );
    }
    const blocked = await billingBlock(user);
    if (blocked) return blocked;
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
    const blocked = await billingBlock(user);
    if (blocked) return blocked;
    return user;
}
