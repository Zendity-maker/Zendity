import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;

        const updated = await prisma.academyAssignment.update({
            where: { id },
            data: { status: 'IN_PROGRESS' }
        });

        return NextResponse.json({ success: true, capsule: updated });
    } catch (error) {
        console.error('Academy start error:', error);
        return NextResponse.json({ error: 'Failed to start module' }, { status: 500 });
    }
}
