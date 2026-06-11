import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { SystemAuditAction } from '@prisma/client';

/**
 * POST /api/hr/schedule/release-shift
 *
 * Body: { scheduledShiftId: string, reason?: string }
 *
 * Libera la pauta original de una cuidadora para un turno específico —
 * sin marcarla como ausente. El resolver canónico (resolveCaregiverColors
 * y computeShiftCoverage) deja de contar el colorGroup base de ese
 * ScheduledShift, pero los ShiftColorAssignment y ShiftPatientOverride
 * que apunten al mismo shift siguen activos.
 *
 * Caso de uso: la cuidadora cambió de cobertura (claim-coverage via picker
 * o set-caregiver-color del supervisor) — el wall sigue mostrando su
 * pauta original como un segundo color "fantasma" via D1 aditivo. El
 * supervisor libera la pauta y el wall solo muestra el color real de
 * cobertura.
 *
 * Idempotente: si ya está liberada (releasedAt != null), responde 200
 * con noop=true.
 *
 * Auth: SUPERVISOR/DIRECTOR/ADMIN. Multi-tenant: la pauta debe pertenecer
 * a la sede del invocador (verificado via Schedule.headquartersId).
 */
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json().catch(() => ({}));
        const scheduledShiftId: string | undefined = body.scheduledShiftId;
        const reason: string | undefined = body.reason?.trim() || undefined;

        if (!scheduledShiftId) {
            return NextResponse.json(
                { success: false, error: 'scheduledShiftId requerido' },
                { status: 400 },
            );
        }

        // Multi-tenant findFirst: la pauta debe estar en la sede del invocador
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

        if (shift.releasedAt) {
            return NextResponse.json({
                success: true,
                noop: true,
                releasedAt: shift.releasedAt,
                message: `La pauta de ${shift.user?.name ?? 'la cuidadora'} (${shift.colorGroup ?? 'sin color'}) ya estaba liberada.`,
            });
        }

        const updated = await prisma.scheduledShift.update({
            where: { id: shift.id },
            data: {
                releasedAt: new Date(),
                releasedById: auth.id,
                releasedReason: reason,
            },
            select: { id: true, releasedAt: true },
        });

        // Audit log
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: auth.headquartersId,
                    entityName: 'ScheduledShift',
                    entityId: shift.id,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: auth.id,
                    payloadChanges: {
                        trigger: 'SUPERVISOR_RELEASE_SHIFT',
                        scheduledShiftId: shift.id,
                        caregiverId: shift.userId,
                        caregiverName: shift.user?.name ?? null,
                        date: shift.date.toISOString(),
                        shiftType: shift.shiftType,
                        releasedColor: shift.colorGroup,
                        reason: reason ?? null,
                    } as any,
                },
            });
        } catch (e) {
            console.error('[release-shift] audit log error:', e);
        }

        return NextResponse.json({
            success: true,
            noop: false,
            releasedAt: updated.releasedAt,
            message: `Pauta ${shift.colorGroup ?? 'sin color'} de ${shift.user?.name ?? 'la cuidadora'} liberada.`,
        });
    } catch (err: any) {
        console.error('[release-shift] error:', err);
        return NextResponse.json(
            { success: false, error: err?.message ?? 'Error liberando pauta' },
            { status: 500 },
        );
    }
}
