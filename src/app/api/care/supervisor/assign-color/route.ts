import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError, logWarn } from '@/lib/logger';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';
import { type ShiftT, ACTIVE_PRESENCE_MAX_HOURS } from '@/lib/shift-coverage';
import {
    resolveUserFloorScope,
    assertSameFloor,
    canInvokeCrossFloorOverride,
    floorLabel,
    CaregiverFloorMissingError,
    CrossFloorViolationError,
    type FloorScope,
} from '@/lib/floor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * POST /api/care/supervisor/assign-color
 *
 * Asignación top-down explícita: el supervisor elige UN caregiver activo
 * y le asigna los residentes ACTIVE de un color en un piso específico vía
 * ShiftPatientOverride. Alternativa al round-robin automático de
 * /api/care/shift/redistribute — útil cuando el supervisor quiere
 * consolidar cobertura en una persona específica (más experimentada,
 * mejor relación con esos residentes, etc.) en lugar de distribuir.
 *
 * Body: {
 *   color, shiftType, targetCaregiverId,
 *   targetFloor?: number,        // NUEVO multi-floor — defaultea al floor de la cuidadora
 *   allowCrossFloor?: boolean,   // NUEVO multi-floor — requerido si targetFloor != caregiver.floor
 * }
 *
 * ─── SPRINT MULTI-FLOOR (jun-2026) ──────────────────────────────────────
 *
 * DEFAULT (sin targetFloor en body):
 *   - effectiveTargetFloor = caregiver.floor (auto-scoped).
 *   - Mari1 (piso 1) + RED → solo RED de piso 1. Los RED del piso 2 no son
 *     parte de su asignación y no la bloquean.
 *   - assertSameFloor pasa por construcción.
 *
 * CROSS-FLOOR (targetFloor explícito + caregiver de otro piso):
 *   - Yari2 (piso 2) + RED + targetFloor=1 → solo RED del piso 1.
 *   - Requiere allowCrossFloor=true en el body (caller intenta saltarse el piso).
 *   - Requiere invoker.role autorizado (canInvokeCrossFloorOverride).
 *   - Audit log marca crossFloor=true + crossFloorAuthorized=true.
 *
 * SAME-FLOOR EXPLÍCITO (targetFloor=1 con cuidadora piso 1):
 *   - Funciona sin flag — assertSameFloor pasa porque coinciden.
 *   - No es cobertura cruzada; es solo redundancia inocua del caller.
 *
 * MANAGER CON DUAL-ROL (NURSE/SUP con secondaryRoles=[CAREGIVER]):
 *   - resolveUserFloorScope retorna 'ALL'. Sin targetFloor en body → 400
 *     "especifica targetFloor=N explícito". No inferimos piso de touches —
 *     este sprint elimina magia. El supervisor sabe qué piso quiere.
 *
 * CAREGIVER puro CON floor=null:
 *   - resolveUserFloorScope throws CaregiverFloorMissingError → 422.
 *     Admin debe asignarle un piso antes de poder asignarle cobertura.
 *
 * EMPTY-RESULT (color+floor sin residentes activos):
 *   - Retorna success con 0 cuentas y mensaje explícito "Sin residentes
 *     {color} en {piso}". No es error — es info para el supervisor.
 *
 * Comportamiento (post scope):
 *   - Valida que targetCaregiverId tenga sesión activa en HQ.
 *   - Para cada residente ACTIVE del color EN EL FLOOR resuelto:
 *     • Si tiene override activo al MISMO caregiver → skip (idempotente).
 *     • Si tiene override activo a OTRO caregiver → mark isActive=false +
 *       resolvedAt=now en el viejo, crea nuevo a target.
 *     • Si no tiene override → crea nuevo a target.
 *   - Notifica al target con la lista NUEVA (no spammear con los que
 *     ya tenía cubiertos). El mensaje incluye el piso y, si aplica, marca
 *     "cobertura cross-piso".
 *   - Notifica a supervisores con resumen + cross-floor flag.
 *   - Audit log con conteos + floor metadata.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerId = auth.id;
        const invokerName = auth.name || 'Supervisor';
        const invokerRole = auth.role;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const color: string | undefined = body.color;
        const shiftType: ShiftT | undefined = body.shiftType;
        const targetCaregiverId: string | undefined = body.targetCaregiverId;
        const rawTargetFloor: unknown = body.targetFloor;
        const allowCrossFloor: boolean = body.allowCrossFloor === true;

        if (!color || !shiftType || !targetCaregiverId) {
            return NextResponse.json(
                { success: false, error: 'color, shiftType y targetCaregiverId son requeridos' },
                { status: 400 }
            );
        }
        if (!['MORNING', 'EVENING', 'NIGHT'].includes(shiftType)) {
            return NextResponse.json({ success: false, error: 'shiftType inválido' }, { status: 400 });
        }

        // ── Validar caregiver target — debe tener sesión activa en HQ ──
        // Cap unificado de presencia (16h). Alineado con isSoloCaregiver,
        // caregiver-rounds y /api/care para que el mismo conjunto de
        // "activas en piso" sea el referente en TODO el código clínico.
        //
        // Multi-floor (jun-2026): caregiver.role y caregiver.floor entran al
        // select para resolveUserFloorScope (rol decide si floor es requerido).
        const presenceCap = new Date(Date.now() - ACTIVE_PRESENCE_MAX_HOURS * 60 * 60 * 1000);
        const targetSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId: targetCaregiverId,
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: presenceCap },
            },
            include: { caregiver: { select: { id: true, name: true, role: true, floor: true } } },
        });
        if (!targetSession) {
            return NextResponse.json(
                { success: false, error: 'La cuidadora seleccionada no tiene sesión activa en esta sede' },
                { status: 400 }
            );
        }
        const targetName = targetSession.caregiver?.name || 'Cuidadora';
        const targetRole = targetSession.caregiver?.role ?? 'CAREGIVER';
        const targetFloorRaw = targetSession.caregiver?.floor ?? null;

        // ── Multi-floor: resolver scope del target + effective target floor ──
        // CAREGIVER puro con floor=null → CaregiverFloorMissingError → 422.
        // NURSE/SUPERVISOR con secondaryRoles=CAREGIVER → scope='ALL' → exige
        // body.targetFloor explícito (no inferimos de touches, eliminamos magia).
        let targetCaregiverScope: FloorScope;
        try {
            targetCaregiverScope = resolveUserFloorScope(
                { role: targetRole, floor: targetFloorRaw },
                targetCaregiverId,
            );
        } catch (e) {
            if (e instanceof CaregiverFloorMissingError) {
                return NextResponse.json({ success: false, error: e.message }, { status: 422 });
            }
            throw e;
        }

        // Parsear targetFloor del body si vino (acepta number o string).
        let parsedTargetFloor: number | null = null;
        if (rawTargetFloor !== undefined && rawTargetFloor !== null && rawTargetFloor !== '') {
            const n = typeof rawTargetFloor === 'number' ? rawTargetFloor : parseInt(String(rawTargetFloor), 10);
            if (!Number.isFinite(n) || n <= 0) {
                return NextResponse.json(
                    { success: false, error: 'targetFloor inválido (debe ser entero ≥ 1)' },
                    { status: 400 }
                );
            }
            parsedTargetFloor = n;
        }

        // Determinar el piso efectivo.
        let effectiveTargetFloor: number;
        if (parsedTargetFloor !== null) {
            effectiveTargetFloor = parsedTargetFloor;
        } else if (targetCaregiverScope === 'ALL') {
            // Manager/dual-rol sin floor habitual asignado — el supervisor debe
            // declarar el piso explícito. NO inferimos.
            return NextResponse.json({
                success: false,
                error: `${targetName} es manager/dual-rol y no tiene un piso habitual asignado. ` +
                    `Especifica targetFloor=N en el body para indicar a qué piso vas a asignar esta cobertura.`,
            }, { status: 400 });
        } else {
            // Caso normal: auto-scope al piso habitual de la cuidadora.
            effectiveTargetFloor = targetCaregiverScope;
        }

        // ── Cross-floor guard ──
        // assertSameFloor pasa silenciosamente si los floors coinciden (caso
        // típico: same-floor, sin flag necesario). Si difieren y allowCrossFloor
        // está true, también pasa. Si difieren sin flag → CrossFloorViolationError → 422.
        try {
            assertSameFloor(targetCaregiverScope, effectiveTargetFloor, 'assign-color', { allowCrossFloor });
        } catch (e) {
            if (e instanceof CrossFloorViolationError) {
                return NextResponse.json({ success: false, error: e.message }, { status: 422 });
            }
            throw e;
        }

        // Si efectivamente es cross-floor, validar rol del invoker. Solo
        // SUPERVISOR/DIRECTOR/ADMIN pueden autorizar la excepción.
        const isCrossFloor = targetCaregiverScope !== 'ALL' && targetCaregiverScope !== effectiveTargetFloor;
        if (isCrossFloor) {
            if (!canInvokeCrossFloorOverride(invokerRole)) {
                return NextResponse.json({
                    success: false,
                    error: `Tu rol (${invokerRole}) no está autorizado a asignar cobertura cross-piso. ` +
                        `Requiere SUPERVISOR, DIRECTOR o ADMIN.`,
                }, { status: 403 });
            }
        }

        // ── Residentes ACTIVE del color en el piso efectivo ──
        // Multi-floor: filtro `floor: effectiveTargetFloor` añadido. Antes era
        // HQ-wide (color solo); ahora SIEMPRE scoped por piso — same-floor o
        // cross-floor con flag, el set es el del piso objetivo.
        const residents = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                colorGroup: color as any,
                floor: effectiveTargetFloor,
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        if (residents.length === 0) {
            // Empty-result gracioso (no error). Casos: color ausente en ese
            // piso (ej. YELLOW en piso 1 que es todo RED), o nadie ACTIVE.
            return NextResponse.json({
                success: true,
                created: 0,
                reassigned: 0,
                alreadyAssigned: 0,
                target: { id: targetCaregiverId, name: targetName },
                targetFloor: effectiveTargetFloor,
                crossFloor: isCrossFloor,
                message: `Sin residentes ACTIVE del Grupo ${color} en ${floorLabel(effectiveTargetFloor)}. Nada que asignar.`,
            });
        }

        // ── Rango de fecha del turno (día clínico AST) ──
        const scheduledDayRange = clinicalDayCalendarUTCRange();
        const shiftDate = scheduledDayRange.start;

        // ── Procesar cada residente ──
        // Para cada uno:
        //  1. Buscar override ACTIVO existente (cualquier caregiver) para este shift.
        //  2. Si apunta a target → skip (idempotente, contabilizar alreadyAssigned).
        //  3. Si apunta a OTRO → marcar viejo isActive=false + resolvedAt, crear nuevo a target.
        //  4. Si no hay → crear nuevo a target.
        let created = 0;
        let reassigned = 0;
        let alreadyAssigned = 0;
        const newResidents: typeof residents = [];

        for (const r of residents) {
            const existing = await prisma.shiftPatientOverride.findFirst({
                where: {
                    patientId: r.id,
                    shiftDate: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                    shiftType: shiftType,
                    isActive: true,
                },
                select: { id: true, caregiverId: true },
            });

            if (existing && existing.caregiverId === targetCaregiverId) {
                alreadyAssigned++;
                continue;
            }

            if (existing) {
                // Reasignación — cerrar viejo y crear nuevo
                await prisma.shiftPatientOverride.update({
                    where: { id: existing.id },
                    data: { isActive: false, resolvedAt: new Date() },
                });
                reassigned++;
            } else {
                created++;
            }

            await prisma.shiftPatientOverride.create({
                data: {
                    headquartersId: hqId,
                    patientId: r.id,
                    originalColor: color,
                    assignedColor: color, // asignación top-down al mismo color (no es cobertura cruzada)
                    caregiverId: targetCaregiverId,
                    shiftDate,
                    shiftType,
                    reason: 'MANUAL',
                    autoAssigned: false,
                    isActive: true,
                },
            });
            newResidents.push(r);
        }

        const totalNew = created + reassigned;
        const colorLabels: Record<string, string> = {
            RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde',
        };
        const colorLabel = colorLabels[color] || color;

        // ── Audit log ──
        // Multi-floor: payload incluye targetCaregiverFloor, effectiveTargetFloor
        // y crossFloor para que el log diga POR QUÉ se decidió esto. Cualquier
        // auditoría futura sobre cobertura puede reconstruir el caso.
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: targetCaregiverId,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: invokerId,
                    payloadChanges: {
                        trigger: 'MANUAL_ASSIGN_COLOR',
                        color,
                        shiftType,
                        targetCaregiverId,
                        targetCaregiverName: targetName,
                        targetCaregiverFloor: targetCaregiverScope === 'ALL' ? null : targetCaregiverScope,
                        effectiveTargetFloor,
                        crossFloor: isCrossFloor,
                        crossFloorAuthorized: isCrossFloor ? true : false,
                        created,
                        reassigned,
                        alreadyAssigned,
                        residentsTotal: residents.length,
                    },
                },
            });
        } catch (e) { logWarn('care.supervisor.assign_color.audit', e, { color, shiftType, targetCaregiverId, effectiveTargetFloor, crossFloor: isCrossFloor }); }

        // ── Notificaciones ──
        // Solo notificar si hubo movimiento real (creados o reasignados).
        // Si todo era idempotente (alreadyAssigned === residents.length),
        // no spammeamos.
        //
        // Multi-floor: el mensaje incluye el piso y, si aplica, marca explícito
        // "cobertura cross-piso" para que tanto la cuidadora como los supervisores
        // sepan que esto es excepcional (no su asignación habitual).
        if (totalNew > 0) {
            const names = newResidents.map(r => r.name).join(', ');
            const floorTag = floorLabel(effectiveTargetFloor);
            const crossTag = isCrossFloor ? ' — COBERTURA CROSS-PISO (emergencia)' : '';
            const targetMsg = isCrossFloor
                ? `${invokerName} te asignó ${totalNew} residente${totalNew === 1 ? '' : 's'} del Grupo ${colorLabel} en ${floorTag} (cobertura cross-piso desde tu ${floorLabel(targetCaregiverScope)}): ${names}.`
                : `${invokerName} te asignó ${totalNew} residente${totalNew === 1 ? '' : 's'} del Grupo ${colorLabel} en ${floorTag}: ${names}.`;
            const supMsg = `${invokerName} asignó ${totalNew} residente${totalNew === 1 ? '' : 's'} del Grupo ${colorLabel} en ${floorTag} a ${targetName}${isCrossFloor ? ` (su piso habitual: ${floorLabel(targetCaregiverScope)})` : ''}.`;
            await Promise.all([
                notifyUser(targetCaregiverId, {
                    type: 'SHIFT_ALERT',
                    title: `Asignación — Grupo ${colorLabel} ${floorTag}${crossTag}`,
                    message: targetMsg,
                    link: '/care',
                }),
                notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                    type: 'SHIFT_ALERT',
                    title: `Asignación de cobertura — Grupo ${colorLabel} ${floorTag}${crossTag}`,
                    message: supMsg,
                    link: '/care/supervisor',
                }),
            ]);
        }

        const floorTagShort = floorLabel(effectiveTargetFloor);
        const summaryMessage = totalNew === 0
            ? `${targetName} ya tenía asignados los ${alreadyAssigned} residentes del Grupo ${colorLabel} en ${floorTagShort}.`
            : reassigned > 0
                ? `${totalNew} residente${totalNew === 1 ? '' : 's'} del Grupo ${colorLabel} en ${floorTagShort} asignado${totalNew === 1 ? '' : 's'} a ${targetName} (${created} nuevo${created === 1 ? '' : 's'}, ${reassigned} reasignado${reassigned === 1 ? '' : 's'})${isCrossFloor ? ' — cross-piso' : ''}.`
                : `${created} residente${created === 1 ? '' : 's'} del Grupo ${colorLabel} en ${floorTagShort} asignado${created === 1 ? '' : 's'} a ${targetName}${isCrossFloor ? ' — cross-piso' : ''}.`;

        return NextResponse.json({
            success: true,
            created,
            reassigned,
            alreadyAssigned,
            target: { id: targetCaregiverId, name: targetName },
            targetFloor: effectiveTargetFloor,
            crossFloor: isCrossFloor,
            message: summaryMessage,
        });

    } catch (err: any) {
        logError('care.supervisor.assign_color.post', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Error asignando color' },
            { status: 500 }
        );
    }
}
