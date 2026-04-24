import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { patientId: true }
        });

        if (!familyMember?.patientId) {
            return NextResponse.json({ success: false, error: 'No vinculado a ningún residente' }, { status: 404 });
        }

        const plans = await prisma.lifePlan.findMany({
            where: {
                patientId: familyMember.patientId,
                status: 'APPROVED',
            },
            orderBy: { approvedAt: 'desc' },
            select: {
                id: true,
                type: true,
                familyVersion: true,
                approvedAt: true,
                emailSentAt: true,
                startDate: true,
                nextReview: true,
                createdAt: true,
                approvedBy: { select: { name: true } }
            }
        });

        return NextResponse.json({ success: true, plans });
    } catch (error) {
        console.error('GET /api/family/pai error:', error);
        return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
    }
}
