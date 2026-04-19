import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE'];

const SHIFT_LABEL: Record<string, string> = {
    MORNING: 'mañana',
    EVENING: 'tarde',
    NIGHT: 'noche',
    SUPERVISOR_DAY: 'supervisor',
};

/**
 * POST /api/care/reports/[id]/confirm
 * El cuidador SENIOR del turno activo confirma el reporte.
 * Seniority: User.hiredAt ASC → fallback User.createdAt ASC.
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
            return NextResponse.json({ success: false, error: 'Solo cuidadores o enfermería pueden confirmar' }, { status: 403 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const note: string | undefined = body?.note;

        const report = await prisma.shiftHandover.findFirst({
            where: { id, headquartersId: hqId },
        });
        if (!report) {
            return NextResponse.json({ success: false, error: 'Reporte no encontrado' }, { status: 404 });
        }
        if (report.seniorConfirmedAt) {
            return NextResponse.json({ success: false, error: 'El reporte ya fue confirmado por otro cuidador senior' }, { status: 409 });
        }

        // Identificar cuidadores activos (sesión de turno abierta, últimas 14h)
        const fourteenHoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: fourteenHoursAgo },
            },
            include: {
                caregiver: { select: { id: true, name: true, role: true, hiredAt: true, createdAt: true } },
            },
        });

        const eligible = activeSessions
            .map(s => s.caregiver)
            .filter(u => u && ALLOWED_ROLES.includes(u.role));

        if (eligible.length === 0) {
            return NextResponse.json({ success: false, error: 'No hay cuidadores activos en el turno' }, { status: 409 });
        }

        // Ordenar: hiredAt ASC (nulls al final), fallback createdAt ASC
        eligible.sort((a: any, b: any) => {
            const aH = a.hiredAt ? new Date(a.hiredAt).getTime() : null;
            const bH = b.hiredAt ? new Date(b.hiredAt).getTime() : null;
            if (aH !== null && bH !== null) return aH - bH;
            if (aH !== null) return -1;
            if (bH !== null) return 1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        const senior = eligible[0];
        if (senior.id !== invokerId) {
            return NextResponse.json({
                success: false,
                error: `Solo el cuidador senior del turno (${senior.name}) puede confirmar el reporte`,
            }, { status: 403 });
        }

        const updated = await prisma.shiftHandover.update({
            where: { id },
            data: {
                seniorCaregiverId: invokerId,
                seniorConfirmedAt: new Date(),
                seniorNote: note ?? null,
            },
            include: {
                seniorCaregiver: { select: { name: true } },
            },
        });

        // Notificar a SUPERVISOR/DIRECTOR/ADMIN
        const shiftLabel = SHIFT_LABEL[report.shiftType] || report.shiftType;
        await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
            type: 'HANDOVER',
            title: 'Reporte de turno confirmado',
            message: `${updated.seniorCaregiver?.name || 'Un cuidador senior'} confirmó el reporte del turno ${shiftLabel}. Pendiente tu firma.`,
        });

        return NextResponse.json({ success: true, report: updated });
    } catch (err: any) {
        console.error('[care/reports/[id]/confirm POST]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
