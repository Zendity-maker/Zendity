import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser, notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/uncovered-colors?hqId=X
 *
 * Detecta grupos de color del turno actual que no tienen cuidadora con sesión activa.
 * Retorna los grupos sin cobertura y las cuidadoras activas disponibles para redistribuir.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        const role = (session.user as any).role;
        if (!['SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ success: false, error: 'Acceso restringido' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId') || (session.user as any).headquartersId;

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);

        // Turno activo según hora PR
        const prHour = parseInt(
            new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico' })
                .format(new Date()), 10
        ) % 24;
        const activeShiftType = prHour >= 22 || prHour < 6 ? 'NIGHT' : prHour >= 14 ? 'EVENING' : 'MORNING';

        // Turnos programados para el turno activo de hoy (publicados, no ausentes)
        const scheduledShifts = await prisma.scheduledShift.findMany({
            where: {
                date: { gte: todayStart, lte: todayEnd },
                shiftType: activeShiftType,
                isAbsent: false,
                schedule: { headquartersId: hqId, status: 'PUBLISHED' },
                colorGroup: { not: null },
            },
            select: { userId: true, colorGroup: true, user: { select: { name: true } } }
        });

        // Cuidadoras con sesión activa ahora
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                actualEndTime: null,
                startTime: { gte: fourteenHrsAgo },
                caregiver: { headquartersId: hqId, role: 'CAREGIVER' }
            },
            select: { caregiverId: true, startTime: true, caregiver: { select: { name: true } } }
        });
        const activeIds = new Set(activeSessions.map(s => s.caregiverId));

        // Detectar colores sin sesión activa
        const uncoveredColors: { color: string; assignedCaregiverName: string; assignedCaregiver: string }[] = [];
        const seenColors = new Set<string>();

        for (const shift of scheduledShifts) {
            if (!shift.colorGroup || shift.colorGroup === 'ALL' || shift.colorGroup === 'UNASSIGNED') continue;
            if (seenColors.has(shift.colorGroup)) continue;
            seenColors.add(shift.colorGroup);

            if (!activeIds.has(shift.userId)) {
                uncoveredColors.push({
                    color: shift.colorGroup,
                    assignedCaregiver: shift.userId,
                    assignedCaregiverName: shift.user?.name || 'Desconocida',
                });
            }
        }

        // Cuidadoras activas con su color asignado (para mostrar quiénes pueden recibir)
        const activeCaregivers = activeSessions.map(s => ({
            id: s.caregiverId,
            name: s.caregiver?.name || 'Cuidadora',
        }));

        return NextResponse.json({ success: true, activeShiftType, uncoveredColors, activeCaregivers });

    } catch (err: any) {
        console.error('[uncovered-colors GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/care/supervisor/uncovered-colors
 *
 * Redistribuye los residentes de un color sin cobertura entre las cuidadoras activas.
 * Mismo mecanismo que la redistribución por ausencia.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        const role = (session.user as any).role;
        if (!['SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ success: false, error: 'Acceso restringido' }, { status: 403 });
        }

        const markedById = (session.user as any).id;
        const hqId = (session.user as any).headquartersId;
        const { color, shiftType } = await req.json();

        if (!color || !shiftType) {
            return NextResponse.json({ success: false, error: 'color y shiftType son requeridos' }, { status: 400 });
        }

        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

        // Residentes activos del grupo sin cobertura
        const residents = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE', colorGroup: color as any },
            select: { id: true, name: true, colorGroup: true }
        });

        if (residents.length === 0) {
            return NextResponse.json({ success: true, message: 'Sin residentes en este grupo', residentsRedistributed: 0 });
        }

        // Cuidadoras activas (con sesión abierta)
        const activeSessions = await prisma.shiftSession.findMany({
            where: {
                actualEndTime: null,
                startTime: { gte: fourteenHrsAgo },
                caregiver: { headquartersId: hqId, role: 'CAREGIVER' }
            },
            select: { id: true, caregiverId: true, caregiver: { select: { name: true } } }
        });

        if (activeSessions.length === 0) {
            return NextResponse.json({ success: false, error: 'No hay cuidadoras activas para redistribuir' }, { status: 400 });
        }

        // Color de cada cuidadora activa para calcular carga actual
        const activeIds = activeSessions.map(s => s.caregiverId);
        const colorAssignments = await prisma.shiftColorAssignment.findMany({
            where: { userId: { in: activeIds }, assignedAt: { gte: todayStart } },
            select: { userId: true, color: true },
            orderBy: { assignedAt: 'desc' }
        });
        const colorMap = new Map<string, string>();
        for (const ca of colorAssignments) {
            if (!colorMap.has(ca.userId)) colorMap.set(ca.userId, ca.color);
        }
        // Fallback a ScheduledShift de hoy
        const todayShifts = await prisma.scheduledShift.findMany({
            where: { userId: { in: activeIds }, date: { gte: todayStart }, isAbsent: false, schedule: { headquartersId: hqId, status: 'PUBLISHED' } },
            select: { userId: true, colorGroup: true },
        });
        for (const s of todayShifts) {
            if (!colorMap.has(s.userId) && s.colorGroup && s.colorGroup !== 'ALL') colorMap.set(s.userId, s.colorGroup);
        }

        // Calcular carga actual de cada cuidadora activa
        const caregiverLoads = await Promise.all(
            activeSessions.map(async s => {
                const baseColor = colorMap.get(s.caregiverId);
                const colorsToCount = baseColor ? [baseColor] : [];

                // Sumar residentes de overrides activos de hoy
                const overrideCount = await prisma.shiftPatientOverride.count({
                    where: { caregiverId: s.caregiverId, isActive: true, shiftDate: { gte: todayStart } }
                });

                const baseCount = colorsToCount.length > 0
                    ? await prisma.patient.count({ where: { headquartersId: hqId, status: 'ACTIVE', colorGroup: { in: colorsToCount as any[] } } })
                    : 0;

                return { session: s, currentLoad: baseCount + overrideCount, assigned: [] as typeof residents };
            })
        );

        // Distribución equitativa round-robin por carga ascendente
        caregiverLoads.sort((a, b) => a.currentLoad - b.currentLoad);
        residents.forEach((resident, i) => {
            caregiverLoads[i % caregiverLoads.length].assigned.push(resident);
        });

        // Crear ShiftPatientOverride + ShiftColorAssignment por cuidadora
        const shiftDate = new Date(); shiftDate.setHours(0, 0, 0, 0);

        await Promise.all(
            caregiverLoads
                .filter(c => c.assigned.length > 0)
                .map(async c => {
                    await prisma.shiftPatientOverride.createMany({
                        data: c.assigned.map(p => ({
                            headquartersId: hqId,
                            patientId: p.id,
                            originalColor: color,
                            assignedColor: colorMap.get(c.session.caregiverId) || color,
                            caregiverId: c.session.caregiverId,
                            shiftDate,
                            shiftType,
                            reason: 'ABSENCE_REDISTRIB',
                            autoAssigned: true,
                            isActive: true,
                        }))
                    });
                    await prisma.shiftColorAssignment.create({
                        data: {
                            headquartersId: hqId,
                            scheduledShiftId: (await prisma.scheduledShift.findFirst({
                                where: { userId: c.session.caregiverId, date: { gte: shiftDate }, schedule: { headquartersId: hqId, status: 'PUBLISHED' } },
                                select: { id: true }
                            }))?.id || c.session.id,
                            color,
                            userId: c.session.caregiverId,
                            assignedBy: markedById,
                            isAutoAssigned: true,
                            assignedAt: new Date()
                        }
                    });
                })
        );

        // Notificaciones
        const colorLabels: Record<string, string> = { RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde' };
        await Promise.all([
            ...caregiverLoads.filter(c => c.assigned.length > 0).map(c =>
                notifyUser(c.session.caregiverId, {
                    type: 'SHIFT_ALERT',
                    title: `Cobertura adicional — Grupo ${colorLabels[color] || color}`,
                    message: `Se te asignaron ${c.assigned.length} residente${c.assigned.length === 1 ? '' : 's'} del Grupo ${colorLabels[color] || color} (sin cuidadora en piso): ${c.assigned.map(p => p.name).join(', ')}.`,
                    link: '/care'
                })
            ),
            notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'SHIFT_ALERT',
                title: `Grupo ${colorLabels[color] || color} redistribuido — sin cobertura`,
                message: `${residents.length} residente${residents.length === 1 ? '' : 's'} distribuidos entre ${caregiverLoads.filter(c => c.assigned.length > 0).length} cuidadora${caregiverLoads.filter(c => c.assigned.length > 0).length === 1 ? '' : 's'}: ${caregiverLoads.filter(c => c.assigned.length > 0).map(c => `${c.session.caregiver?.name} (${c.assigned.length})`).join(', ')}.`,
                link: '/care/supervisor'
            })
        ]);

        const distribution = caregiverLoads
            .filter(c => c.assigned.length > 0)
            .map(c => ({ caregiver: c.session.caregiver?.name, count: c.assigned.length }));

        return NextResponse.json({
            success: true,
            residentsRedistributed: residents.length,
            distribution,
            message: `${residents.length} residente${residents.length === 1 ? '' : 's'} del Grupo ${colorLabels[color] || color} distribuidos entre ${distribution.length} cuidadora${distribution.length === 1 ? '' : 's'}.`
        });

    } catch (err: any) {
        console.error('[uncovered-colors POST]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
