import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
    resolveUserFloorScope,
    floorLabel,
    CaregiverFloorMissingError,
    type FloorScope,
} from '@/lib/floor';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * POST /api/hr/schedule/redistribute
 *
 * Redistribución MANUAL desde el modal de ausencia en el constructor
 * de horarios. El supervisor elige un cuidador específico.
 *
 * La redistribución automática ya ocurre dentro de /api/hr/schedule/absent.
 * Este endpoint solo sirve para override manual post-ausencia.
 *
 * ─── SPRINT MULTI-FLOOR (jun-2026) ──────────────────────────────────────
 *
 * Este endpoint crea un `ShiftColorAssignment` (color base — misma tabla que
 * /api/care/supervisor/set-caregiver-color, consumer #5). La tablet downstream
 * (consumer #1) ya floor-scopea por `caregiver.floor`, por lo que el color
 * base es inherentemente per-piso: asignarle RED a Mari1 (piso 1) hará que
 * solo vea RED del piso 1, jamás del piso 2. El concepto cross-piso NO aplica
 * a este endpoint — la decisión cross-piso vive en endpoints de override
 * (#4 assign-color, #6 claim-coverage, #2/#3 redistribute).
 *
 * Cambios multi-floor (minimal pass, mismo molde que #5):
 *   1. Guard de integridad: CAREGIVER puro con floor=null → 422. Sin esto,
 *      asignar color a una cuidadora sin piso la deja en estado roto
 *      silencioso (tabla vacía downstream por filtro de piso).
 *   2. Warning soft: si el color asignado no tiene residentes ACTIVE en el
 *      piso de la cuidadora, response incluye `warning` para que el supervisor
 *      confirme (típico typo). NO bloquea — el supervisor puede insistir.
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

        // ── Multi-floor guard: target user scope ──
        // Verifica que el target sea de esta sede + resuelve su floor scope.
        const targetUser = await prisma.user.findFirst({
            where: { id: targetUserId, headquartersId: hqId, isActive: true, isDeleted: false },
            select: { id: true, name: true, role: true, floor: true },
        });
        if (!targetUser) {
            return NextResponse.json(
                { success: false, error: 'Cuidadora destino no encontrada en esta sede' },
                { status: 404 }
            );
        }
        let targetScope: FloorScope;
        try {
            targetScope = resolveUserFloorScope(
                { role: targetUser.role, floor: targetUser.floor },
                targetUserId,
            );
        } catch (e) {
            if (e instanceof CaregiverFloorMissingError) {
                return NextResponse.json({ success: false, error: e.message }, { status: 422 });
            }
            throw e;
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

        // ── Warning soft si el color no tiene residentes en el piso ──
        // Skip si scope='ALL' (manager) o color='ALL' (barre todo, no aplica).
        let warning: string | null = null;
        if (targetScope !== 'ALL' && color !== 'ALL') {
            const matching = await prisma.patient.count({
                where: {
                    headquartersId: hqId,
                    status: 'ACTIVE',
                    colorGroup: color as any,
                    floor: targetScope,
                },
            });
            if (matching === 0) {
                warning = `${targetUser.name} fue asignada al Grupo ${color} pero ${floorLabel(targetScope)} no tiene residentes ACTIVE de ese color. Su tablet quedará vacía hasta que alguno aplique. ¿Era el color correcto?`;
            }
        }

        return NextResponse.json({
            success: true,
            assignment,
            targetUserFloor: targetScope === 'ALL' ? null : targetScope,
            warning,
        });

    } catch (error: any) {
        console.error('[redistribute] error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error redistribuyendo' },
            { status: 500 }
        );
    }
}
