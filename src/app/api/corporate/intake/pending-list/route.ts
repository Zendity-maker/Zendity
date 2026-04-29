import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/corporate/intake/pending-list
 * Lista los ingresos en estado PENDIENTE_REVISION para la sede del usuario.
 * Incluye nombre del residente y fecha de última actualización.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const allowedRoles = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];
        if (!allowedRoles.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: true, intakes: [] });
        }

        const intakes = await prisma.intakeData.findMany({
            where: {
                status: 'PENDIENTE_REVISION',
                patient: {
                    headquartersId: hqId,
                },
            },
            include: {
                patient: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { updatedAt: 'asc' },
        });

        return NextResponse.json({ success: true, intakes });
    } catch (error) {
        console.error('[pending-list] Error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
