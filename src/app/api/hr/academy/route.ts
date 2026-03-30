import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const hqId = searchParams.get('hqId') || session.user.headquartersId;

        const assignments = await prisma.academyAssignment.findMany({
            where: { headquartersId: hqId },
            orderBy: { createdAt: 'desc' }
        });

        const capsules = assignments.map(a => ({
            id: a.id,
            userId: a.userId,
            moduleCode: a.moduleCode,
            moduleTitle: a.moduleCode.replace(/_/g, ' '),
            reason: a.reason,
            status: a.status
        }));

        return NextResponse.json({ success: true, capsules });
    } catch (error) {
        console.error('Academy GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch capsules' }, { status: 500 });
    }
}
