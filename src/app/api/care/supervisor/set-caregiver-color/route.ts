import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { logError, logWarn } from '@/lib/logger';
import { notifyUser } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];
const VALID_COLORS = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'ALL'];

/**
 * POST /api/care/supervisor/set-caregiver-color
 *
 * Body: { caregiverId, color }   color ∈ RED|YELLOW|GREEN|BLUE|ALL
 *
 * Asigna o actualiza el color base de una cuidadora para HOY vía
 * ShiftColorAssignment. Caso típico: una sustituta entra fuera de pauta y
 * Celia necesita decirle al sistema "esta cuidadora cubre BLUE hoy" —
 * antes había que escribir directo a la DB; ahora es un clic.
 *
 * Mecánica:
 *   - Si la cuidadora ya tiene ColorAssignment de hoy → actualiza color +
 *     refresca assignedAt.
 *   - Si no → crea una nueva, anclada al ScheduledShift más reciente de la
 *     cuidadora (la lookup de my-color usa userId+assignedAt, no el
 *     scheduledShiftId — el FK solo necesita ser válido).
 *   - Si la cuidadora no tiene NINGÚN ScheduledShift en su historial,
 *     responde 400 con mensaje claro (caso raro: empleada nueva sin shifts
 *     creados todavía — debe usarse el Schedule Builder primero).
 *
 * Auth: SUPERVISOR/DIRECTOR/ADMIN. hqId desde sesión.
 * Notifica a la cuidadora + deja audit log.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const caregiverId: string | undefined = body.caregiverId;
        const color: string | undefined = body.color;

        if (!caregiverId || !color) {
            return NextResponse.json(
                { success: false, error: 'caregiverId y color son requeridos' },
                { status: 400 },
            );
        }
        if (!VALID_COLORS.includes(color)) {
            return NextResponse.json(
                { success: false, error: `color inválido (${color}). Válidos: ${VALID_COLORS.join(', ')}` },
                { status: 400 },
            );
        }

        // Verificar que la cuidadora pertenezca a la sede del invocador
        const caregiver = await prisma.user.findFirst({
            where: { id: caregiverId, headquartersId: hqId, isActive: true, isDeleted: false },
            select: { id: true, name: true, role: true },
        });
        if (!caregiver) {
            return NextResponse.json(
                { success: false, error: 'Cuidadora no encontrada en esta sede' },
                { status: 404 },
            );
        }

        // Anchor FK — cualquier ScheduledShift de la cuidadora sirve.
        const anchorShift = await prisma.scheduledShift.findFirst({
            where: { userId: caregiverId, schedule: { headquartersId: hqId } },
            orderBy: { date: 'desc' },
            select: { id: true },
        });
        if (!anchorShift) {
            return NextResponse.json({
                success: false,
                error: 'La cuidadora no tiene ningún turno en su historial — primero crea uno desde el Schedule Builder.',
            }, { status: 400 });
        }

        // Idempotencia: si ya hay ColorAssignment de hoy, actualizar.
        const existing = await prisma.shiftColorAssignment.findFirst({
            where: { userId: caregiverId, headquartersId: hqId, assignedAt: { gte: todayStartAST() } },
            orderBy: { assignedAt: 'desc' },
            select: { id: true, color: true },
        });

        let actionType: 'created' | 'updated' | 'noop' = 'created';
        if (existing) {
            if (existing.color === color) {
                actionType = 'noop';
            } else {
                await prisma.shiftColorAssignment.update({
                    where: { id: existing.id },
                    data: { color, assignedAt: new Date(), assignedBy: auth.id, isAutoAssigned: false },
                });
                actionType = 'updated';
            }
        } else {
            await prisma.shiftColorAssignment.create({
                data: {
                    headquartersId: hqId,
                    scheduledShiftId: anchorShift.id,
                    color,
                    userId: caregiverId,
                    assignedBy: auth.id,
                    isAutoAssigned: false,
                },
            });
            actionType = 'created';
        }

        // Audit log
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftColorAssignment',
                    entityId: caregiverId,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: auth.id,
                    payloadChanges: {
                        trigger: 'SUPERVISOR_SET_BASE_COLOR',
                        caregiverId,
                        caregiverName: caregiver.name,
                        previousColor: existing?.color ?? null,
                        newColor: color,
                        actionType,
                    },
                },
            });
        } catch (e) { logWarn('care.supervisor.set_caregiver_color.audit', e, { caregiverId, color }); }

        // Notificación a la cuidadora (best-effort)
        if (actionType !== 'noop') {
            try {
                await notifyUser(caregiverId, {
                    type: 'SHIFT_ALERT',
                    title: 'Color de turno actualizado',
                    message: `${auth.name || 'El supervisor'} te asignó el Grupo ${color === 'ALL' ? 'Todos' : color} para este turno. Refresca el tablet para ver tus residentes.`,
                    link: '/care',
                });
            } catch (e) { logWarn('care.supervisor.set_caregiver_color.notify', e, { caregiverId }); }
        }

        return NextResponse.json({
            success: true,
            caregiverId,
            caregiverName: caregiver.name,
            color,
            actionType,
            message: actionType === 'noop'
                ? `${caregiver.name} ya estaba en Grupo ${color}.`
                : actionType === 'updated'
                    ? `${caregiver.name}: cambio a Grupo ${color}.`
                    : `${caregiver.name}: asignada a Grupo ${color}.`,
        });
    } catch (err: any) {
        logError('care.supervisor.set_caregiver_color.post', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Error asignando color' },
            { status: 500 },
        );
    }
}
