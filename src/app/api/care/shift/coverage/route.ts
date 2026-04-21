import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

type ShiftT = 'MORNING' | 'EVENING' | 'NIGHT';

/**
 * Sprint N.2 — Detección de huecos de color en el turno actual.
 *
 * Compara los colores ESPERADOS (ScheduledShift del día sin ausencia) con
 * los colores CUBIERTOS (ShiftSession activas y su color efectivo vía
 * ShiftColorAssignment → fallback a ScheduledShift.colorGroup).
 *
 * Reporta también los overrides activos del turno y la lista de residentes
 * cuyo color quedó sin cubrir (para que el round-robin de N.3 sepa qué
 * repartir).
 */
function inferShiftTypeFromAST(): ShiftT {
    const astFmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico',
    });
    const hAst = parseInt(astFmt.format(new Date()), 10) % 24;
    if (hAst >= 6 && hAst < 14) return 'MORNING';
    if (hAst >= 14 && hAst < 22) return 'EVENING';
    return 'NIGHT';
}

/**
 * Inicio canónico del turno actual (UTC).
 *  MORNING: todayStartAST() (6 AM AST)
 *  EVENING: todayStartAST() + 8h
 *  NIGHT:   todayStartAST() + 16h
 * Para NIGHT en la madrugada AST (0-5), todayStartAST() ya devuelve el
 * día clínico anterior, con lo cual +16h sigue siendo 10 PM AST del
 * día clínico activo.
 */
function canonicalShiftStartUtc(shiftType: ShiftT): Date {
    const base = todayStartAST();
    const offsetHours = shiftType === 'MORNING' ? 0 : shiftType === 'EVENING' ? 8 : 16;
    return new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get('hqId');
        const shiftTypeParam = searchParams.get('shiftType') as ShiftT | null;

        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        const shiftType: ShiftT = shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
            ? shiftTypeParam
            : inferShiftTypeFromAST();

        const todayStart = todayStartAST();
        const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);

        const [
            scheduledShifts,
            activeSessions,
            activeOverrides,
        ] = await Promise.all([
            // Turnos programados del día — fuente de "colores esperados"
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
            // Sesiones vivas (≤14h) — cuidadores realmente en piso
            prisma.shiftSession.findMany({
                where: {
                    headquartersId: hqId,
                    actualEndTime: null,
                    startTime: { gte: fourteenHrsAgo },
                },
                include: {
                    caregiver: { select: { id: true, name: true } },
                },
            }),
            // Overrides activos del turno
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

        // === Colores esperados ===
        const expectedColorsSet = new Set<string>();
        for (const s of scheduledShifts) {
            if (s.colorGroup && s.colorGroup !== 'UNASSIGNED') expectedColorsSet.add(s.colorGroup);
        }
        const expectedColors = Array.from(expectedColorsSet).sort();

        // === Colores cubiertos ahora ===
        // Para cada ShiftSession activa, resolver su color efectivo:
        //   1. ShiftColorAssignment del día (userId → colors) →
        //   2. ScheduledShift.colorGroup del día para ese user →
        //   3. ninguno (cuidador en turno sin color asignado) → skip
        const activeUserIds = activeSessions.map(s => s.caregiverId);
        const colorAssignments = activeUserIds.length > 0
            ? await prisma.shiftColorAssignment.findMany({
                where: {
                    headquartersId: hqId,
                    userId: { in: activeUserIds },
                    assignedAt: { gte: todayStart },
                    scheduledShift: { shiftType: shiftType as any, date: { gte: todayStart, lt: tomorrow } },
                },
                select: { userId: true, color: true },
            })
            : [];

        const coveredByUser = new Map<string, Set<string>>();
        for (const a of colorAssignments) {
            if (!coveredByUser.has(a.userId)) coveredByUser.set(a.userId, new Set());
            coveredByUser.get(a.userId)!.add(a.color);
        }
        // Fallback: ScheduledShift.colorGroup de los usuarios que no tienen ShiftColorAssignment
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

        // === Colores ausentes ===
        const absentColors = expectedColors.filter(c => !coveredColorsSet.has(c));

        // === Colores ya redistribuidos ===
        const redistributedSet = new Set<string>();
        for (const ov of activeOverrides) {
            redistributedSet.add(ov.originalColor);
        }
        const alreadyRedistributed = absentColors.filter(c => redistributedSet.has(c)).sort();

        // === Residentes sin cobertura ===
        // De los colores ausentes, encontrar residentes ACTIVE en la sede
        // que NO tengan override activo.
        const overriddenPatientIds = new Set(activeOverrides.map(o => o.patientId));
        let uncoveredPatients: Array<{
            patientId: string;
            name: string;
            colorGroup: string;
            room: string | null;
            assignedTo: null;
        }> = [];

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

        const shiftStartUtc = canonicalShiftStartUtc(shiftType);
        const minutesSinceShiftStart = Math.max(
            0,
            Math.round((Date.now() - shiftStartUtc.getTime()) / 60000),
        );

        // redistributionNeeded: hay colores ausentes cuyos residentes aún
        // no tienen override (no basta con que haya ausentes; si ya están
        // todos redistribuidos, no se necesita acción).
        const redistributionNeeded = uncoveredPatients.length > 0;

        return NextResponse.json({
            success: true,
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
            redistributionNeeded,
            minutesSinceShiftStart,
            shiftStartUtc: shiftStartUtc.toISOString(),
            activeCaregiversCount: activeSessions.length,
        });
    } catch (error: any) {
        console.error('shift/coverage error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error calculando cobertura',
        }, { status: 500 });
    }
}
