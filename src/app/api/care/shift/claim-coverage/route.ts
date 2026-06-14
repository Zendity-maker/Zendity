import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { todayStartAST, clinicalDayCalendarUTCRange } from '@/lib/dates';
import { inferShiftTypeFromAST, resolveCaregiverCurrentColors, type ShiftT } from '@/lib/shift-coverage';
import { redistributeUncoveredColors } from '@/lib/shift-redistribute';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';
import {
    resolveUserFloorScope,
    floorLabel,
    CaregiverFloorMissingError,
    type FloorScope,
} from '@/lib/floor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE'];
const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * POST /api/care/shift/claim-coverage
 *
 * Body: {
 *   colors: string[], shiftSessionId, shiftType?,
 *   targetFloor?: number,         // multi-floor — defaultea al floor de la cuidadora
 *   allowCrossFloor?: boolean,    // multi-floor — break-glass para cross-piso de emergencia
 * }
 *
 * Self-service desde la tablet de la cuidadora/enfermera (CAREGIVER/NURSE).
 * Usado por el CoveragePickerModal cuando:
 *   A) un sustituto llega y elige qué color cubrir, o
 *   B) un cuidador llega tarde y quiere tomar de vuelta su color
 *      que ya había sido redistribuido (este caso también se
 *      resuelve en shift/start Parte C, pero el modal ofrece un
 *      camino explícito).
 *
 * Crea ShiftPatientOverride (reason LATE_COVER) para cada residente
 * ACTIVE de los colores elegidos asignándolos al cuidador entrante.
 * Si alguno de esos pacientes tenía override activo a otro cuidador,
 * ese override se marca isActive=false + resolvedAt=now.
 *
 * ─── SPRINT MULTI-FLOOR (jun-2026) — política BREAK-GLASS ──────────────
 *
 * SAME-FLOOR (default, sin flag): la cuidadora reclama colores de SU piso.
 *   - Query de pacientes filtra por `floor: caregiverFloor`.
 *   - Orphan redistribute (huérfanos repartidos round-robin) también scoped
 *     al piso de la cuidadora — pasa `floor` al helper. Sin fuga cross-piso.
 *   - Mari1 (piso 1) reclama RED → solo RED piso 1.
 *
 * CROSS-FLOOR BREAK-GLASS (con allowCrossFloor=true + targetFloor explícito):
 *   - PERMITIDO para CAREGIVER/NURSE — excepción deliberada al gate del
 *     supervisor en assign-color #4. Razón: cobertura de emergencia ON-SITE
 *     no puede esperar a que el supervisor on-call responda. La operación
 *     necesita parche inmediato + oversight post-hoc.
 *   - Audit con emergencyCrossFloorSelfClaim=true para que el director vea
 *     este patrón en el log y evalúe staffing si se vuelve frecuente.
 *   - Notificación inmediata al/los supervisor(es) con framing "STOPGAP":
 *     no dice "Yari2 cubre piso 1" (que sonaría como resolución); dice
 *     "Yari2 ahora está PARTIDA en 2 pisos — evalúa refuerzo a piso 1".
 *   - El orphan redistribute SE OMITE en cross-floor — la cuidadora no
 *     tiene "base" en el piso ajeno, así que el concepto de "huérfano vs
 *     propio" no aplica. Toma todo lo que selecciona, directo.
 *   - Visibilidad: el override creado con emergencyCrossFloorSelfClaim=true
 *     se expone via consumer #2 (caregiver-rounds → crossFloorCoverage),
 *     por lo que el wall del supervisor lo pinta en la sección del piso
 *     objetivo (Piso 1: "X cubierto cross-piso por Yari2").
 *
 * MANAGER/NURSE INVOKER (scope='ALL'):
 *   - NURSE.floor=null → scope='ALL'. Como no hay floor por defecto, body
 *     DEBE pasar targetFloor explícito. Sin él → 400.
 *   - No aplica el concepto cross-floor (no tiene piso "propio"). El
 *     allowCrossFloor flag se ignora silenciosamente para invokers ALL.
 *
 * CAREGIVER puro con floor=null:
 *   - CaregiverFloorMissingError → 422 con mensaje accionable.
 */
export async function POST(req: Request) {
    try {
        // FASE 51 — alineación con shift/start: requireRole acepta primary OR
        // secondaryRoles. Antes el check legacy bloqueaba a cuidadoras dual-rol
        // (SUPERVISOR + CAREGIVER) cuando tocaban el CoveragePickerModal: la
        // tablet mostraba `alert('Rol no autorizado')`.
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const invokerId = auth.id;
        const invokerName = auth.name || 'Cuidador';
        const invokerRole = auth.role;
        const hqId = auth.headquartersId;

        const body = await req.json();
        // `colors` mutable: tras repartir huérfanos quedan solo los colores propios.
        let colors: string[] = Array.isArray(body.colors) ? body.colors : [];
        const shiftSessionId: string | undefined = body.shiftSessionId;
        const shiftTypeParam: ShiftT | undefined = body.shiftType;
        const rawTargetFloor: unknown = body.targetFloor;
        const allowCrossFloor: boolean = body.allowCrossFloor === true;

        if (colors.length === 0) {
            return NextResponse.json({ success: false, error: 'colors requerido (array no vacío)' }, { status: 400 });
        }
        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: 'shiftSessionId requerido' }, { status: 400 });
        }

        // Validar sesión del invocador
        const shiftSession = await prisma.shiftSession.findFirst({
            where: { id: shiftSessionId, caregiverId: invokerId, headquartersId: hqId, actualEndTime: null },
            select: { id: true, startTime: true },
        });
        if (!shiftSession) {
            return NextResponse.json({ success: false, error: 'Sesión inválida o cerrada' }, { status: 404 });
        }

        const shiftType: ShiftT = shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
            ? shiftTypeParam
            : inferShiftTypeFromAST();

        // ─── Multi-floor scope resolution ──────────────────────────────────
        // Fetch invoker.floor y resuelve scope. CAREGIVER puro con floor=null → 422.
        // NURSE/manager con scope='ALL' requiere targetFloor explícito (sin
        // floor habitual no podemos inferir).
        const invoker = await prisma.user.findUnique({
            where: { id: invokerId },
            select: { floor: true },
        });
        if (!invoker) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 401 });
        }
        let invokerScope: FloorScope;
        try {
            invokerScope = resolveUserFloorScope(
                { role: invokerRole, floor: invoker.floor },
                invokerId,
            );
        } catch (e) {
            if (e instanceof CaregiverFloorMissingError) {
                return NextResponse.json({ success: false, error: e.message }, { status: 422 });
            }
            throw e;
        }

        // Parsear targetFloor del body (number o string).
        let parsedTargetFloor: number | null = null;
        if (rawTargetFloor !== undefined && rawTargetFloor !== null && rawTargetFloor !== '') {
            const n = typeof rawTargetFloor === 'number' ? rawTargetFloor : parseInt(String(rawTargetFloor), 10);
            if (!Number.isFinite(n) || n <= 0) {
                return NextResponse.json(
                    { success: false, error: 'targetFloor inválido (debe ser entero ≥ 1)' },
                    { status: 400 },
                );
            }
            parsedTargetFloor = n;
        }

        // Determinar effectiveTargetFloor.
        let effectiveTargetFloor: number;
        if (parsedTargetFloor !== null) {
            effectiveTargetFloor = parsedTargetFloor;
        } else if (invokerScope === 'ALL') {
            // NURSE/manager invocando claim-coverage sin targetFloor explícito.
            // No tiene piso por defecto — el supervisor debe indicar el piso.
            return NextResponse.json({
                success: false,
                error: `Como ${invokerRole.toLowerCase()} no tienes piso habitual asignado. ` +
                    `Especifica targetFloor=N en el body para indicar de qué piso vas a reclamar cobertura.`,
            }, { status: 400 });
        } else {
            // Caso normal CAREGIVER: scope = su floor.
            effectiveTargetFloor = invokerScope;
        }

        // Determinar si es cross-floor break-glass. Solo aplica a invoker con
        // scope número (CAREGIVER típico) — para scope='ALL' (NURSE/manager),
        // cualquier targetFloor es "su" piso operacionalmente, no cross.
        const isCrossFloor = invokerScope !== 'ALL' && invokerScope !== effectiveTargetFloor;

        // Gate de cross-floor — pero NO 403 como en #4 (que es supervisor-driven).
        // Acá es break-glass: si la cuidadora intenta cross-piso SIN allowCrossFloor,
        // explicamos cómo. Si pasa el flag, se permite (con audit + notification
        // bigfoot). Política C decidida con Andrés (jun-2026).
        if (isCrossFloor && !allowCrossFloor) {
            return NextResponse.json({
                success: false,
                error: `Estás en ${floorLabel(invokerScope)} pero pediste reclamar ${floorLabel(effectiveTargetFloor)}. ` +
                    `Esta es cobertura cross-piso de EMERGENCIA — pasa allowCrossFloor=true en el body. ` +
                    `El supervisor será notificado inmediatamente y queda en audit.`,
            }, { status: 422 });
        }

        // ── OPCIÓN (i) — repartir huérfanos en vez de acaparar ──────────────
        // Si la cuidadora YA tiene color base, los colores que reclama que NO
        // son los suyos son HUÉRFANOS → se reparten round-robin entre TODAS las
        // activas con color (misma lógica probada del botón "Redistribuir"), no
        // se los lleva todos. Caso: Mariane (RED) reclamó BLUE y se llevó los 11;
        // ahora BLUE se reparte entre ella y Yedaira.
        // Los colores que SÍ son suyos (o si no tiene base = sustituta/entrante)
        // se procesan abajo con el flujo normal — esos sí los toma completos.
        //
        // Multi-floor (jun-2026):
        //   - SAME-FLOOR: redistribución scoped al piso de la cuidadora (pasa
        //     `floor` al helper). Orphans BLUE de piso 1 se reparten entre
        //     cuidadoras de piso 1, no del piso 2.
        //   - CROSS-FLOOR BREAK-GLASS: se OMITE el orphan path entero. La
        //     cuidadora no tiene "base" en el piso ajeno (su base es su piso
        //     habitual), así que el concepto de "propio vs huérfano" no aplica.
        //     Toma directo todo lo que selecciona — la operación es declarativa,
        //     no oportunista.
        const claimerBaseColors = await resolveCaregiverCurrentColors({ caregiverId: invokerId, hqId });
        let redistributedOrphanCount = 0;
        const orphanDistribution: Array<{ caregiver: string; count: number }> = [];
        if (claimerBaseColors.length > 0 && !isCrossFloor) {
            const orphanColors = colors.filter(c => c !== 'ALL' && !claimerBaseColors.includes(c));
            for (const oc of orphanColors) {
                const r = await redistributeUncoveredColors({
                    hqId, shiftType, color: oc, trigger: 'MANUAL',
                    floor: effectiveTargetFloor,  // multi-floor: orphans dentro del piso
                });
                redistributedOrphanCount += r.overridesCreated.length;
                for (const ov of r.overridesCreated) {
                    const e = orphanDistribution.find(d => d.caregiver === ov.caregiverName);
                    if (e) e.count++; else orphanDistribution.push({ caregiver: ov.caregiverName, count: 1 });
                }
            }
            // Quitar los huérfanos repartidos; quedan solo los colores propios.
            colors = colors.filter(c => claimerBaseColors.includes(c));
        }

        // Si tras repartir huérfanos no quedan colores propios que tomar,
        // devolver el resumen del reparto (no hay nada más que hacer).
        if (colors.length === 0) {
            return NextResponse.json({
                success: true,
                claimed: 0,
                redistributedOrphanCount,
                orphanDistribution,
                message: redistributedOrphanCount > 0
                    ? `${redistributedOrphanCount} residente${redistributedOrphanCount === 1 ? '' : 's'} del color huérfano repartido${redistributedOrphanCount === 1 ? '' : 's'} entre el equipo en piso.`
                    : 'Sin residentes para cubrir.',
            });
        }

        const shiftDate = todayStartAST();
        const nextDay = new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000);

        // Pacientes ACTIVE de los colores elegidos EN EL PISO efectivo.
        // Multi-floor: `floor: effectiveTargetFloor` añadido. Same-floor →
        // floor=caregiverFloor (auto); cross-floor break-glass → floor=targetFloor.
        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                colorGroup: { in: colors as any[] },
                floor: effectiveTargetFloor,
            },
            select: { id: true, name: true, colorGroup: true },
        });

        if (patients.length === 0) {
            return NextResponse.json({
                success: true,
                claimed: 0,
                message: 'No hay residentes ACTIVE en los colores seleccionados',
            });
        }

        // Overrides previos activos sobre estos pacientes (a otros cuidadores)
        const patientIds = patients.map(p => p.id);
        const priorOverrides = await prisma.shiftPatientOverride.findMany({
            where: {
                patientId: { in: patientIds },
                shiftDate: { gte: shiftDate, lt: nextDay },
                isActive: true,
                caregiverId: { not: invokerId },
            },
            select: { id: true, caregiverId: true, patientId: true },
        });

        const now = new Date();
        const vitalsExpiresAt = new Date(shiftSession.startTime.getTime() + VITALS_WINDOW_MS);
        const vitalsWindowOpen = vitalsExpiresAt > now;

        // ¿La cuidadora tiene un color base efectivo AHORA? Si no (caso típico:
        // pauta NIGHT entrando 4h antes en EVENING — su pauta no aplica todavía),
        // el claim debe crear también un ShiftColorAssignment para que my-color
        // resuelva el color y el tablet se ESTABILICE. Sin esto, el claim solo
        // creaba overrides — my-color seguía devolviendo null y la cuidadora
        // quedaba en el loop no-color → picker → briefing (caso Yedaira).
        // Reusa claimerBaseColors calculado arriba (no recomputar).
        const needsColorAssignment = claimerBaseColors.length === 0;
        // FK requerido: cualquier ScheduledShift de la cuidadora HOY sirve de ancla
        // (my-color lee ColorAssignment por userId+assignedAt, no por scheduledShiftId).
        let anchorShiftId: string | null = null;
        if (needsColorAssignment) {
            const dayRange = clinicalDayCalendarUTCRange();
            const anchorShift = await prisma.scheduledShift.findFirst({
                where: {
                    userId: invokerId,
                    date: { gte: dayRange.start, lt: dayRange.end },
                    schedule: { headquartersId: hqId, status: 'PUBLISHED' },
                },
                select: { id: true },
            });
            anchorShiftId = anchorShift?.id ?? null;
        }
        // Color primario que se vuelve "su color" del turno (el primero reclamado).
        const primaryColor = colors[0];

        let claimed = 0;
        let vitalsCreated = 0;
        let colorAssignmentCreated = false;

        await prisma.$transaction(async (tx) => {
            // Desactivar overrides previos de otros cuidadores
            if (priorOverrides.length > 0) {
                await tx.shiftPatientOverride.updateMany({
                    where: { id: { in: priorOverrides.map(o => o.id) } },
                    data: { isActive: false, resolvedAt: now },
                });
            }

            // Crear overrides LATE_COVER para este cuidador (skip si ya tiene uno activo)
            for (const patient of patients) {
                const existing = await tx.shiftPatientOverride.findFirst({
                    where: {
                        patientId: patient.id,
                        caregiverId: invokerId,
                        shiftDate: { gte: shiftDate, lt: nextDay },
                        isActive: true,
                    },
                    select: { id: true },
                });
                if (existing) continue;

                await tx.shiftPatientOverride.create({
                    data: {
                        headquartersId: hqId,
                        patientId: patient.id,
                        originalColor: patient.colorGroup,
                        assignedColor: patient.colorGroup, // cubre ese color
                        caregiverId: invokerId,
                        shiftDate,
                        shiftType,
                        reason: 'LATE_COVER',
                        autoAssigned: false,
                        isActive: true,
                    },
                });
                claimed++;

                // VitalsOrder si ventana 4h abierta (y no existe ya uno PENDING)
                if (vitalsWindowOpen) {
                    const existingVital = await tx.vitalsOrder.findFirst({
                        where: { patientId: patient.id, shiftSessionId, status: 'PENDING' },
                        select: { id: true },
                    });
                    if (!existingVital) {
                        await tx.vitalsOrder.create({
                            data: {
                                headquartersId: hqId,
                                patientId: patient.id,
                                orderedById: invokerId,
                                caregiverId: invokerId,
                                reason: `Vitales de entrada — cobertura ${patient.colorGroup}`,
                                orderedAt: now,
                                expiresAt: vitalsExpiresAt,
                                status: 'PENDING',
                                autoCreated: true,
                                shiftSessionId,
                                penaltyApplied: false,
                            },
                        });
                        vitalsCreated++;
                    }
                }
            }

            // Estabilizar color de la cuidadora sin pauta efectiva: crear
            // ShiftColorAssignment para el color primario reclamado. Idempotente:
            // solo si no tiene asignación de hoy todavía. Requiere un shift ancla
            // hoy (FK). Si no hay shift hoy (off-pattern total), se omite y la
            // cobertura queda solo por overrides (comportamiento previo).
            if (needsColorAssignment && anchorShiftId && primaryColor && primaryColor !== 'ALL') {
                const existingCA = await tx.shiftColorAssignment.findFirst({
                    where: { userId: invokerId, headquartersId: hqId, assignedAt: { gte: shiftDate } },
                    select: { id: true },
                });
                if (!existingCA) {
                    await tx.shiftColorAssignment.create({
                        data: {
                            headquartersId: hqId,
                            scheduledShiftId: anchorShiftId,
                            color: primaryColor,
                            userId: invokerId,
                            assignedBy: invokerId, // auto-claim desde el tablet
                            isAutoAssigned: true,
                        },
                    });
                    colorAssignmentCreated = true;
                }
            }

            await tx.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: shiftSessionId,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: invokerId,
                    payloadChanges: {
                        trigger: isCrossFloor ? 'BREAK_GLASS_CROSS_FLOOR_SELF_CLAIM' : 'LATE_COVER_PICKER',
                        shiftType,
                        colors,
                        claimed,
                        vitalsCreated,
                        priorOverridesReleased: priorOverrides.length,
                        colorAssignmentCreated,
                        primaryColor: colorAssignmentCreated ? primaryColor : undefined,
                        // Multi-floor (jun-2026): contexto del break-glass.
                        invokerFloor: invokerScope === 'ALL' ? null : invokerScope,
                        effectiveTargetFloor,
                        emergencyCrossFloorSelfClaim: isCrossFloor,
                    } as any,
                },
            });
        });

        // ─── Notificación al supervisor ──────────────────────────────────
        // Multi-floor (jun-2026): two flavors según isCrossFloor.
        //
        //   • SAME-FLOOR: notificación informativa estándar (incluye piso).
        //   • CROSS-FLOOR BREAK-GLASS: notificación URGENTE con framing
        //     "STOPGAP, NO resolución". El mensaje NO dice "Yari2 cubre piso 1"
        //     (suena a problema resuelto); dice "Yari2 PARTIDA en 2 pisos —
        //     evalúa refuerzo a piso 1". El supervisor debe entender que el
        //     auto-claim es parche, no fix, y que la fragilidad operacional
        //     real (única cuidadora del piso ajeno ausente) sigue ahí.
        try {
            if (isCrossFloor) {
                await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR'], {
                    type: 'EMAR_ALERT',
                    title: `🚨 BREAK-GLASS — ${invokerName} cubre cross-piso`,
                    message: `${invokerName} (${floorLabel(invokerScope)}) tomó cobertura de EMERGENCIA en ${floorLabel(effectiveTargetFloor)}: ${claimed} residentes de ${colors.join(', ')}. ` +
                        `Ahora está PARTIDA en dos pisos. La cobertura cruzada es STOPGAP, no resolución — ` +
                        `evalúa mandar refuerzo a ${floorLabel(effectiveTargetFloor)} o redistribuir la carga.`,
                    link: '/care/supervisor',
                });
            } else {
                await notifyRoles(hqId, ['SUPERVISOR'], {
                    type: 'EMAR_ALERT',
                    title: `${invokerName} cubre ${colors.join(', ')} (${floorLabel(effectiveTargetFloor)})`,
                    message: `${invokerName} tomó cobertura de ${claimed} residentes de ${colors.join(', ')} en ${floorLabel(effectiveTargetFloor)}${priorOverrides.length > 0 ? ` (reemplazando ${priorOverrides.length} overrides previos)` : ''}.`,
                    link: '/care/supervisor',
                });
            }
        } catch (e) { console.error('[claim-coverage notify]', e); }

        return NextResponse.json({
            success: true,
            claimed,
            vitalsCreated,
            priorOverridesReleased: priorOverrides.length,
            colors,
            colorAssignmentCreated,
            assignedColor: colorAssignmentCreated ? primaryColor : undefined,
            invokerFloor: invokerScope === 'ALL' ? null : invokerScope,
            targetFloor: effectiveTargetFloor,
            emergencyCrossFloorSelfClaim: isCrossFloor,
        });
    } catch (error: any) {
        console.error('claim-coverage error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error tomando cobertura',
        }, { status: 500 });
    }
}
