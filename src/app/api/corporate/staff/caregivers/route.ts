import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hqId = new URL(req.url).searchParams.get('hqId') || session.user.headquartersId;

    const staff = await prisma.user.findMany({
        where: {
            headquartersId: hqId,
            isActive: true,
            role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] },
        },
        select: { id: true, name: true, role: true },
    });

    // TaskAssignmentButton expects { caregivers: [...] }
    return NextResponse.json({ caregivers: staff });
}
