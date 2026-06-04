import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request) {
    try {
        // Tenant fix — hqId SIEMPRE de la sesión; el ?hqId del query se ignora
        // (cierra la fuga cross-hq). SIN role guard a propósito: el dashboard de
        // /hr/academy consume este endpoint también para CAREGIVER
        // (PerformanceAcademyDashboard role='CAREGIVER'); restringir por rol
        // rompería su vista. requireSession + scope por sede es suficiente.
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;

        const hqId = auth.headquartersId;

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
