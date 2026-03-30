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

        const scores = await prisma.performanceScore.findMany({
            where: { headquartersId: hqId },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        const performances = scores.map(s => ({
            id: s.id,
            userId: s.userId,
            userName: s.user.name,
            systemScore: s.systemScore,
            humanScore: s.humanScore ?? null,
            finalScore: s.finalScore,
            systemFindings: (s.systemFindings as Record<string, number>) ?? {}
        }));

        return NextResponse.json({ success: true, performances });
    } catch (error) {
        console.error('Performance GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch performances' }, { status: 500 });
    }
}
