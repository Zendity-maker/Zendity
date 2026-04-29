import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

/**
 * GET /api/corporate/hr/shift-log
 * Bitácora general de turnos de la sede — solo lectura para gestión.
 *
 * Query params:
 *   ?from=2026-04-01          (ISO date, inicio rango)
 *   ?to=2026-04-30            (ISO date, fin rango)
 *   ?shiftType=MORNING|EVENING|NIGHT|FULL_DAY|FULL_NIGHT
 *   ?status=PENDING|ACCEPTED
 *   ?employeeId=uuid
 *   ?page=1                   (paginación, 25 por página)
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Sin sede asignada' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const from       = searchParams.get('from');
        const to         = searchParams.get('to');
        const shiftType  = searchParams.get('shiftType');
        const status     = searchParams.get('status');
        const employeeId = searchParams.get('employeeId');
        const page       = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const PAGE_SIZE  = 25;

        const where: any = { headquartersId: hqId };

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = toDate;
            }
        }
        if (shiftType) where.shiftType = shiftType;
        if (status === 'PENDING' || status === 'ACCEPTED') where.status = status;
        if (employeeId) where.outgoingNurseId = employeeId;

        const [total, records] = await Promise.all([
            prisma.shiftHandover.count({ where }),
            prisma.shiftHandover.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
                include: {
                    outgoingNurse:    { select: { id: true, name: true, role: true } },
                    incomingNurse:    { select: { id: true, name: true, role: true } },
                    supervisorSigned: { select: { id: true, name: true } },
                    _count: { select: { notes: true } },
                },
            }),
        ]);

        const shaped = records.map(r => ({
            id:                r.id,
            shiftType:         r.shiftType,
            status:            r.status,
            handoverCompleted: r.handoverCompleted,
            isDailyPrologue:   r.isDailyPrologue,
            colorGroups:       r.colorGroups,
            createdAt:         r.createdAt,
            signedOutAt:       r.signedOutAt,
            supervisorSignedAt:r.supervisorSignedAt,
            directorViewedAt:  r.directorViewedAt,
            supervisorNote:    r.supervisorNote,
            aiSummaryPreview:  (r.aiSummaryReport || '').slice(0, 300),
            outgoingNurse:     r.outgoingNurse,
            incomingNurse:     r.incomingNurse,

            supervisorSigned:  r.supervisorSigned,
            notesCount:        r._count.notes,
        }));

        return NextResponse.json({
            success: true,
            records: shaped,
            pagination: {
                total,
                page,
                pageSize: PAGE_SIZE,
                totalPages: Math.ceil(total / PAGE_SIZE),
            },
        });
    } catch (err: any) {
        console.error('[shift-log GET]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
