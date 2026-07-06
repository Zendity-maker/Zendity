import { prisma } from '@/lib/prisma';

// Sprint email-logo (jul-2026).
// Sirve el logo de una sede como imagen pública para poder embeberlo en
// correos. Los clientes de correo (Gmail/Outlook/Apple Mail) BLOQUEAN las
// imágenes `data:` base64 embebidas, así que el logo guardado en
// Headquarters.logoUrl como data-URI se rompe (círculo gris). Este endpoint
// lo decodifica y lo devuelve como image/png real desde una URL https pública.
//
// Público a propósito: un email no lleva sesión, tiene que poder cargar la
// imagen sin auth. Un logo NO es PHI ni dato sensible — es branding.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const hq = await prisma.headquarters.findUnique({
            where: { id },
            select: { logoUrl: true },
        });
        const logo = hq?.logoUrl;
        if (!logo) {
            return new Response('Sin logo', { status: 404 });
        }

        // Si ya es una URL http(s) pública, redirigir a ella.
        if (logo.startsWith('http')) {
            return Response.redirect(logo, 302);
        }

        // data:image/png;base64,XXXX  →  decodificar a binario.
        const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(logo);
        if (!match) {
            return new Response('Formato de logo no soportado', { status: 415 });
        }
        const mime = match[1] || 'image/png';
        const buffer = Buffer.from(match[2], 'base64');

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': mime,
                'Content-Length': String(buffer.length),
                // Cache agresivo: el logo casi nunca cambia y los clientes de
                // correo re-piden la imagen al abrir. 1 día + revalidación.
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            },
        });
    } catch (error: any) {
        console.error('Error sirviendo logo de sede:', error?.message ?? error);
        return new Response('Error', { status: 500 });
    }
}
