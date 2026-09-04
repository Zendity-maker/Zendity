/**
 * IDENTIDAD DE LA SEDE PARA EL KIOSCO DE RECEPCIÓN
 * ───────────────────────────────────────────────
 * Nombre, logo y teléfono, para que la tablet del lobby se vea como el hogar y
 * no como Zéndity.
 *
 * Era público y la sede llegaba por query string, así que cualquiera podía
 * enumerar sedes por id. Lo que devuelve no es especialmente sensible —el
 * nombre y el teléfono de un hogar son públicos—, pero no hay razón para que
 * este endpoint conteste a alguien que no es una tablet registrada, y dejarlo
 * abierto mantenía la idea de que el kiosco no necesita identificarse.
 *
 * La sede sale del dispositivo. El `?hqId=` de la URL del kiosco se ignora: si
 * mandara a otra sede que la de la tablet, la tablet manda.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice } from '@/lib/external-kiosk-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    try {
        const hq = await prisma.headquarters.findUnique({
            where: { id: device.headquartersId },
            select: { name: true, logoUrl: true, phone: true },
        });
        if (!hq) {
            return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });
        }
        return NextResponse.json({ success: true, name: hq.name, logoUrl: hq.logoUrl, phone: hq.phone });
    } catch (error) {
        console.error('Reception hq-info error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
