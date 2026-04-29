import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/corporate/intake/pending-count
 * Retorna el número de ingresos en estado PENDIENTE_REVISION para la sede del usuario.
 * Usado por AppLayout para mostrar el badge en "Admisión de Residentes".
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const allowedRoles = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];
        if (!allowedRoles.includes((session.user as any).role)) {
            return NextResponse.json({ count: 0 });
        }

        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ count: 0 });
        }

        const count = await prisma.intakeData.count({
            where: {
                status: 'PENDIENTE_REVISION',
                patient: {
                    headquartersId: hqId,
                },
            },
        });

        return NextResponse.json({ success: true, count });
    } catch (error) {
        console.error('[pending-count] Error:', error);
        return NextResponse.json({ success: false, count: 0 }, { status: 500 });
    }
}
