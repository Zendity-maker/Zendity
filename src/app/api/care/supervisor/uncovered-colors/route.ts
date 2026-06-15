import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { redistributeUncoveredColors } from '@/lib/shift-redistribute';
import { logError, logWarn } from '@/lib/logger';
import { inferShiftTypeFromAST, computeShiftCoverage, type ShiftT } from '@/lib/shift-coverage';
import { clinicalDayCalendarUTCRange } from '@/lib/dates';
import {
    canInvokeCrossFloorOverride,
    floorLabel,
} from '@/lib/floor';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/uncovered-colors?hqId=X
 *
 * Detecta grupos de color del turno actual que no tienen cuidadora con sesión activa.
 * Retorna los grupos sin cobertura y las cuidadoras activas disponibles para redistribuir.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        // hqId de la sesión (resolver): SUPERVISOR → su sede (ignora ?hqId);
        // DIRECTOR/ADMIN validados. Antes: ?hqId del cliente sin validar.
        const { searchParams } = new URL(req.url);
        const session = await getServerSession(authOptions);
        const hqId = await resolveEffectiveHqId(session!, searchParams.get('hqId'));
        const activeShiftType = inferShiftTypeFromAST();

        // Refactor: usa computeShiftCoverage (el chokepoint) en lugar de la
        // lógica propia. Antes este endpoint hacía dedup por color iterando
        // scheduledShifts, lo cual marcaba BLUE como uncovered cuando Neylianne
        // (con pauta duplicada BLUE) era la primera vista — aunque Herminia
        // (también pautada BLUE) estuviera activa cubriéndolo. El chokepoint
        // arma `coveredColors` desde TODAS las pautas de cuidadoras activas,
        // sin la dedup-por-color que ignoraba la segunda.
        // Además aplica automáticamente:
        //   - augmentExpectedColors (B): considera populated colors aun si la
        //     pauta de un color fue marcada absent.
        //   - filterRealOverrides (B): descarta huérfanos de cuidadoras
        //     clocked-out, evitando "Mariangelie cubre BLUE" falso positivo.
        const coverage = await computeShiftCoverage({ hqId, shiftType: activeShiftType });

        // El UI del supervisor muestra "Grupo X — {caregiverName} no está en piso".
        // Necesitamos asociar cada color uncovered con el nombre de la cuidadora
        // pautada original (una de ellas, si hay varias). Query solo para los
        // colores que efectivamente quedaron uncovered — barato.
        const scheduledDayRange = clinicalDayCalendarUTCRange();
        const namesByColor = new Map<string, { id: string; name: string }>();
        if (coverage.absentColors.length > 0) {
            const scheduledForAbsent = await prisma.scheduledShift.findMany({
                where: {
                    date: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                    shiftType: activeShiftType,
                    isAbsent: false,
                    schedule: { headquartersId: hqId, status: 'PUBLISHED' },
                    colorGroup: { in: coverage.absentColors as any[] },
                },
                select: { userId: true, colorGroup: true, user: { select: { name: true } } },
                orderBy: { date: 'asc' },
            });
            for (const s of scheduledForAbsent) {
                if (!s.colorGroup) continue;
                // Primer match por color (los pautados se muestran como referencia).
                if (!namesByColor.has(s.colorGroup)) {
                    namesByColor.set(s.colorGroup, {
                        id: s.userId,
                        name: s.user?.name || 'Desconocida',
                    });
                }
            }
        }

        const uncoveredColors = coverage.absentColors.map((color) => {
            const ref = namesByColor.get(color);
            return {
                color,
                assignedCaregiver: ref?.id || '',
                // Cuando NO hay pauta activa hoy para este color (ref undefined),
                // el frontend condiciona en assignedCaregiver==='' para evitar
                // el sufijo "no está en piso". Este fallback queda como defensa
                // en profundidad por si algún consumidor no condiciona.
                assignedCaregiverName: ref?.name || 'Sin cuidadora pautada',
            };
        });

        // Cuidadoras activas (mismo shape que antes)
        const activeCaregivers = coverage.activeCaregivers.map((c) => ({
            id: c.userId,
            name: c.name,
        }));

        return NextResponse.json({ success: true, activeShiftType, uncoveredColors, activeCaregivers });

    } catch (err: any) {
        logError('care.supervisor.uncovered_colors.get', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/care/supervisor/uncovered-colors
 *
 * Body: { color, shiftType, floor, allowCrossFloor? }
 *
 * Redistribuye los residentes de un color sin cobertura entre las cuidadoras activas.
 * Usa computeShiftCoverage para idempotencia: solo procesa residentes que NO tienen
 * un ShiftPatientOverride activo todavía. Previene duplicados al tocar el botón
 * múltiples veces.
 *
 * ─── SPRINT MULTI-FLOOR (jun-2026) — patrón #4 + STOPGAP reactivo ───────
 *
 * El supervisor invoca este endpoint desde el wall cuando ve un color
 * descubierto en una sección de piso. El click del wall pasa el `floor` del
 * piso afectado (Phase 4 UI). Patrón #4 + framing STOPGAP por el helper.
 *
 * - `floor` REQUERIDO: el supervisor SIEMPRE sabe de qué piso es el color
 *   descubierto (porque hizo click en su sección del wall). Sin floor → 400.
 *   Esto previene el caso silent-cross-floor de antes del sprint, cuando el
 *   endpoint era HQ-wide y un color que vivía en 2 pisos terminaba mezclando.
 *
 * - Default (sin allowCrossFloor): candidates SOLO del piso. Si no hay
 *   candidates en el piso → 422 con mensaje accionable (típico Mari1 única
 *   piso 1 ausente → no hay otra de piso 1 → supervisor debe decidir).
 *
 * - Con `allowCrossFloor=true`: candidates expanden a HQ-wide. Round-robin
 *   reparte los residentes del piso entre cuidadoras de cualquier piso.
 *   Cada override creado se marca crossFloor=true (lo expone consumer #2
 *   crossFloorCoverage en el wall). El helper dispara notificación STOPGAP
 *   automáticamente al supervisor/director ("PARTIDAS en dos pisos, evalúa
 *   refuerzo"). Audit log incluye crossFloorCount + stretchedCaregivers.
 *
 * - Rol gate del flag: solo SUP/DIR/ADM. requireRole arriba ya filtra a esos
 *   3 roles para todo el endpoint — el flag es seguro por construcción.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: markedById, headquartersId: hqId, role: invokerRole } = auth;
        const body = await req.json();
        const { color, shiftType } = body;
        const rawFloor: unknown = body.floor;
        const allowCrossFloor: boolean = body.allowCrossFloor === true;

        if (!color || !shiftType) {
            return NextResponse.json({ success: false, error: 'color y shiftType son requeridos' }, { status: 400 });
        }
        if (!['MORNING', 'EVENING', 'NIGHT'].includes(shiftType)) {
            return NextResponse.json({ success: false, error: 'shiftType inválido' }, { status: 400 });
        }

        // Multi-floor: floor es REQUERIDO. El wall del supervisor lo conoce
        // por construcción (cada uncovered color vive en una sección de piso).
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
        if (parsedFloor === null) {
            return NextResponse.json({
                success: false,
                error: 'floor requerido — especifica el piso del color descubierto (el wall lo conoce por la sección donde está el click).',
            }, { status: 400 });
        }

        // Defensa adicional: si pidió flag, valida el rol del invoker.
        // requireRole arriba ya filtró a SUP/DIR/ADM, pero esto explicita
        // el gate del cross-floor por si la lista ALLOWED_ROLES cambia.
        if (allowCrossFloor && !canInvokeCrossFloorOverride(invokerRole)) {
            return NextResponse.json({
                success: false,
                error: `Tu rol no está autorizado a autorizar cobertura cross-piso. Requiere SUPERVISOR, DIRECTOR o ADMIN.`,
            }, { status: 403 });
        }

        const colorLabels: Record<string, string> = { RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde' };
        const colorLabel = colorLabels[color] || color;

        const result = await redistributeUncoveredColors({
            hqId,
            shiftType: shiftType as ShiftT,
            color,
            floor: parsedFloor,
            allowCrossFloorCandidates: allowCrossFloor,
            trigger: 'MANUAL',
        });

        if (result.error) {
            // Multi-floor: si el error es "no candidates en piso" + caller NO
            // pidió flag, re-frasear el 422 para que el supervisor sepa que
            // tiene el botón break-glass disponible.
            const noCandidatesInFloor =
                !allowCrossFloor &&
                result.error.message.includes('No hay cuidadores en piso');
            if (noCandidatesInFloor) {
                return NextResponse.json({
                    success: false,
                    error: `No hay cuidadoras activas en ${floorLabel(parsedFloor)} para cubrir Grupo ${colorLabel}. ` +
                        `Esto es cobertura de EMERGENCIA — vuelve a invocar con allowCrossFloor=true para estirar a cuidadoras de otro piso (queda en audit + notifica STOPGAP).`,
                    requiresCrossFloor: true,
                    floor: parsedFloor,
                }, { status: 422 });
            }
            return NextResponse.json({ success: false, error: result.error.message }, { status: result.error.status });
        }

        if (result.overridesCreated.length === 0) {
            return NextResponse.json({
                success: true,
                residentsRedistributed: 0,
                alreadyRedistributed: result.alreadyRedistributedCount,
                floor: parsedFloor,
                message: result.alreadyRedistributedCount > 0
                    ? `Los residentes del Grupo ${colorLabel} en ${floorLabel(parsedFloor)} ya están redistribuidos (${result.alreadyRedistributedCount}).`
                    : `Sin residentes pendientes del Grupo ${colorLabel} en ${floorLabel(parsedFloor)}.`,
            });
        }

        // Audit trail (best-effort) — caller-specific metadata
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ShiftPatientOverride',
                    entityId: result.overridesCreated[0].id,
                    action: 'SHIFT_REDISTRIBUTE' as any,
                    performedById: markedById,
                    payloadChanges: {
                        trigger: result.crossFloorCount > 0
                            ? 'MANUAL_UNCOVERED_COLOR_CROSS_FLOOR'
                            : 'MANUAL_UNCOVERED_COLOR',
                        color,
                        shiftType,
                        redistributedCount: result.overridesCreated.length,
                        overrideIds: result.overridesCreated.map(o => o.id),
                        // Multi-floor metadata
                        floor: parsedFloor,
                        allowCrossFloor,
                        crossFloorCount: result.crossFloorCount,
                        stretchedCaregivers: result.stretchedCaregivers,
                    } as any,
                },
            });
        } catch (e) { logWarn('care.supervisor.uncovered_colors.audit', e, { hqId, color, shiftType, floor: parsedFloor }); }

        const distribution = result.overridesCreated.reduce<Array<{ caregiver: string; count: number; crossFloor: boolean }>>((acc, ov) => {
            const existing = acc.find(d => d.caregiver === ov.caregiverName);
            if (existing) {
                existing.count++;
                // Si CUALQUIERA de los assignments de esta cuidadora es cross,
                // ella aparece como cross (worst-case visible).
                if (ov.crossFloor) existing.crossFloor = true;
            } else {
                acc.push({ caregiver: ov.caregiverName, count: 1, crossFloor: ov.crossFloor });
            }
            return acc;
        }, []);

        const stopgapTag = result.crossFloorCount > 0 ? ' (STOPGAP cross-piso)' : '';
        const message = `${result.overridesCreated.length} residente${result.overridesCreated.length === 1 ? '' : 's'} del Grupo ${colorLabel} en ${floorLabel(parsedFloor)} distribuido${result.overridesCreated.length === 1 ? '' : 's'} entre ${distribution.length} cuidadora${distribution.length === 1 ? '' : 's'}${stopgapTag}.`;

        return NextResponse.json({
            success: true,
            residentsRedistributed: result.overridesCreated.length,
            distribution,
            floor: parsedFloor,
            crossFloorCount: result.crossFloorCount,
            stretchedCaregivers: result.stretchedCaregivers,
            message,
        });

    } catch (err: any) {
        logError('care.supervisor.uncovered_colors.post', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
