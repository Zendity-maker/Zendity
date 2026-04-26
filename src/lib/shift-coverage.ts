import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

export type ShiftT = 'MORNING' | 'EVENING' | 'NIGHT' | 'FULL_DAY' | 'FULL_NIGHT';

/**
 * Infiere el turno clínico (MORNING/EVENING/NIGHT) en hora AST (America/Puerto_Rico).
 * @param at  Fecha opcional. Por defecto usa la hora ACTUAL.
 *            Pasar `activeSession.startTime` para resolver el turno del momento
 *            en que el cuidador inició sesión, no el turno actual del reloj.
 */
export function inferShiftTypeFromAST(at?: Date): ShiftT {
    const astFmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico',
    });
    const hAst = parseInt(astFmt.format(at ?? new Date()), 10) % 24;
    if (hAst >= 6 && hAst < 14) return 'MORNING';
    if (hAst >= 14 && hAst < 22) return 'EVENING';
    return 'NIGHT';
}

export function canonicalShiftStartUtc(shiftType: ShiftT): Date {
    const base = todayStartAST();
    const offsetHours =
        shiftType === 'MORNING'    ? 0  :
        shiftType === 'EVENING'    ? 8  :
        shiftType === 'FULL_DAY'   ? 0  :  // 6AM–6PM
        shiftType === 'FULL_NIGHT' ? 12 :  // 6PM–6AM
        16;                                // NIGHT 10PM–6AM
    return new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
}

export interface ShiftCoverage {
    shiftType: ShiftT;
    expectedColors: string[];
    coveredColors: string[];
    absentColors: string[];
    alreadyRedistributed: string[];
    uncoveredPatients: Array<{
        patientId: string;
        name: string;
        colorGroup: string;
        room: string | null;
        assignedTo: null;
    }>;
    activeOverrides: Array<{
        id: string;
        patientId: string;
        patientName: string;
        originalColor: string;
        assignedColor: string;
        caregiverId: string;
        caregiverName: string;
        reason: string;
        createdAt: Date;
    }>;
    activeCaregivers: Array<{
        userId: string;
        name: string;
        shiftSessionId: string;
        startTime: Date;
        color: string | null;
    }>;
    redistributionNeeded: boolean;
    minutesSinceShiftStart: number;
    shiftStartUtc: Date;
}

/**
 * Computa la cobertura de color de un turno en una sede dada.
 *
 * Misma lógica que GET /api/care/shift/coverage pero como función pura
 * para que el endpoint de redistribución y el cron la puedan reusar sin
 * hacer una llamada HTTP interna (que además no llevaría sesión).
 */
export async function computeShiftCoverage(params: {
    hqId: string;
    shiftType: ShiftT;
}): Promise<ShiftCoverage> {
    const { hqId, shiftType } = params;

    const todayStart = todayStartAST();
    const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);

    const [scheduledShifts, activeSessions, activeOverrides] = await Promise.all([
        prisma.scheduledShift.findMany({
            where: {
                schedule: { headquartersId: hqId },
                shiftType: shiftType as any,
                date: { gte: todayStart, lt: tomorrow },
                isAbsent: false,
                colorGroup: { not: null },
            },
            select: { id: true, userId: true, colorGroup: true },
        }),
        prisma.shiftSession.findMany({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: fourteenHrsAgo },
            },
            include: { caregiver: { select: { id: true, name: true } } },
        }),
        prisma.shiftPatientOverride.findMany({
            where: {
                headquartersId: hqId,
                shiftType,
                shiftDate: { gte: todayStart, lt: tomorrow },
                isActive: true,
            },
            include: {
                patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true } },
                caregiver: { select: { id: true, name: true } },
            },
        }),
    ]);

    const expectedColorsSet = new Set<string>();
    for (const s of scheduledShifts) {
        if (s.colorGroup && s.colorGroup !== 'UNASSIGNED') expectedColorsSet.add(s.colorGroup);
    }
    const expectedColors = Array.from(expectedColorsSet).sort();

    const activeUserIds = activeSessions.map(s => s.caregiverId);

    // FIX: usar scheduledShiftId explícito en lugar del nested relation filter
    // `scheduledShift: { shiftType, date }` que generaba JOINs ineficientes y
    // 500s intermitentes en producción. Los IDs ya están en memoria del query anterior.
    const activeUserShiftIds = scheduledShifts
        .filter(s => activeUserIds.includes(s.userId))
        .map(s => s.id);

    let colorAssignments: Array<{ userId: string; color: string }> = [];
    if (activeUserShiftIds.length > 0) {
        try {
            colorAssignments = await prisma.shiftColorAssignment.findMany({
                where: { scheduledShiftId: { in: activeUserShiftIds } },
                select: { userId: true, color: true },
            });
        } catch (e) {
            // Fallback: sin asignaciones manuales → se usa colorGroup del ScheduledShift
            console.warn('[shift-coverage] ShiftColorAssignment query failed, fallback a colorGroup:', e);
        }
    }

    const coveredByUser = new Map<string, Set<string>>();
    for (const a of colorAssignments) {
        if (!coveredByUser.has(a.userId)) coveredByUser.set(a.userId, new Set());
        coveredByUser.get(a.userId)!.add(a.color);
    }
    for (const s of scheduledShifts) {
        if (!activeUserIds.includes(s.userId)) continue;
        if (coveredByUser.has(s.userId)) continue;
        if (!s.colorGroup || s.colorGroup === 'UNASSIGNED') continue;
        coveredByUser.set(s.userId, new Set([s.colorGroup]));
    }

    const coveredColorsSet = new Set<string>();
    for (const colors of coveredByUser.values()) {
        for (const c of colors) coveredColorsSet.add(c);
    }
    const coveredColors = Array.from(coveredColorsSet).sort();

    const absentColors = expectedColors.filter(c => !coveredColorsSet.has(c));

    const redistributedSet = new Set<string>();
    for (const ov of activeOverrides) redistributedSet.add(ov.originalColor);
    const alreadyRedistributed = absentColors.filter(c => redistributedSet.has(c)).sort();

    const overriddenPatientIds = new Set(activeOverrides.map(o => o.patientId));
    let uncoveredPatients: ShiftCoverage['uncoveredPatients'] = [];
    if (absentColors.length > 0) {
        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                colorGroup: { in: absentColors as any[] },
            },
            select: { id: true, name: true, colorGroup: true, roomNumber: true },
            orderBy: [{ colorGroup: 'asc' }, { name: 'asc' }],
        });
        uncoveredPatients = patients
            .filter(p => !overriddenPatientIds.has(p.id))
            .map(p => ({
                patientId: p.id,
                name: p.name,
                colorGroup: p.colorGroup,
                room: p.roomNumber,
                assignedTo: null,
            }));
    }

    const activeCaregivers = activeSessions.map(s => {
        const colors = coveredByUser.get(s.caregiverId);
        const firstColor = colors ? Array.from(colors)[0] : null;
        return {
            userId: s.caregiverId,
            name: s.caregiver?.name || 'Cuidador',
            shiftSessionId: s.id,
            startTime: s.startTime,
            color: firstColor,
        };
    });

    const shiftStartUtc = canonicalShiftStartUtc(shiftType);
    const minutesSinceShiftStart = Math.max(
        0,
        Math.round((Date.now() - shiftStartUtc.getTime()) / 60000),
    );

    return {
        shiftType,
        expectedColors,
        coveredColors,
        absentColors,
        alreadyRedistributed,
        uncoveredPatients,
        activeOverrides: activeOverrides.map(ov => ({
            id: ov.id,
            patientId: ov.patientId,
            patientName: ov.patient?.name || '—',
            originalColor: ov.originalColor,
            assignedColor: ov.assignedColor,
            caregiverId: ov.caregiverId,
            caregiverName: ov.caregiver?.name || '—',
            reason: ov.reason,
            createdAt: ov.createdAt,
        })),
        activeCaregivers,
        redistributionNeeded: uncoveredPatients.length > 0,
        minutesSinceShiftStart,
        shiftStartUtc,
    };
}
