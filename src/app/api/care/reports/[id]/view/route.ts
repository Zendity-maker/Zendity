import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

/**
 * POST /api/care/reports/[id]/view
 * Director marca el reporte como visto. Solo tracking — no notifica.
 * Idempotente: si ya estaba visto, no lo sobrescribe (preserva el primer visto).
 */
export async function POST(_req: Request, { params }: any) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Solo director/admin puede marcar como visto' }, { status: 403 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
        }

        const report = await prisma.shiftHandover.findFirst({
            where: { id, headquartersId: hqId },
            select: { id: true, directorViewedAt: true },
        });
        if (!report) {
            return NextResponse.json({ success: false, error: 'Reporte no encontrado' }, { status: 404 });
        }

        // Idempotente: solo setea si está null
        if (report.directorViewedAt) {
            return NextResponse.json({ success: true, alreadyViewed: true, directorViewedAt: report.directorViewedAt });
        }

        const updated = await prisma.shiftHandover.update({
            where: { id },
            data: { directorViewedAt: new Date() },
            select: { directorViewedAt: true },
        });

        return NextResponse.json({ success: true, directorViewedAt: updated.directorViewedAt });
    } catch (err: any) {
        console.error('[care/reports/[id]/view POST]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
