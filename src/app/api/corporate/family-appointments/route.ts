import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

// GET — todas las citas de la sede, filtradas por status
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'PENDING'; // PENDING | APPROVED | REJECTED

        const appointments = await prisma.familyAppointment.findMany({
            where: { headquartersId: hqId, status },
            orderBy: { requestedDate: 'asc' },
            include: {
                patient:      { select: { name: true, roomNumber: true } },
                familyMember: { select: { name: true, email: true, relationship: true } },
                approvedBy:   { select: { name: true } },
            },
        });

        return NextResponse.json({ success: true, appointments });
    } catch (e) {
        console.error('[corporate/family-appointments GET]', e);
        return NextResponse.json({ success: false, error: 'Error al cargar citas' }, { status: 500 });
    }
}
