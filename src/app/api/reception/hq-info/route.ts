import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reception/hq-info?hqId=
 * Endpoint público (sin auth) para que el kiosco de recepción
 * obtenga el nombre y logo de la sede.
 */
export async function GET(req: Request) {
    try {
        const hqId = new URL(req.url).searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ name: 'Zéndity', logoUrl: null });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
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
