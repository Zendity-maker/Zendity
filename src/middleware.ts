import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname === '/family/register') {
        const response = NextResponse.next();

        // Limpiar cookies de sesion viejas en la respuesta
        // Esto le dice al browser que elimine las cookies antes del proximo request
        const cookieOptions = 'Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax';
        const secureCookieOptions = 'Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax';

        response.headers.append('Set-Cookie', `next-auth.session-token=; ${cookieOptions}`);
        response.headers.append('Set-Cookie', `__Secure-next-auth.session-token=; ${secureCookieOptions}`);
        response.headers.append('Set-Cookie', `next-auth.callback-url=; ${cookieOptions}`);
        response.headers.append('Set-Cookie', `__Secure-next-auth.callback-url=; ${secureCookieOptions}`);
        response.headers.append('Set-Cookie', `next-auth.csrf-token=; ${cookieOptions}`);
        response.headers.append('Set-Cookie', `__Secure-next-auth.csrf-token=; ${secureCookieOptions}`);

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/family/register']
};
