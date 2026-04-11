import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['CLEANING', 'MAINTENANCE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId') || (session.user as any).headquartersId;

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'hqId requerido' }, { status: 400 });
        }

        const areas = await prisma.cleaningArea.findMany({
            where: { headquartersId: hqId, isActive: true },
            orderBy: { order: 'asc' },
        });

        const firstFloor = areas.filter(a => a.floor === 'FIRST_FLOOR');
        const secondFloor = areas.filter(a => a.floor === 'SECOND_FLOOR');

        return NextResponse.json({ success: true, firstFloor, secondFloor });
    } catch (error) {
        console.error('Cleaning Areas GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
