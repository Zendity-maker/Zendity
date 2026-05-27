import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { redistributeUncoveredColors } from '@/lib/shift-redistribute';
import { logError, logWarn } from '@/lib/logger';
import { inferShiftTypeFromAST, computeShiftCoverage, type ShiftT } from '@/lib/shift-coverage';
import { clinicalDayCalendarUTCRange } from '@/lib/dates';

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

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId') || auth.headquartersId;
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
                assignedCaregiverName: ref?.name || 'Sin pauta no-absent',
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
 * Redistribuye los residentes de un color sin cobertura entre las cuidadoras activas.
 * Usa computeShiftCoverage para idempotencia: solo procesa residentes que NO tienen
 * un ShiftPatientOverride activo todavía. Previene duplicados al tocar el botón
 * múltiples veces.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: markedById, headquartersId: hqId } = auth;
        const { color, shiftType } = await req.json();

        if (!color || !shiftType) {
            return NextResponse.json({ success: false, error: 'color y shiftType son requeridos' }, { status: 400 });
        }
        if (!['MORNING', 'EVENING', 'NIGHT'].includes(shiftType)) {
            return NextResponse.json({ success: false, error: 'shiftType inválido' }, { status: 400 });
        }

        const colorLabels: Record<string, string> = { RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde' };
        const colorLabel = colorLabels[color] || color;

        const result = await redistributeUncoveredColors({
            hqId,
            shiftType: shiftType as ShiftT,
            color,
            trigger: 'MANUAL',
        });

        if (result.error) {
            return NextResponse.json({ success: false, error: result.error.message }, { status: result.error.status });
        }

        if (result.overridesCreated.length === 0) {
            return NextResponse.json({
                success: true,
                residentsRedistributed: 0,
                alreadyRedistributed: result.alreadyRedistributedCount,
                message: result.alreadyRedistributedCount > 0
                    ? `Los residentes del Grupo ${colorLabel} ya están redistribuidos (${result.alreadyRedistributedCount}).`
                    : `Sin residentes pendientes en el Grupo ${colorLabel}.`,
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
                        trigger: 'MANUAL_UNCOVERED_COLOR',
                        color,
                        shiftType,
                        redistributedCount: result.overridesCreated.length,
                        overrideIds: result.overridesCreated.map(o => o.id),
                    } as any,
                },
            });
        } catch (e) { logWarn('care.supervisor.uncovered_colors.audit', e, { hqId, color, shiftType }); }

        const distribution = result.overridesCreated.reduce<Array<{ caregiver: string; count: number }>>((acc, ov) => {
            const existing = acc.find(d => d.caregiver === ov.caregiverName);
            if (existing) existing.count++;
            else acc.push({ caregiver: ov.caregiverName, count: 1 });
            return acc;
        }, []);

        return NextResponse.json({
            success: true,
            residentsRedistributed: result.overridesCreated.length,
            distribution,
            message: `${result.overridesCreated.length} residente${result.overridesCreated.length === 1 ? '' : 's'} del Grupo ${colorLabel} distribuido${result.overridesCreated.length === 1 ? '' : 's'} entre ${distribution.length} cuidadora${distribution.length === 1 ? '' : 's'}.`,
        });

    } catch (err: any) {
        logError('care.supervisor.uncovered_colors.post', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
