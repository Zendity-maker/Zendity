import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** PATCH /api/admin/support/tickets/[id] — actualizar status / adminNote */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, adminNote } = body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
            ...(status ? { status } : {}),
            ...(adminNote !== undefined ? { adminNote } : {}),
        },
    });

    return NextResponse.json({ success: true, ticket: updated });
}
