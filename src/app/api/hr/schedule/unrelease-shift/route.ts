import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { SystemAuditAction } from '@prisma/client';

/**
 * POST /api/hr/schedule/unrelease-shift
 *
 * Body: { scheduledShiftId: string }
 *
 * Revierte una liberación previa: limpia releasedAt/releasedById/releasedReason.
 * El resolver vuelve a contar el colorGroup base.
 *
 * Idempotente: si ya está activa (releasedAt = null), responde 200 con noop.
 *
 * Auth: SUPERVISOR/DIRECTOR/ADMIN. Multi-tenant scoped por sede del invocador.
 */
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json().catch(() => ({}));
        const scheduledShiftId: string | undefined = body.scheduledShiftId;
        if (!scheduledShiftId) {
            return NextResponse.json(
                { success: false, error: 'scheduledShiftId requerido' },
                { status: 400 },
            );
        }

        const shift = await prisma.scheduledShift.findFirst({
            where: { id: scheduledShiftId, schedule: { headquartersId: auth.headquartersId } },
            select: {
                id: true,
                userId: true,
                colorGroup: true,
                date: true,
                shiftType: true,
                releasedAt: true,
                user: { select: { name: true } },
            },
        });
        if (!shift) {
            return NextResponse.json(
                { success: false, error: 'Pauta no encontrada en esta sede' },
                { status: 404 },
            );
        }

        if (!shift.releasedAt) {
            return NextResponse.json({
                success: true,
                noop: true,
                message: `La pauta de ${shift.user?.name ?? 'la cuidadora'} ya estaba activa.`,
            });
        }

        await prisma.scheduledShift.update({
            where: { id: shift.id },
            data: {
                releasedAt: null,
                releasedById: null,
                releasedReason: null,
            },
        });

        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: auth.headquartersId,
                    entityName: 'ScheduledShift',
                    entityId: shift.id,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: auth.id,
                    payloadChanges: {
                        trigger: 'SUPERVISOR_UNRELEASE_SHIFT',
                        scheduledShiftId: shift.id,
                        caregiverId: shift.userId,
                        caregiverName: shift.user?.name ?? null,
                        date: shift.date.toISOString(),
                        shiftType: shift.shiftType,
                        reactivatedColor: shift.colorGroup,
                    } as any,
                },
            });
        } catch (e) {
            console.error('[unrelease-shift] audit log error:', e);
        }

        return NextResponse.json({
            success: true,
            noop: false,
            message: `Pauta ${shift.colorGroup ?? 'sin color'} de ${shift.user?.name ?? 'la cuidadora'} reactivada.`,
        });
    } catch (err: any) {
        console.error('[unrelease-shift] error:', err);
        return NextResponse.json(
            { success: false, error: err?.message ?? 'Error reactivando pauta' },
            { status: 500 },
        );
    }
}
