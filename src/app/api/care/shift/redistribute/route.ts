import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { inferShiftTypeFromAST, type ShiftT } from '@/lib/shift-coverage';
import { todayStartAST } from '@/lib/dates';
import { redistributeUncoveredColors } from '@/lib/shift-redistribute';
import { notifyRoles } from '@/lib/notifications';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';
import {
    canInvokeCrossFloorOverride,
    floorLabel,
} from '@/lib/floor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MANUAL_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * POST /api/care/shift/redistribute
 *
 * Body: { hqId?, shiftType?, trigger: 'AUTO' | 'MANUAL', floor?, allowCrossFloor? }
 *
 * Autenticación doble:
 *  - Manual: sesión de SUPERVISOR/DIRECTOR/ADMIN
 *  - Automática: header Authorization: Bearer <CRON_SECRET> (llamada del cron)
 *
 * Reparte round-robin los residentes de colores ausentes entre los cuidadores
 * activos que tienen color efectivo asignado. Crea ShiftPatientOverride por
 * residente + VitalsOrder si la ventana 4h del shiftSession del receptor no
 * ha vencido. Notifica receptores y supervisor.
 *
 * ─── SPRINT MULTI-FLOOR (jun-2026) ──────────────────────────────────────
 *
 * CRON MODE (trigger='AUTO', Bearer CRON_SECRET):
 *   - Cuando body NO trae `floor`: itera floors automáticamente. Para cada
 *     piso de la sede, llama redistributeUncoveredColors({floor}). NUNCA
 *     cross-piso automático — el cron NO autoriza break-glass.
 *   - Si un piso no tiene candidates (Mari1 ausente piso 1, cuidadora única,
 *     sin reemplazo): NO drop silencioso. Notificación URGENTE al supervisor
 *     ("🚨 Piso N SIN COBERTURA — acción humana requerida") + log estructurado.
 *     Los residentes quedan uncovered (visible via /api/corporate/live zombie
 *     chip + uncovered-colors endpoint) — el supervisor decide break-glass.
 *   - Con `floor` explícito en body: scoped a ese piso (modo testing o
 *     re-run de un solo piso).
 *
 * MANUAL MODE (supervisor session):
 *   - Sin caller frontend hoy, pero si llegara a usarse, sigue patrón #4:
 *     body requiere `floor`. Sin candidates en el piso + sin flag → 422.
 *     Con `allowCrossFloor=true` + rol autorizado → cross-floor candidates,
 *     overrides marcados crossFloor, audit + STOPGAP notification por el helper.
 *   - Rol fuera de SUP/DIR/ADM con flag → 403 (mismo gate que #4).
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL';
        const isCron = authHeader === `Bearer ${cronSecret}`;

        let session: Session | null = null;
        if (!isCron) {
            session = await getServerSession(authOptions);
            if (!session?.user) {
                return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
            }
            if (!MANUAL_ROLES.includes((session.user as any).role)) {
                return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
            }
        }

        const body = await req.json().catch(() => ({}));
        const requestedHqId: string | undefined = body.hqId;
        const shiftTypeParam: ShiftT | undefined = body.shiftType;
        const trigger: 'AUTO' | 'MANUAL' = body.trigger === 'AUTO' ? 'AUTO' : (isCron ? 'AUTO' : 'MANUAL');
        const rawFloor: unknown = body.floor;
        const allowCrossFloor: boolean = body.allowCrossFloor === true;

        // Parse + valida `floor`.
        let parsedFloor: number | null = null;
        if (rawFloor !== undefined && rawFloor !== null && rawFloor !== '') {
            const n = typeof rawFloor === 'number' ? rawFloor : parseInt(String(rawFloor), 10);
            if (!Number.isFinite(n) || n <= 0) {
                return NextResponse.json(
                    { success: false, error: 'floor inválido (debe ser entero ≥ 1)' },
                    { status: 400 },
                );
            }
            parsedFloor = n;
        }

        let hqId: string;
        if (isCron) {
            if (!requestedHqId) {
                return NextResponse.json({ success: false, error: 'hqId requerido en llamada cron' }, { status: 400 });
            }
            const hq = await prisma.headquarters.findFirst({
                where: { id: requestedHqId, isActive: true },
                select: { id: true },
            });
            if (!hq) {
                return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });
            }
            hqId = requestedHqId;
        } else {
            try {
                hqId = await resolveEffectiveHqId(session!, requestedHqId || null);
            } catch (e: any) {
                return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
            }
        }

        const shiftType: ShiftT = shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
            ? shiftTypeParam
            : inferShiftTypeFromAST();

        // ─── Branch: cron iteración per-piso vs llamada single-floor ────
        // Multi-floor (jun-2026):
        //   - Cron (trigger='AUTO') sin floor explícito → itera floors. NEVER
        //     cross-floor automático. Cada piso es una llamada independiente
        //     al helper. Pisos sin candidates → notificación URGENTE.
        //   - Cron con floor explícito → procesa solo ese piso (testing/re-run).
        //   - Manual sin floor → trata como single-call HQ-wide legacy
        //     (compat). Manual con floor → modo #4.
        const shouldIterateAllFloors = isCron && parsedFloor === null;

        if (shouldIterateAllFloors) {
            return await processAllFloorsCron({
                hqId,
                shiftType,
                trigger,
            });
        }

        // ─── Single-floor path (cron con floor, o manual) ────────────────
        // Si manual con allowCrossFloor=true, valida rol (defense in depth —
        // requireRole ya filtró pero el flag pide explícito).
        if (!isCron && allowCrossFloor && !canInvokeCrossFloorOverride((session!.user as any).role)) {
            return NextResponse.json({
                success: false,
                error: `Tu rol no está autorizado a redistribuir cross-piso. Requiere SUPERVISOR, DIRECTOR o ADMIN.`,
            }, { status: 403 });
        }

        // Delega al helper unificado. computeShiftCoverage + round-robin +
        // idempotencia + vitales + notificaciones viven todos ahí.
        // Cron NUNCA pasa allowCrossFloorCandidates (no autoriza break-glass
        // automático). Manual lo pasa solo si el supervisor lo pidió.
        const result = await redistributeUncoveredColors({
            hqId,
            shiftType,
            ...(parsedFloor !== null ? { floor: parsedFloor } : {}),
            ...(allowCrossFloor && !isCron ? { allowCrossFloorCandidates: true } : {}),
            trigger,
        });

        if (result.error) {
            return NextResponse.json({ success: false, error: result.error.message }, { status: result.error.status });
        }

        // Sin huecos o todo ya redistribuido
        if (!result.coverage.redistributionNeeded || result.overridesCreated.length === 0) {
            return NextResponse.json({
                success: true,
                redistributed: 0,
                overridesCreated: [],
                vitalsCreated: 0,
                message: result.coverage.redistributionNeeded
                    ? 'Sin pacientes para redistribuir (todos ya tienen override activo)'
                    : 'No hay huecos — cobertura completa o ya redistribuida',
                coverage: {
                    absentColors: result.coverage.absentColors,
                    alreadyRedistributed: result.coverage.alreadyRedistributed,
                },
            });
        }

        // Audit log con metadata multi-floor.
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: result.overridesCreated[0].id,
                    action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                    performedById: isCron ? null : (session!.user as any).id,
                    payloadChanges: {
                        trigger,
                        shiftType,
                        shiftDate: todayStartAST().toISOString(),
                        absentColors: result.coverage.absentColors,
                        redistributedCount: result.overridesCreated.length,
                        vitalsCreated: result.vitalsCreated,
                        recipientsCount: result.notifyByCaregiver.size,
                        overrideIds: result.overridesCreated.map(o => o.id),
                        // Multi-floor metadata
                        floor: parsedFloor,
                        crossFloorCount: result.crossFloorCount,
                        stretchedCaregivers: result.stretchedCaregivers,
                        allowCrossFloor: allowCrossFloor && !isCron,
                    } as any,
                },
            });
        } catch (e) { logWarn('care.shift.redistribute.audit', e, { hqId, shiftType, trigger }); }

        return NextResponse.json({
            success: true,
            redistributed: result.overridesCreated.length,
            overridesCreated: result.overridesCreated,
            vitalsCreated: result.vitalsCreated,
            trigger,
            shiftType,
            floor: parsedFloor,
            crossFloorCount: result.crossFloorCount,
            stretchedCaregivers: result.stretchedCaregivers,
        });
    } catch (error: any) {
        logError('care.shift.redistribute.post', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error ejecutando redistribución',
        }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Iteración per-piso del cron — SPRINT MULTI-FLOOR (jun-2026)
// ────────────────────────────────────────────────────────────────────────────
// El cron itera floors de la sede automáticamente. Para CADA piso:
//   1. Llama redistributeUncoveredColors({floor}) — NUNCA con
//      allowCrossFloorCandidates (cron no autoriza break-glass).
//   2. Si retorna error "no candidates en piso" → SKIP RUIDOSO: notificación
//      URGENTE al supervisor + log estructurado. Los residentes quedan
//      uncovered (surfacean en zombie chip del director y uncovered-colors
//      del wall). El skip NO es silencioso — un humano se entera.
//   3. Si éxito → audit log + acumula al resultado agregado.
// Retorna response agregado con per-floor breakdown.
// ════════════════════════════════════════════════════════════════════════════
async function processAllFloorsCron(opts: {
    hqId: string;
    shiftType: ShiftT;
    trigger: 'AUTO' | 'MANUAL';
}): Promise<NextResponse> {
    const { hqId, shiftType, trigger } = opts;

    // Distinct floors con residentes ACTIVE en la sede. Iteramos solo donde
    // hay residentes — un piso vacío no tiene nada que redistribuir.
    // Excluye floor=null (data anomaly — esos residentes se reportarían como
    // zombies por sus consumers floor-unaware; el cron no puede hacer nada
    // con ellos).
    const distinctFloorRows = await prisma.patient.findMany({
        where: {
            headquartersId: hqId,
            status: 'ACTIVE',
            floor: { not: null },
        },
        select: { floor: true },
        distinct: ['floor'],
        orderBy: { floor: 'asc' },
    });
    const floors = distinctFloorRows
        .map(r => r.floor)
        .filter((f): f is number => f !== null);

    if (floors.length === 0) {
        return NextResponse.json({
            success: true,
            redistributed: 0,
            byFloor: [],
            message: 'No hay floors con residentes ACTIVE en la sede.',
            trigger, shiftType,
        });
    }

    const byFloor: Array<{
        floor: number;
        redistributed: number;
        vitalsCreated: number;
        skipped: boolean;
        skippedReason?: string;
    }> = [];
    let totalRedistributed = 0;
    let totalVitals = 0;

    for (const floor of floors) {
        const result = await redistributeUncoveredColors({
            hqId,
            shiftType,
            floor,
            // CRON NUNCA cross-floor: allowCrossFloorCandidates omitido (=false default).
            trigger,
        });

        if (result.error) {
            // Caso crítico — piso sin candidates. NO drop silencioso: surfacea
            // al supervisor para que evalúe break-glass / refuerzo. Los
            // residentes uncovered del piso aparecerán en /corporate/live
            // zombie chip + /uncovered-colors del wall — el cron los hace
            // VISIBLES vía esta notificación adicional.
            const uncoveredInFloor = result.coverage.uncoveredPatients.length;
            byFloor.push({
                floor,
                redistributed: 0,
                vitalsCreated: 0,
                skipped: true,
                skippedReason: result.error.message,
            });

            if (uncoveredInFloor > 0) {
                // Notificación RUIDOSA — el supervisor debe saber YA.
                try {
                    await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR'], {
                        type: 'EMAR_ALERT',
                        title: `🚨 ${floorLabel(floor)} SIN COBERTURA — cron no pudo redistribuir`,
                        message: `El cron de redistribución encontró ${uncoveredInFloor} residente(s) descubierto(s) en ${floorLabel(floor)} pero NO HAY cuidadoras activas en ese piso. El cron NO autoriza cross-piso automáticamente — requiere ACCIÓN HUMANA INMEDIATA. Opciones: (a) mandar backup al piso, (b) usar redistribute con allowCrossFloor=true para estirar cuidadoras de otro piso, (c) cuidadora ON-SITE usa break-glass desde su tablet.`,
                        link: '/care/supervisor',
                    });
                } catch (e) {
                    logWarn('care.shift.redistribute.cron_skip_notify', e, { hqId, floor, uncoveredInFloor });
                }
            }

            // Log estructurado para visibilidad/incidentes.
            logWarn('care.shift.redistribute.cron_no_candidates_skip', {
                hqId, shiftType, floor, uncoveredInFloor,
                errorMessage: result.error.message,
            });
            continue;
        }

        // Éxito en este piso. Audit + acumula.
        if (result.overridesCreated.length > 0) {
            try {
                await prisma.systemAuditLog.create({
                    data: {
                        headquartersId: hqId,
                        entityName: 'ShiftPatientOverride',
                        entityId: result.overridesCreated[0].id,
                        action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                        performedById: null,
                        payloadChanges: {
                            trigger,
                            shiftType,
                            shiftDate: todayStartAST().toISOString(),
                            absentColors: result.coverage.absentColors,
                            redistributedCount: result.overridesCreated.length,
                            vitalsCreated: result.vitalsCreated,
                            recipientsCount: result.notifyByCaregiver.size,
                            overrideIds: result.overridesCreated.map(o => o.id),
                            floor,
                            crossFloorCount: 0, // cron NEVER cross-floor
                            stretchedCaregivers: [],
                            allowCrossFloor: false,
                        } as any,
                    },
                });
            } catch (e) { logWarn('care.shift.redistribute.audit_floor', e, { hqId, floor }); }
        }

        byFloor.push({
            floor,
            redistributed: result.overridesCreated.length,
            vitalsCreated: result.vitalsCreated,
            skipped: false,
        });
        totalRedistributed += result.overridesCreated.length;
        totalVitals += result.vitalsCreated;
    }

    return NextResponse.json({
        success: true,
        redistributed: totalRedistributed,
        vitalsCreated: totalVitals,
        trigger, shiftType,
        byFloor,
    });
}
