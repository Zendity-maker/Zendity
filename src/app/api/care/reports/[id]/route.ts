import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * GET /api/care/reports/[id]
 * Detalle completo del reporte de turno.
 */
export async function GET(_req: Request, { params }: any) {
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

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
        }

        const report = await prisma.shiftHandover.findFirst({
            where: { id, headquartersId: hqId },
            include: {
                outgoingNurse: { select: { id: true, name: true, role: true } },
                incomingNurse: { select: { id: true, name: true, role: true } },
                supervisorSigned: { select: { id: true, name: true, role: true } },
                notes: {
                    include: {
                        patient: { select: { id: true, name: true, roomNumber: true } },
                    },
                },
            },
        });

        if (!report) {
            return NextResponse.json({ success: false, error: 'Reporte no encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, report });
    } catch (err: any) {
        console.error('[care/reports/[id] GET]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
