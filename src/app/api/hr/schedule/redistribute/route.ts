import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * POST /api/hr/schedule/redistribute
 *
 * Redistribución MANUAL desde el modal de ausencia en el constructor
 * de horarios. El supervisor elige un cuidador específico.
 *
 * La redistribución automática ya ocurre dentro de /api/hr/schedule/absent.
 * Este endpoint solo sirve para override manual post-ausencia.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json(
                { success: false, error: 'Solo supervisores pueden redistribuir turnos' },
                { status: 403 }
            );
        }

        const { scheduledShiftId, targetUserId, color, hqId: requestedHqId, isAutoAssigned } = await req.json();

        if (!scheduledShiftId || !targetUserId || !color) {
            return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
        }

        // La sede sale de la sesión, nunca del body. Antes se escribía el hqId
        // que mandara el cliente: un SUPERVISOR podía crear asignaciones en el
        // horario de OTRA sede. Con una sola sede en producción no se notaba.
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        // Y el turno y la persona tienen que ser de esa sede. El rol correcto
        // sobre un id ajeno sigue siendo acceso ajeno.
        const [turno, destinatario] = await Promise.all([
            // ScheduledShift no tiene sede propia: cuelga de Schedule. Hay que
            // atravesar la relación o el filtro no aísla nada.
            prisma.scheduledShift.findFirst({
                where: { id: scheduledShiftId, schedule: { headquartersId: hqId } },
                select: { id: true },
            }),
            prisma.user.findFirst({
                where: { id: targetUserId, headquartersId: hqId },
                select: { id: true },
            }),
        ]);
        if (!turno) {
            return NextResponse.json({ success: false, error: 'Turno no encontrado en esta sede' }, { status: 404 });
        }
        if (!destinatario) {
            return NextResponse.json({ success: false, error: 'El empleado no pertenece a esta sede' }, { status: 404 });
        }

        const assignment = await prisma.shiftColorAssignment.create({
            data: {
                headquartersId: hqId,
                scheduledShiftId,
                color,
                userId: targetUserId,
                assignedBy: session.user.id,
                isAutoAssigned: isAutoAssigned || false,
                assignedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, assignment });

    } catch (error: any) {
        console.error('[redistribute] error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error redistribuyendo' },
            { status: 500 }
        );
    }
}
