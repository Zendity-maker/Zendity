import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const userId = (session.user as any).id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { complianceScore: true },
        });

        if (!user) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
        }

        const recentEvents = await prisma.scoreEvent.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                delta: true,
                reason: true,
                category: true,
                scoreBefore: true,
                scoreAfter: true,
                createdAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            score: user.complianceScore,
            recentEvents,
        });

    } catch (err) {
        console.error('[my-score GET]', err);
        return NextResponse.json({ success: false, error: 'Error cargando score' }, { status: 500 });
    }
}
