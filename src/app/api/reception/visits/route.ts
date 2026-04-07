import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        const hqId = session.user.headquartersId;

        const where: Record<string, unknown> = { headquartersId: hqId };
        if (patientId) where.patientId = patientId;

        const visits = await prisma.familyVisit.findMany({
            where,
            orderBy: { visitedAt: 'desc' },
            take: patientId ? 50 : 200,
            select: {
                id: true,
                visitorName: true,
                residentName: true,
                patientId: true,
                visitedAt: true,
                signatureData: true
            }
        });

        return NextResponse.json({ success: true, visits });
    } catch (error) {
        console.error('Visits GET error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando visitas' }, { status: 500 });
    }
}
