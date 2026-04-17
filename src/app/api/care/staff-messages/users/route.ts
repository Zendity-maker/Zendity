import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET — Lista de usuarios de la sede para el selector de destinatario.
 * Excluye rol FAMILY y el propio usuario.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const userId = (session.user as any).id;
        const hqId = (session.user as any).headquartersId;
        const role = (session.user as any).role;
        if (role === 'FAMILY') return NextResponse.json({ success: false, error: 'Prohibido' }, { status: 403 });

        // FAMILY usa modelo FamilyMember aparte, no aparece en User
        const users = await prisma.user.findMany({
            where: {
                headquartersId: hqId,
                isActive: true,
                isDeleted: false,
                id: { not: userId },
            },
            select: { id: true, name: true, role: true, image: true, photoUrl: true },
            orderBy: [{ role: 'asc' }, { name: 'asc' }],
        });

        return NextResponse.json({ success: true, users });
    } catch (err: any) {
        console.error('[StaffMessages Users GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
