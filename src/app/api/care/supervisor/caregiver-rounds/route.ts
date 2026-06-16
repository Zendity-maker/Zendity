import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { clinicalDayCalendarUTCRange } from '@/lib/dates';
import {
    inferShiftTypeFromAST,
    resolveCaregiverColors,
    ACTIVE_PRESENCE_MAX_HOURS,
} from '@/lib/shift-coverage';
import {
    parseColorFloorMap,
    floorsForCaregiver,
    hasUnmappedFloor,
    floorOfPatient,
    hasFloorsConfigured,
} from '@/lib/floor-map';
import { logError } from '@/lib/logger';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/caregiver-rounds?hqId=X
 *
 * Retorna el progreso de rondas de TODOS los cuidadores con sesión activa.
 * Una "ronda" = registrar al menos 1 atención a cada residente de su grupo de color.
 *
 * En guardia nocturna: rotaciones posturales + notas de ronda nocturna cuentan.
 * En turno diurno: rotaciones + baños + comidas + notas diarias.
 *
 * Por cuidador retorna:
 *   caregiverId, name, colorGroup
 *   roundsCompleted       — rondas completas desde que inició el turno
 *   residentsInGroup      — total residentes del grupo
 *   attendedThisRound     — residentes atendidos en la ronda en curso
 *   remainingThisRound    — pendientes para completar la ronda actual
 *   pendingResidents      — nombres + habitación de los pendientes
 *   minutesSinceLastRound — minutos desde la última ronda completa (null si ninguna)
 *   isNightShift          — true si hora actual es 10pm–6am
 *   shiftStartedAt        — cuándo inició la sesión activa
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const role = (session.user as any).role;
        if (!SUPERVISOR_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Acceso restringido a supervisores' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get('hqId');
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message }, { status: 400 });
        }

        // Sesiones activas de cuidadores — cap UNIFICADO de presencia
        // (ACTIVE_PRESENCE_MAX_HOURS = 16h, ver lib/shift-coverage).
        // Antes este endpoint usaba 14h inline. Alineado al cap unificado
        // para que la misma cuidadora que aparece en isSoloCaregiver, en
        // /api/care (solo-mode) y aquí coincida — el supervisor ve el
        // mismo conjunto que el resolver de la tablet.
        //
        // FASE 51 — aceptar primary OR secondaryRoles para dual-rol
        // (ej. Mariangelie SUPERVISOR + secondary CAREGIVER).
        const presenceCap = new Date(Date.now() - ACTIVE_PRESENCE_MAX_HOURS * 60 * 60 * 1000);
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                actualEndTime: null,
                startTime: { gte: presenceCap },
                caregiver: {
                    headquartersId: hqId,
                    OR: [
                        { role: 'CAREGIVER' },
                        { secondaryRoles: { has: 'CAREGIVER' } },
                    ],
                },
            },
            select: {
                id: true,
                caregiverId: true,
                startTime: true,
                caregiver: { select: { name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        // Sprint floor-map — cargar mapa color→piso del HQ una sola vez.
        // Multi-tenant strict: SOLO el map de ESTE hqId; el de Cupey nunca
        // toca a Mayagüez. Parser defensivo: map null/vacío/malformado =>
        // comportamiento legacy (un solo piso, sin secciones).
        const hqRow = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { colorFloorMap: true },
        });
        const colorFloorMap = parseColorFloorMap(hqRow?.colorFloorMap);
        const floorsConfigured = hasFloorsConfigured(colorFloorMap);

        if (activeSessions.length === 0) {
            return NextResponse.json({
                success: true,
                caregivers: [],
                floorsConfigured,
                activeFloors: [],
                unassignedFloorPatientsCount: 0,
            });
        }

        const caregiverIds = activeSessions.map(s => s.caregiverId);
        const scheduledDayRange = clinicalDayCalendarUTCRange();
        const currentShiftType = inferShiftTypeFromAST();

        // Resolver color de TODOS los cuidadores activos vía el chokepoint
        // consolidado (D1 unión + D2 ventana + D3 boundaries + D4 fallback).
        //
        // Cambios funcionales vs. legacy de este archivo:
        //   D1 UNIÓN: antes este endpoint tomaba EL PRIMER color encontrado
        //             entre (assignments, roster, fallback). Si Medelyn
        //             tenía base BLUE + ColorAssignment YELLOW, el wall la
        //             mostraba SOLO como YELLOW. Ahora retorna ['BLUE','YELLOW']
        //             y el wall las muestra ambos.
        //   D2 VENTANA: antes filtraba `shiftType: currentShiftType` (bucket
        //              único EVENING/MORNING/NIGHT). Pautas FULL_DAY/FULL_NIGHT
        //              caían al fallback aunque su ventana cubriera la hora
        //              actual. Ahora `compatibleShiftTypesAt(at)` las incluye.
        //   D4 FALLBACK: explícito vía flag (ON aquí — sin él, una cuidadora
        //                en overtime aparece sin color en el wall y rompe
        //                el cálculo de rondas).
        const colorsByUser = await resolveCaregiverColors({
            mode: 'batch',
            caregiverIds,
            hqId,
            overtimeFallback: true,
        });

        // FASE 82: shift base de HOY por cuidadora activa — para que la UI del
        // wall sepa qué scheduledShiftId liberar via /release-shift y muestre
        // el indicador "Pauta liberada" si releasedAt != null. Trae también
        // releasedAt para condicionar el botón "Liberar" vs "Reactivar".
        const baseShifts = await prisma.scheduledShift.findMany({
            where: {
                userId: { in: caregiverIds },
                date: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                schedule: { headquartersId: hqId, status: 'PUBLISHED' },
                isAbsent: false,
            },
            select: {
                id: true,
                userId: true,
                colorGroup: true,
                shiftType: true,
                releasedAt: true,
            },
            // Si una cuidadora tiene 2 shifts (FULL_DAY + MORNING), priorizamos
            // el de mayor relevancia para el shift actual.
            orderBy: [{ shiftType: 'asc' }, { date: 'desc' }],
        });
        const baseShiftByUser = new Map<string, typeof baseShifts[number]>();
        for (const s of baseShifts) {
            if (!baseShiftByUser.has(s.userId)) baseShiftByUser.set(s.userId, s);
        }

        // Residentes ACTIVE — pedimos TODOS los colores que aparecen en CUALQUIER
        // cuidadora activa (unión global). Si alguna tiene 'ALL', traemos
        // todos los residentes ACTIVE de la sede.
        const allColorsUnion = new Set<string>();
        for (const colors of colorsByUser.values()) {
            for (const c of colors) allColorsUnion.add(c);
        }
        const hasAll = allColorsUnion.has('ALL');
        const distinctColors = [...allColorsUnion].filter(c => c !== 'ALL');
        const allGroupPatients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: 'ACTIVE',
                ...(hasAll ? {} : { colorGroup: { in: distinctColors as any[] } })
            },
            select: { id: true, name: true, roomNumber: true, colorGroup: true },
            orderBy: { roomNumber: 'asc' }
        });

        const isNightShift = currentShiftType === 'NIGHT';

        const now = new Date();

        // Cobertura adicional por overrides activos. Cada cuidadora puede tener
        // residentes EXTRA por redistribución (su color base + residentes de
        // otro color asignados vía ShiftPatientOverride). Para el panel del
        // supervisor mostramos el desglose.
        const activeOverrides = await prisma.shiftPatientOverride.findMany({
            where: {
                headquartersId: hqId,
                caregiverId: { in: caregiverIds },
                isActive: true,
                shiftDate: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
                shiftType: currentShiftType,
            },
            include: {
                patient: { select: { id: true, name: true, roomNumber: true } },
            },
        });
        // Agrupar por caregiverId → lista de coberturas { patientId, name, room, originalColor }.
        //
        // FIX (2026-06-14): saltar overrides REDUNDANTES — aquellos cuyo
        // `originalColor` ya está en los colores base de la cuidadora (vía
        // pauta o ColorAssignment, expuestos por colorsByUser). Caso real:
        // el supervisor presiona "Redistribuir RED" en la alerta de uncovered
        // → crea overrides sobre la cuidadora que YA tiene RED como base. Sin
        // este filtro, el wall mostraba "groupPatients=6 + coverageCount=6"
        // para los MISMOS 6 residentes — doble cuenta + chip "+6 rojos" en su
        // tile. La cuidadora con 'ALL' como base nunca tiene cobertura extra.
        const coverageByCaregiver = new Map<string, Array<{ patientId: string; name: string; room: string | null; originalColor: string }>>();
        let skippedRedundantOverrides = 0;
        for (const ov of activeOverrides) {
            const baseColors = new Set(colorsByUser.get(ov.caregiverId) || []);
            if (baseColors.has('ALL') || baseColors.has(ov.originalColor)) {
                skippedRedundantOverrides++;
                continue;
            }
            if (!coverageByCaregiver.has(ov.caregiverId)) coverageByCaregiver.set(ov.caregiverId, []);
            coverageByCaregiver.get(ov.caregiverId)!.push({
                patientId: ov.patientId,
                name: ov.patient?.name || 'Residente',
                room: ov.patient?.roomNumber ?? null,
                originalColor: ov.originalColor,
            });
        }
        if (skippedRedundantOverrides > 0) {
            console.warn('[caregiver-rounds] skipped redundant overrides (originalColor ∈ base):', skippedRedundantOverrides);
        }

        // Batch query refactor: en lugar de N×5 queries (1 set por cuidadora dentro
        // del Promise.all del map), se hacen 5 queries globales que traen TODOS los
        // touches de TODOS los cuidadores activos desde el shiftStart más antiguo,
        // y se agrupan en memoria por caregiverId. Reduce ~85% de queries con 5
        // cuidadoras en piso.
        const minShiftStart = activeSessions.reduce<Date>(
            (min, s) => (s.startTime < min ? s.startTime : min),
            activeSessions[0].startTime
        );
        const allPatientIds = allGroupPatients.map(p => p.id);

        type Touch = { patientId: string; at: Date };
        const rotationsByCg = new Map<string, Touch[]>();
        const bathsByCg = new Map<string, Touch[]>();
        const mealsByCg = new Map<string, Touch[]>();
        const dailyLogsByCg = new Map<string, Touch[]>();
        const nightRoundNotesByCg = new Map<string, Touch[]>();
        const dayDiapersByCg = new Map<string, Touch[]>();

        // Solo 5 queries globales en paralelo. Selección y filtrado por shiftStart
        // individual + groupIds del cuidador se hacen en memoria después.
        const queries: Array<Promise<any>> = [
            prisma.posturalChangeLog.findMany({
                where: { nurseId: { in: caregiverIds }, patientId: { in: allPatientIds }, performedAt: { gte: minShiftStart } },
                select: { nurseId: true, patientId: true, performedAt: true },
            }),
            prisma.dailyLog.findMany({
                where: { authorId: { in: caregiverIds }, patientId: { in: allPatientIds }, createdAt: { gte: minShiftStart } },
                select: { authorId: true, patientId: true, createdAt: true, notes: true },
            }),
        ];
        if (!isNightShift) {
            queries.push(
                prisma.bathLog.findMany({
                    where: { caregiverId: { in: caregiverIds }, patientId: { in: allPatientIds }, timeLogged: { gte: minShiftStart } },
                    select: { caregiverId: true, patientId: true, timeLogged: true },
                }),
                prisma.mealLog.findMany({
                    where: { caregiverId: { in: caregiverIds }, patientId: { in: allPatientIds }, timeLogged: { gte: minShiftStart } },
                    select: { caregiverId: true, patientId: true, timeLogged: true },
                }),
                prisma.clinicalNote.findMany({
                    where: {
                        authorId: { in: caregiverIds },
                        patientId: { in: allPatientIds },
                        createdAt: { gte: minShiftStart },
                        content: { contains: '[CAMBIO PAÑAL DIURNO ZENDI]' },
                    },
                    select: { authorId: true, patientId: true, createdAt: true },
                }),
            );
        }
        const results = await Promise.all(queries);
        const allRotations = results[0] as Array<{ nurseId: string; patientId: string; performedAt: Date }>;
        const allDailyLogs = results[1] as Array<{ authorId: string; patientId: string; createdAt: Date; notes: string | null }>;
        const allBaths = (results[2] || []) as Array<{ caregiverId: string; patientId: string; timeLogged: Date }>;
        const allMeals = (results[3] || []) as Array<{ caregiverId: string; patientId: string; timeLogged: Date }>;
        const allDiapers = (results[4] || []) as Array<{ authorId: string; patientId: string; createdAt: Date }>;

        // Agrupar por caregiverId
        const pushTouch = (map: Map<string, Touch[]>, cgId: string, t: Touch) => {
            const arr = map.get(cgId);
            if (arr) arr.push(t); else map.set(cgId, [t]);
        };
        for (const r of allRotations) pushTouch(rotationsByCg, r.nurseId, { patientId: r.patientId, at: r.performedAt });
        for (const r of allDailyLogs) {
            const touch: Touch = { patientId: r.patientId, at: r.createdAt };
            pushTouch(dailyLogsByCg, r.authorId, touch);
            if (isNightShift && r.notes?.includes('[RONDA NOCTURNA')) {
                pushTouch(nightRoundNotesByCg, r.authorId, touch);
            }
        }
        for (const r of allBaths) pushTouch(bathsByCg, r.caregiverId, { patientId: r.patientId, at: r.timeLogged });
        for (const r of allMeals) pushTouch(mealsByCg, r.caregiverId, { patientId: r.patientId, at: r.timeLogged });
        for (const r of allDiapers) pushTouch(dayDiapersByCg, r.authorId, { patientId: r.patientId, at: r.createdAt });

        // Por cuidadora: filtrar por shiftStart individual + groupIds + construir allTouches
        const caregiverResults = activeSessions.map((sess) => {
            const caregiverId = sess.caregiverId;
            const name = sess.caregiver?.name || 'Cuidador';
            const shiftStart = sess.startTime;
            const shiftStartMs = shiftStart.getTime();
            // D1 — `colorGroups` es la UNIÓN; `colorGroup` queda como compat
            // (primer color, para consumidores que aún leen el campo singular).
            const colorGroups = colorsByUser.get(caregiverId) ?? [];
            const colorGroup = colorGroups[0] ?? null;

            // Cobertura adicional: residentes extra por override (otro color)
            const coverageResidents = coverageByCaregiver.get(caregiverId) || [];
            const coverageCount = coverageResidents.length;
            const coverageByColor: Record<string, number> = {};
            for (const c of coverageResidents) {
                coverageByColor[c.originalColor] = (coverageByColor[c.originalColor] || 0) + 1;
            }

            // FASE 82: info del shift base para feature "liberar pauta"
            const bs = baseShiftByUser.get(caregiverId);
            const baseShift = bs ? {
                id: bs.id,
                colorGroup: bs.colorGroup,
                shiftType: bs.shiftType,
                releasedAt: bs.releasedAt,
            } : null;

            // Sprint floor-map — pisos derivados de los colores del turno.
            // Una cuidadora puede tener 1+ pisos si su pauta mezcla colores
            // mapeados a distintos pisos (raro pero válido).
            // `hasUnmappedFloor` señala color sin mapear → la UI lo agrupa
            // bajo el sentinel ámbar.
            const floors = floorsForCaregiver(colorGroups, colorFloorMap);
            const cgHasUnmappedFloor = hasUnmappedFloor(colorGroups, colorFloorMap);

            if (colorGroups.length === 0) {
                return {
                    caregiverId, name,
                    colorGroup: null,
                    colorGroups: [] as string[],
                    floors: [] as string[],
                    hasUnmappedFloor: false,
                    noColorGroup: true,
                    roundsCompleted: 0, residentsInGroup: 0,
                    attendedThisRound: 0, remainingThisRound: 0,
                    pendingResidents: [], minutesSinceLastRound: null,
                    isNightShift, shiftStartedAt: shiftStart,
                    coverageCount, coverageByColor, coverageResidents,
                    baseShift,
                };
            }

            // groupPatients — D1: residentes de TODOS los colores de la cuidadora
            // (no solo el primero). 'ALL' barre la sede entera.
            const colorGroupsSet = new Set(colorGroups);
            const groupPatients = colorGroupsSet.has('ALL')
                ? allGroupPatients
                : allGroupPatients.filter(p => p.colorGroup && colorGroupsSet.has(p.colorGroup));
            const groupSize = groupPatients.length;

            if (groupSize === 0) {
                return {
                    caregiverId, name,
                    colorGroup,
                    colorGroups,
                    floors,
                    hasUnmappedFloor: cgHasUnmappedFloor,
                    emptyGroup: true,
                    roundsCompleted: 0, residentsInGroup: 0,
                    attendedThisRound: 0, remainingThisRound: 0,
                    pendingResidents: [], minutesSinceLastRound: null,
                    isNightShift, shiftStartedAt: shiftStart,
                    coverageCount, coverageByColor, coverageResidents,
                    baseShift,
                };
            }

            const groupIds = groupPatients.map(p => p.id);
            const groupIdsSet = new Set(groupIds);

            // Filtra touches del cuidador por shiftStart individual + groupIds
            const filterTouches = (touches: Touch[] | undefined): Touch[] =>
                (touches || []).filter(t => t.at.getTime() >= shiftStartMs && groupIdsSet.has(t.patientId));

            let allTouches: Touch[];
            if (isNightShift) {
                allTouches = [
                    ...filterTouches(rotationsByCg.get(caregiverId)),
                    ...filterTouches(nightRoundNotesByCg.get(caregiverId)),
                ];
            } else {
                allTouches = [
                    ...filterTouches(rotationsByCg.get(caregiverId)),
                    ...filterTouches(bathsByCg.get(caregiverId)),
                    ...filterTouches(mealsByCg.get(caregiverId)),
                    ...filterTouches(dailyLogsByCg.get(caregiverId)),
                    ...filterTouches(dayDiapersByCg.get(caregiverId)),
                ];
            }
            allTouches.sort((a, b) => a.at.getTime() - b.at.getTime());

            return {
                ...computeRoundStats({ caregiverId, name, colorGroup: colorGroup!, groupSize, groupPatients, groupIds, allTouches, isNightShift, shiftStart, now }),
                colorGroups,        // NUEVO (D1): la unión completa
                floors,             // floor-map: pisos derivados del HQ map
                hasUnmappedFloor: cgHasUnmappedFloor,
                coverageCount,
                coverageByColor,
                coverageResidents,
                baseShift,          // FASE 82: para feature "liberar pauta"
            };
        });

        // floor-map: pisos con cuidadoras activas hoy (unión global) +
        // residentes activos cuyo colorGroup NO mapea a un piso (UNASSIGNED
        // o color sin entrada en el map). Estos caen al sentinel ámbar.
        const activeFloorsSet = new Set<string>();
        for (const cg of caregiverResults) {
            for (const f of cg.floors || []) activeFloorsSet.add(f);
        }
        const activeFloors = Array.from(activeFloorsSet).sort();
        const unassignedFloorPatientsCount = floorsConfigured
            ? allGroupPatients.filter(p => floorOfPatient(p, colorFloorMap) === null).length
            : 0;

        return NextResponse.json({
            success: true,
            isNightShift,
            caregivers: caregiverResults,
            floorsConfigured,
            activeFloors,
            unassignedFloorPatientsCount,
        });

    } catch (err: any) {
        logError('care.supervisor.caregiver_rounds.get', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

function computeRoundStats({
    caregiverId, name, colorGroup, groupSize, groupPatients, groupIds, allTouches, isNightShift, shiftStart, now
}: {
    caregiverId: string; name: string; colorGroup: string;
    groupSize: number; groupPatients: { id: string; name: string; roomNumber: string | null }[];
    groupIds: string[]; allTouches: { patientId: string; at: Date }[];
    isNightShift: boolean; shiftStart: Date; now: Date;
}) {
    let roundsCompleted = 0;
    let roundCompletedAt: Date | null = null;
    const seenInCurrentRound = new Set<string>();

    for (const touch of allTouches) {
        seenInCurrentRound.add(touch.patientId);
        if (seenInCurrentRound.size === groupSize) {
            roundsCompleted++;
            roundCompletedAt = touch.at;
            seenInCurrentRound.clear();
        }
    }

    const attendedThisRound = seenInCurrentRound.size;
    const remainingThisRound = groupSize - attendedThisRound;
    const pendingIds = new Set(groupIds.filter(id => !seenInCurrentRound.has(id)));
    const pendingResidents = groupPatients
        .filter(p => pendingIds.has(p.id))
        .map(p => ({ name: p.name.split(' ')[0], room: p.roomNumber || '—' }));

    const minutesSinceLastRound = roundCompletedAt
        ? Math.round((now.getTime() - roundCompletedAt.getTime()) / 60000)
        : null;

    return {
        caregiverId, name, colorGroup,
        roundsCompleted,
        residentsInGroup: groupSize,
        attendedThisRound,
        remainingThisRound,
        pendingResidents,
        minutesSinceLastRound,
        isNightShift,
        shiftStartedAt: shiftStart,
    };
}
