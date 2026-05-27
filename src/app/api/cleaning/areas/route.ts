import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['CLEANING', 'MAINTENANCE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const hqId = auth.headquartersId;

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Sesión sin sede asignada' }, { status: 400 });
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
