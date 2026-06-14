import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';
import { logError, logWarn } from '@/lib/logger';
import { notifyUser } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';
import { inferShiftTypeFromAST } from '@/lib/shift-coverage';
import {
    resolveUserFloorScope,
    floorLabel,
    CaregiverFloorMissingError,
    type FloorScope,
} from '@/lib/floor';

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
 * ─── SPRINT MULTI-FLOOR (jun-2026) ──────────────────────────────────────
 *
 * El COLOR BASE es inherentemente per-piso: el resolver downstream
 * (resolveCaregiverColors → tablet → caregiver-rounds) ya filtra por
 * caregiver.floor. Por lo tanto NO hay caso cross-piso aquí — una cuidadora
 * con base RED ve los RED de SU piso, nunca de otro. El cross-piso vive
 * solo en los caminos de override (assign-color, claim-coverage,
 * redistribute) con su flag explícito.
 *
 * Este endpoint añade:
 *   1. Integridad — CAREGIVER puro con floor=null → 422 (mismo guard que
 *      en /api/care). Sin esto: setear color a una cuidadora sin piso
 *      asignado la deja con su tablet vacía silenciosamente.
 *   2. Warning soft — si el color asignado no tiene residentes ACTIVE en
 *      el piso de la cuidadora, la respuesta incluye `warning` para que
 *      el supervisor lo confirme (típico caso: typo de color). NO bloquea.
 *      Manager con scope='ALL' o color='ALL' omite el check.
 *
 * Mecánica (sin cambios):
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

        // Verificar que la cuidadora pertenezca a la sede del invocador.
        // Multi-floor (jun-2026): floor entra al select para el guard de
        // integridad + el warning de "color sin residentes en piso".
        const caregiver = await prisma.user.findFirst({
            where: { id: caregiverId, headquartersId: hqId, isActive: true, isDeleted: false },
            select: { id: true, name: true, role: true, floor: true },
        });
        if (!caregiver) {
            return NextResponse.json(
                { success: false, error: 'Cuidadora no encontrada en esta sede' },
                { status: 404 },
            );
        }

        // Multi-floor guard: CAREGIVER puro con floor=null → 422.
        // Manager con secondaryRoles=CAREGIVER (scope='ALL') pasa libremente —
        // su floor es referencial. Solo bloqueamos el caso "data corrupta" donde
        // un CAREGIVER puro perdió/nunca tuvo su floor asignado.
        let caregiverScope: FloorScope;
        try {
            caregiverScope = resolveUserFloorScope(
                { role: caregiver.role, floor: caregiver.floor },
                caregiverId,
            );
        } catch (e) {
            if (e instanceof CaregiverFloorMissingError) {
                return NextResponse.json({ success: false, error: e.message }, { status: 422 });
            }
            throw e;
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

        // Cerrar overrides del MISMO color + shift actual a OTRAS cuidadoras.
        // Caso: una cuidadora se ausenta de YELLOW → el cron redistribuye los
        // 11 residentes YELLOW entre las presentes. Después el supervisor
        // asigna a Medelyn a YELLOW vía este endpoint. Si no cerramos los
        // overrides previos, los residentes YELLOW aparecen DUPLICADOS: una
        // vez en la card de Medelyn (color base) y otra como "extras" en
        // las cards que los recibieron por la redistribución.
        //
        // FIX (2026-06-14): antes solo cerrábamos `autoAssigned: true`. Eso
        // dejaba huérfanos los overrides MANUALES — caso real con Mariangelie:
        // el supervisor había redistribuido manualmente residentes RED a
        // Brendali y Herminia, después le asignó RED como base a Mariangelie,
        // y los 6 manuales sobrevivieron generando doble carga en otras
        // cuidadoras. Operacionalmente, "X es ahora la cuidadora de COLOR"
        // significa que cualquier override previo de ese color a otra
        // cuidadora debe liberarse — auto o manual.
        //
        // No aplicamos al color 'ALL' porque eso no representa un grupo
        // específico de residentes.
        let closedOverrides = 0;
        if (color !== 'ALL' && actionType !== 'noop') {
            const scheduledDayRange = clinicalDayCalendarUTCRange();
            const currentShiftType = inferShiftTypeFromAST();
            const closeRes = await prisma.shiftPatientOverride.updateMany({
                where: {
                    headquartersId: hqId,
                    originalColor: color,
                    isActive: true,
                    shiftDate: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                    shiftType: currentShiftType as any,
                    caregiverId: { not: caregiverId },
                },
                data: { isActive: false, resolvedAt: new Date() },
            });
            closedOverrides = closeRes.count;
        }

        // Multi-floor warning: si el color asignado no tiene residentes ACTIVE
        // en el piso de la cuidadora, surfaceamos un warning para que el
        // supervisor confirme (típicamente un typo: Mari1 piso 1 ← YELLOW
        // cuando piso 1 es todo RED, su tablet quedaría vacía). No bloquea —
        // el supervisor puede insistir si tiene motivo (ej. preparándola para
        // un cambio futuro).
        //
        // Skip si scope='ALL' (manager con dual-rol, ve todo) o color='ALL'
        // (barre toda la sede, no tiene sentido el check por color específico).
        let warning: string | null = null;
        if (caregiverScope !== 'ALL' && color !== 'ALL' && actionType !== 'noop') {
            const matching = await prisma.patient.count({
                where: {
                    headquartersId: hqId,
                    status: 'ACTIVE',
                    colorGroup: color as any,
                    floor: caregiverScope,
                },
            });
            if (matching === 0) {
                warning = `${caregiver.name} fue asignada al Grupo ${color} pero ${floorLabel(caregiverScope)} no tiene residentes ACTIVE de ese color. Su tablet quedará vacía hasta que alguno aplique. ¿Era el color correcto?`;
            }
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
                        caregiverFloor: caregiverScope === 'ALL' ? null : caregiverScope,
                        previousColor: existing?.color ?? null,
                        newColor: color,
                        actionType,
                        closedOverrides,
                        emptyOnFloor: warning !== null,
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

        const baseMsg = actionType === 'noop'
            ? `${caregiver.name} ya estaba en Grupo ${color}.`
            : actionType === 'updated'
                ? `${caregiver.name}: cambio a Grupo ${color}.`
                : `${caregiver.name}: asignada a Grupo ${color}.`;
        const message = closedOverrides > 0
            ? `${baseMsg} Liberé ${closedOverrides} residente${closedOverrides === 1 ? '' : 's'} ${color} que estaba${closedOverrides === 1 ? '' : 'n'} cubierto${closedOverrides === 1 ? '' : 's'} por otra cuidadora.`
            : baseMsg;

        return NextResponse.json({
            success: true,
            caregiverId,
            caregiverName: caregiver.name,
            caregiverFloor: caregiverScope === 'ALL' ? null : caregiverScope,
            color,
            actionType,
            closedOverrides,
            message,
            warning,
        });
    } catch (err: any) {
        logError('care.supervisor.set_caregiver_color.post', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Error asignando color' },
            { status: 500 },
        );
    }
}
