import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * GET /api/care/reports
 * Lista de reportes de turno (ShiftHandover) de la sede del invocador.
 * Query params:
 *   ?status=PENDING|ACCEPTED
 *   ?limit=20 (default 20, cap 100)
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get('status');
        const limitParam = parseInt(searchParams.get('limit') || '20', 10);
        const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 100);

        const where: any = { headquartersId: hqId };
        if (statusParam === 'PENDING' || statusParam === 'ACCEPTED') {
            where.status = statusParam;
        }

        const reports = await prisma.shiftHandover.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                outgoingNurse: { select: { id: true, name: true, role: true } },
                seniorCaregiver: { select: { id: true, name: true, role: true } },
                supervisorSigned: { select: { id: true, name: true, role: true } },
                _count: { select: { notes: true } },
            },
        });

        const shaped = reports.map(r => ({
            id: r.id,
            shiftType: r.shiftType,
            status: r.status,
            createdAt: r.createdAt,
            acceptedAt: r.acceptedAt,
            seniorConfirmedAt: r.seniorConfirmedAt,
            supervisorSignedAt: r.supervisorSignedAt,
            directorViewedAt: r.directorViewedAt,
            aiSummaryPreview: (r.aiSummaryReport || '').slice(0, 200),
            hasAiSummary: !!r.aiSummaryReport,
            outgoingNurse: r.outgoingNurse,
            seniorCaregiver: r.seniorCaregiver,
            supervisorSigned: r.supervisorSigned,
            notesCount: r._count.notes,
        }));

        return NextResponse.json({ success: true, reports: shaped });
    } catch (err: any) {
        console.error('[care/reports GET]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
