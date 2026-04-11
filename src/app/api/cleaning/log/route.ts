import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

const ALLOWED_ROLES_WRITE = ['CLEANING', 'MAINTENANCE'];
const ALLOWED_ROLES_READ = ['CLEANING', 'MAINTENANCE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_WRITE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { areaId, status, photoUrl, notes, photoRequested } = await req.json();

        if (!areaId) {
            return NextResponse.json({ success: false, error: 'areaId requerido' }, { status: 400 });
        }

        const log = await prisma.cleaningLog.create({
            data: {
                areaId,
                cleanedById: session.user.id,
                headquartersId: (session.user as any).headquartersId,
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
        const hqId = searchParams.get('hqId') || (session.user as any).headquartersId;
        const dateParam = searchParams.get('date');

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'hqId requerido' }, { status: 400 });
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
