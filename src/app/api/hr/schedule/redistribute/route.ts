import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

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

        const { scheduledShiftId, targetUserId, color, hqId, isAutoAssigned } = await req.json();

        if (!scheduledShiftId || !targetUserId || !color || !hqId) {
            return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
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
