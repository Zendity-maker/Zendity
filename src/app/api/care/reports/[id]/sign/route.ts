import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * POST /api/care/reports/[id]/sign
 * Supervisor/Director/Admin firma el reporte.
 * Requiere que el senior ya haya confirmado.
 */
export async function POST(req: Request, { params }: any) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Solo supervisor/director puede firmar' }, { status: 403 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const signature: string | undefined = body?.signature;
        const note: string | undefined = body?.note;

        if (!signature || typeof signature !== 'string' || signature.trim().length < 10) {
            return NextResponse.json({ success: false, error: 'Firma requerida' }, { status: 400 });
        }

        const report = await prisma.shiftHandover.findFirst({
            where: { id, headquartersId: hqId },
        });
        if (!report) {
            return NextResponse.json({ success: false, error: 'Reporte no encontrado' }, { status: 404 });
        }
        if (!report.seniorConfirmedAt) {
            return NextResponse.json({
                success: false,
                error: 'El cuidador senior debe confirmar el reporte antes de que lo firmes',
            }, { status: 409 });
        }
        if (report.supervisorSignedAt) {
            return NextResponse.json({ success: false, error: 'El reporte ya fue firmado' }, { status: 409 });
        }

        const now = new Date();
        const updated = await prisma.shiftHandover.update({
            where: { id },
            data: {
                supervisorSignedById: invokerId,
                supervisorSignedAt: now,
                supervisorSignature: signature,
                supervisorNote: note ?? null,
                status: 'ACCEPTED',
                acceptedAt: now,
            },
            include: {
                supervisorSigned: { select: { id: true, name: true, role: true } },
            },
        });

        return NextResponse.json({ success: true, report: updated });
    } catch (err: any) {
        console.error('[care/reports/[id]/sign POST]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
