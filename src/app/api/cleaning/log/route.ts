import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { z } from 'zod';

const ALLOWED_ROLES_WRITE = ['CLEANING', 'MAINTENANCE'];
const ALLOWED_ROLES_READ = ['CLEANING', 'MAINTENANCE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const LogSchema = z.object({
    areaId: z.string().uuid(),
    status: z.enum(['COMPLETED', 'SKIPPED']).optional(),
    photoUrl: z.string().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    photoRequested: z.boolean().optional(),
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_WRITE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = LogSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Datos inválidos', issues: parsed.error.issues },
                { status: 400 }
            );
        }
        const { areaId, status, photoUrl, notes, photoRequested } = parsed.data;
        const hqId = (session.user as any).headquartersId;

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Sesión sin sede asignada' }, { status: 400 });
        }

        // Validar que el área pertenece a esta sede (cierra agujero de multi-tenancy)
        const area = await prisma.cleaningArea.findUnique({ where: { id: areaId } });
        if (!area || area.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Área no encontrada' }, { status: 404 });
        }

        // Validar foto requerida en server (la UI lo valida, pero un cliente malicioso podría saltarlo)
        if (area.requiresPhoto && status !== 'SKIPPED' && !photoUrl) {
            return NextResponse.json({ success: false, error: 'Foto requerida para esta área' }, { status: 400 });
        }

        const log = await prisma.cleaningLog.create({
            data: {
                areaId,
                cleanedById: session.user.id,
                headquartersId: hqId,
                status: status || 'COMPLETED',
                photoUrl: photoUrl || null,
                photoRequested: photoRequested || false,
                notes: notes || null,
            },
            include: {
                area: true,
                cleanedBy: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, log });
    } catch (error) {
        console.error('Cleaning Log POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error registrando limpieza' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_READ.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const hqId = (session.user as any).headquartersId;
        const dateParam = searchParams.get('date');

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Sesión sin sede asignada' }, { status: 400 });
        }

        const targetDate = dateParam ? new Date(dateParam) : new Date();
        const dayStart = startOfDay(targetDate);
        const dayEnd = endOfDay(targetDate);

        const logs = await prisma.cleaningLog.findMany({
            where: {
                headquartersId: hqId,
                cleanedAt: { gte: dayStart, lte: dayEnd },
            },
            include: {
                area: true,
                cleanedBy: { select: { id: true, name: true } },
            },
            orderBy: { cleanedAt: 'desc' },
        });

        return NextResponse.json({ success: true, logs });
    } catch (error) {
        console.error('Cleaning Log GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando historial' }, { status: 500 });
    }
}
