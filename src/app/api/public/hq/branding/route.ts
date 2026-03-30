import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PRODUCTION HQ NAME — siempre resuelve al cliente B2B activo
// Puede ser sobreescrito con la variable de entorno PRODUCTION_HQ_NAME
const PRODUCTION_HQ_NAME = process.env.PRODUCTION_HQ_NAME || 'Vivid Senior Living Cupey';

export async function GET() {
    try {
        // Prioridad 1: Busca por nombre de HQ configurado (más confiable)
        // Prioridad 2: Primer HQ que tenga logoUrl configurado
        // Prioridad 3: Cualquier HQ (fallback)
        let hq = await prisma.headquarters.findFirst({
            where: { name: PRODUCTION_HQ_NAME },
            select: { logoUrl: true, name: true }
        });

        if (!hq) {
            hq = await prisma.headquarters.findFirst({
                where: { logoUrl: { not: null } },
                select: { logoUrl: true, name: true }
            });
        }

        if (!hq) {
            hq = await prisma.headquarters.findFirst({
                select: { logoUrl: true, name: true }
            });
        }

        return NextResponse.json({ success: true, hq });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}
