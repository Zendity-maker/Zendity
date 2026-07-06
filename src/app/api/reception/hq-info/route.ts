import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice } from '@/lib/external-kiosk-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reception/hq-info?hqId=
 * Endpoint público (sin auth) para que el kiosco de recepción
 * obtenga el nombre y logo de la sede.
 */
export async function GET(req: Request) {
    try {
        // La sede se deriva del token del dispositivo (x-device-token), NO del query.
        // Antes tomaba hqId del query sin auth → permitía enumerar metadata de
        // cualquier sede. Sin token válido devuelve el genérico (sin enumeración).
        const device = await requireKioskDevice(req);
        if (device instanceof NextResponse) {
            return NextResponse.json({ name: 'Zéndity', logoUrl: null });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: device.headquartersId },
            select: { name: true, logoUrl: true, phone: true },
        });

        if (!hq) {
            return NextResponse.json({ name: 'Zéndity', logoUrl: null });
        }

        return NextResponse.json({ name: hq.name, logoUrl: hq.logoUrl, phone: hq.phone });
    } catch {
        return NextResponse.json({ name: 'Zéndity', logoUrl: null });
    }
}
