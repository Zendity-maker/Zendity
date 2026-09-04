/**
 * BUSCADOR DE RESIDENTES DEL KIOSCO DE RECEPCIÓN
 * ─────────────────────────────────────────────
 * Lo usa la tablet del lobby: el visitante escribe a quién viene a ver y elige
 * de una lista.
 *
 * ⚠️ HASTA SEP-2026 ESTE ENDPOINT FUE PÚBLICO. Comprobado en producción el
 * 04-sep-2026: `GET /api/reception/search-resident?q=ma` respondía 200 sin
 * sesión ni cookie, con el nombre completo, el número de cuarto, el id y la
 * sede de cinco residentes. Devuelve de cinco en cinco, así que iterando
 * prefijos de dos letras se sacaba el censo entero con las habitaciones.
 *
 * Que una persona identificada resida en un hogar de envejecientes es PHI, y
 * el cuarto es su ubicación física. El middleware solo pone cabeceras y CORS,
 * y CORS no protege de una petición directa.
 *
 * La `hqId` venía por query string y era OPCIONAL: sin ella se buscaba en
 * TODAS las sedes. Ahora sale del dispositivo registrado, igual que en el
 * kiosco de servicios externos — `requireKioskDevice` ya existía y hacía justo
 * esto; a recepción nunca se le conectó, aunque la tablet ya enviaba el
 * `x-device-token` en cada petición.
 *
 * Las dos tablets comparten la llave `zendity_kiosk_token` en localStorage, así
 * que una configurada por /external-kiosk/setup vale para las dos. No hace
 * falta reconfigurar nada.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice } from '@/lib/external-kiosk-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    try {
        const q = new URL(req.url).searchParams.get('q') || '';
        if (q.trim().length < 2) {
            return NextResponse.json({ success: true, patients: [] });
        }

        // La sede sale del dispositivo, NUNCA de la petición.
        const base = { status: 'ACTIVE' as const, headquartersId: device.headquartersId };
        const words = q.trim().split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) {
            return NextResponse.json({ success: true, patients: [] });
        }

        // Primero todas las palabras (más preciso); si no hay nada, cualquiera.
        let raw = await prisma.patient.findMany({
            where: { ...base, AND: words.map(w => ({ name: { contains: w, mode: 'insensitive' as const } })) },
            select: { id: true, name: true, roomNumber: true },
            take: 5,
            orderBy: { name: 'asc' },
        });

        if (raw.length === 0 && words.length > 1) {
            raw = await prisma.patient.findMany({
                where: { ...base, OR: words.map(w => ({ name: { contains: w, mode: 'insensitive' as const } })) },
                select: { id: true, name: true, roomNumber: true },
                take: 5,
                orderBy: { name: 'asc' },
            });
        }

        // `headquartersId` ya no viaja al cliente: la tablet no lo necesita —lo
        // lleva su propio token— y era un dato menos que dar.
        return NextResponse.json({
            success: true,
            patients: raw.map(p => ({ ...p, room: p.roomNumber })),
        });
    } catch (error) {
        console.error('Search resident error:', error);
        return NextResponse.json({ success: true, patients: [] });
    }
}
