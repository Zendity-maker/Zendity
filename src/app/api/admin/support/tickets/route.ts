import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET — todos los tickets (solo SUPER_ADMIN) */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const tickets = await prisma.supportTicket.findMany({
        include: {
            submittedBy: { select: { name: true, role: true, email: true } },
            headquarters: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });

    return NextResponse.json({ success: true, tickets });
}
