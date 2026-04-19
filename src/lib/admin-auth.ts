import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Sprint I — admin.zendity.com
 *
 * Guard canónico para el panel del CEO. Únicamente SUPER_ADMIN:
 * ni ADMIN ni DIRECTOR ni HQ_OWNER pueden entrar aquí. Si la sesión
 * no cumple devuelve NextResponse listo para retornar; si cumple
 * devuelve la sesión tipada.
 */
export async function requireSuperAdmin(): Promise<
    | { ok: true; session: Session }
    | { ok: false; response: NextResponse }
> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { ok: false, response: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) };
    }
    const role = (session.user as any).role;
    if (role !== 'SUPER_ADMIN') {
        return { ok: false, response: NextResponse.json({ success: false, error: 'Acceso denegado: solo SUPER_ADMIN' }, { status: 403 }) };
    }
    return { ok: true, session };
}
