import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/my-observations/pending-count
 *
 * Retorna la cantidad de observaciones pendientes de respuesta
 * para el empleado autenticado (status = PENDING_EXPLANATION).
 *
 * Usado por el badge "Mis Observaciones" en el sidebar clínico.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        if (!userId) {
            return NextResponse.json({ success: false, count: 0 });
        }

        const count = await prisma.incidentReport.count({
            where: {
                employeeId: userId,
                status: 'PENDING_EXPLANATION',
                visibleToEmployee: true,
            },
        });

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error('[my-observations/pending-count] error:', error);
        return NextResponse.json({ success: false, count: 0 });
    }
}
