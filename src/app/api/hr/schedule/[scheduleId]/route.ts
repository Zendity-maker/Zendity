import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/hr/schedule/[scheduleId]
 * Elimina un Schedule en estado DRAFT. Solo DIRECTOR y ADMIN.
 * Nunca permite borrar un PUBLISHED — debe hacerse /unpublish primero.
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!['DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo DIRECTOR o ADMIN pueden eliminar borradores' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { scheduleId } = await params;

        const schedule = await prisma.schedule.findUnique({
            where: { id: scheduleId },
            select: { id: true, headquartersId: true, status: true, weekStartDate: true },
        });
        if (!schedule) return NextResponse.json({ success: false, error: 'Horario no encontrado' }, { status: 404 });

        if (schedule.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Horario no pertenece a tu sede' }, { status: 403 });
        }

        if (schedule.status === 'PUBLISHED') {
            return NextResponse.json({ success: false, error: 'Horario PUBLICADO. Usa Editar horario publicado primero.' }, { status: 409 });
        }

        // Borrado en transacción: primero ScheduledShift, luego Schedule
        await prisma.$transaction(async (tx) => {
            await tx.scheduledShift.deleteMany({ where: { scheduleId } });
            await tx.schedule.delete({ where: { id: scheduleId } });
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[Schedule DELETE]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
