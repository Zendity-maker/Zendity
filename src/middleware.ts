import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
    'https://app.zendity.com',
    'https://admin.zendity.com',
    'http://localhost:3000',
];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const origin = request.headers.get('origin') ?? '';

    const response = NextResponse.next();

    // ── Headers de seguridad (todas las rutas) ───────────────────────────
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin');
    response.headers.set('X-DNS-Prefetch-Control', 'off');

    // ── CORS explícito (solo rutas /api/) ────────────────────────────────
    if (pathname.startsWith('/api/')) {
        const isAllowed = ALLOWED_ORIGINS.includes(origin);

        if (isAllowed) {
            response.headers.set('Access-Control-Allow-Origin', origin);
            response.headers.set('Access-Control-Allow-Credentials', 'true');
            response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }

        // Respuesta preflight OPTIONS
        if (request.method === 'OPTIONS') {
            if (isAllowed) {
                return new NextResponse(null, {
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': origin,
                        'Access-Control-Allow-Credentials': 'true',
                        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        'Access-Control-Max-Age': '86400',
                    },
                });
            }
            return new NextResponse(null, { status: 403 });
        }
    }

    return response;
}

export const config = {
    matcher: [
        // Aplicar a todas las rutas excepto archivos estáticos y _next internals
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)',
    ],
};
