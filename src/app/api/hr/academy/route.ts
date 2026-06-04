import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // hqId de la sesión (resolver) — SIN role guard a propósito: el academy
        // lo consumen TODOS los roles, incluido CAREGIVER.
        const { searchParams } = new URL(request.url);
        const hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));

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
