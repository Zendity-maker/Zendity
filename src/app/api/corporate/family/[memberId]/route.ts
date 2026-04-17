import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/corporate/family/[memberId]
 * Elimina un FamilyMember. Solo DIRECTOR y ADMIN.
 * Valida que FamilyMember.headquartersId === session.user.headquartersId.
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ memberId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!['DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo DIRECTOR o ADMIN pueden eliminar familiares' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { memberId } = await params;

        const member = await prisma.familyMember.findUnique({
            where: { id: memberId },
            select: { id: true, headquartersId: true },
        });
        if (!member) return NextResponse.json({ success: false, error: 'Familiar no encontrado' }, { status: 404 });
        if (member.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Familiar no pertenece a tu sede' }, { status: 403 });
        }

        await prisma.familyMember.delete({ where: { id: memberId } });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[Family DELETE]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
