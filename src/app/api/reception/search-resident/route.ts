import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice } from '@/lib/external-kiosk-auth';

export async function GET(req: Request) {
    try {
        // El hqId sale del token del dispositivo (x-device-token), NUNCA del query.
        // Antes: hqId venía del query y era opcional → sin token buscaba residentes
        // de TODAS las sedes sin autenticación (fuga de PHI). Ahora la búsqueda
        // queda scoped a la sede de la tablet provisionada.
        const device = await requireKioskDevice(req);
        if (device instanceof NextResponse) return device;

        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q') || '';

        if (q.length < 2) {
            return NextResponse.json({ success: true, patients: [] });
        }

        // Dividir en palabras para mayor cobertura
        const words = q.trim().split(/\s+/).filter(w => w.length > 1);

        // Filtro de sede OBLIGATORIO, derivado del dispositivo.
        const hqFilter = { headquartersId: device.headquartersId };

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
