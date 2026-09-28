/**
 * LA CARA DE UN RESIDENTE, POR SU PROPIA RUTA Y CACHEABLE.
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * `Patient.photoUrl` no es una URL: es un `data:image/jpeg;base64,…` guardado
 * dentro de la fila. Medido el 28-sep-2026 sobre los 31 residentes de Cupey:
 * **43 kB de mediana cada uno, 1.339 kB en total**.
 *
 * Yendo dentro del JSON de `/api/care`, eso se reenviaba ENTERO en cada poll de
 * la pantalla del piso, tres veces por carga, y el navegador no podía cachear
 * nada: un JSON no se cachea por trozos. Medido el mismo día: quitando las
 * fotos, esa respuesta baja de 1.355 kB a **16**. Las caras eran el 99 % de lo
 * que quedaba después de sacar los documentos escaneados.
 *
 * Aquí la foto es un recurso con su propia URL, así que el navegador hace lo
 * que sabe hacer: la pide una vez y la guarda.
 *
 * ═══ POR QUÉ `private` Y NUNCA `public` ═══
 *
 * Es la cara de un residente de un hogar de cuidado: es PHI. `public` la
 * dejaría cacheada en cualquier proxy o CDN entre la tableta y Vercel, fuera
 * del control del hogar. `private` la guarda solo el navegador que la pidió, y
 * solo después de que esta ruta haya comprobado sesión, rol y sede.
 *
 * ═══ POR QUÉ EL `?v=` DE LA URL ═══
 *
 * Con `max-age` largo y la URL siempre igual, una cuidadora que acaba de tomar
 * la foto seguiría viendo la vieja hasta que caducara. `/api/care` pone en la
 * URL los primeros 8 caracteres del `md5` del contenido —calculado en
 * Postgres, así que por el cable viajan 8 caracteres y no 43 kB—: si la foto
 * cambia, la URL cambia, y el navegador la pide de nuevo sin preguntar a nadie.
 *
 * El `ETag` cubre el otro lado: cuando la URL sí es la misma y la caché ya
 * caducó, la respuesta es un 304 sin cuerpo.
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { QUIEN_VE_EL_PISO } from '@/lib/roles-clinicos';

export const dynamic = 'force-dynamic';

/** Un día. Es seguro porque la URL lleva la versión del contenido. */
const CACHE = 'private, max-age=86400, must-revalidate';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ patientId: string }> },
) {
    const auth = await requireRole(QUIEN_VE_EL_PISO);
    if (auth instanceof NextResponse) return auth;

    const { patientId } = await params;

    /**
     * LA SEDE SALE DE LA SESIÓN, NO DE LA URL.
     *
     * Sin este `headquartersId` bastaría con tener el id de un residente de
     * OTRO cliente para traerse su cara. Es el mismo agujero que tuvo
     * /api/corporate/headquarters.
     */
    const residente = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: auth.headquartersId },
        select: { photoUrl: true },
    });

    if (!residente?.photoUrl) {
        // 404 a secas: no se distingue «no existe» de «no es de tu sede», que
        // es lo correcto — decirlo sería confirmar que ese residente existe.
        return new NextResponse(null, { status: 404 });
    }

    const guardado = residente.photoUrl;

    /**
     * Hoy las 31 son `data:` URIs, pero la columna admite una URL de verdad y
     * algún día tendrá las de R2. Si es http(s) se redirige: es exactamente lo
     * que hacía el navegador antes, cuando el `<img src>` llevaba ese valor.
     */
    if (/^https?:\/\//i.test(guardado)) {
        return NextResponse.redirect(guardado, 307);
    }

    const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(guardado);
    if (!m) {
        console.warn(`[care/foto] ${patientId}: photoUrl no es data: ni http`);
        return new NextResponse(null, { status: 404 });
    }

    const [, tipo, base64] = m;
    const etag = `"${createHash('sha1').update(base64).digest('base64url').slice(0, 22)}"`;

    if (req.headers.get('if-none-match') === etag) {
        return new NextResponse(null, { status: 304, headers: { ETag: etag, 'Cache-Control': CACHE } });
    }

    let bytes: Buffer;
    try {
        bytes = Buffer.from(base64, 'base64');
    } catch {
        return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
            'Content-Type': tipo,
            'Content-Length': String(bytes.length),
            ETag: etag,
            'Cache-Control': CACHE,
            // Que no quede en registros de terceros si alguna vez se enlaza.
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
