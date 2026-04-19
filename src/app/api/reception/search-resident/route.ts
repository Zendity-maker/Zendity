import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q') || '';
        const hqId = searchParams.get('hqId') || null;

        if (q.length < 2) {
            return NextResponse.json({ success: true, patients: [] });
        }

        // Dividir en palabras para mayor cobertura
        const words = q.trim().split(/\s+/).filter(w => w.length > 1);

        // Filtro opcional por sede (kiosco multi-sede)
        const hqFilter = hqId ? { headquartersId: hqId } : {};

        const raw = await prisma.patient.findMany({
            where: {
                status: 'ACTIVE',
                ...hqFilter,
                AND: words.map(word => ({
                    name: { contains: word, mode: 'insensitive' }
                }))
            },
            select: {
                id: true,
                name: true,
                roomNumber: true,
                headquartersId: true
            },
            take: 5,
            orderBy: { name: 'asc' }
        });

        // Si no encontró con AND, intentar con OR (más flexible)
        if (raw.length === 0 && words.length > 1) {
            const flex = await prisma.patient.findMany({
                where: {
                    status: 'ACTIVE',
                    ...hqFilter,
                    OR: words.map(word => ({
                        name: { contains: word, mode: 'insensitive' }
                    }))
                },
                select: { id: true, name: true, roomNumber: true, headquartersId: true },
                take: 5,
                orderBy: { name: 'asc' }
            });
            // Mapear roomNumber → room para el frontend
            const patients = flex.map(p => ({ ...p, room: p.roomNumber }));
            return NextResponse.json({ success: true, patients });
        }

        // Mapear roomNumber → room para el frontend
        const patients = raw.map(p => ({ ...p, room: p.roomNumber }));
        return NextResponse.json({ success: true, patients });

    } catch (error) {
        console.error('Search resident error:', error);
        return NextResponse.json({ success: true, patients: [] });
    }
}
