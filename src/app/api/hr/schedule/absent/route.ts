import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser, notifyRoles } from '@/lib/notifications';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * POST /api/hr/schedule/absent
 *
 * Flujo completo en 1 paso (server-side):
 *   1. Auth gate — solo SUPERVISOR/DIRECTOR/ADMIN
 *   2. Marca ScheduledShift.isAbsent = true
 *   3. Detecta residentes del color del ausente
 *   4. Selecciona cuidador receptor (menor carga activa)
 *   5. Crea ShiftPatientOverride por cada residente
 *   6. Crea ShiftColorAssignment en el turno receptor
 *      (para que computeShiftCoverage lo detecte)
 *   7. Notifica al cuidador receptor + roles supervisores
 *
 * Antes: la redistribución dependía de un setInterval del browser
 * con 15 min, que se perdía al cerrar el tab y usaba el ID de turno
 * incorrecto. Ahora es atómica y server-side.
 */
export async function POST(req: Request) {
    try {
        // ── Auth ──────────────────────────────────────────────────────
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json(
                { success: false, error: 'Solo supervisores pueden marcar ausencias' },
                { status: 403 }
            );
        }

        const markedById = session.user.id;
        const { scheduledShiftId, hqId } = await req.json();

        if (!scheduledShiftId || !hqId) {
            return NextResponse.json({ success: false, error: 'scheduledShiftId y hqId son requeridos' }, { status: 400 });
        }

        // ── 1. Marcar ausente ─────────────────────────────────────────
        const shift = await prisma.scheduledShift.update({
            where: { id: scheduledShiftId },
            data: { isAbsent: true, absentMarkedAt: new Date(), absentMarkedById: markedById },
            include: { user: { select: { id: true, name: true } } }
        });

        const absentColorGroup = shift.colorGroup;

        // ── Caso especial: ALL / sin color (ej. turnos nocturnos) ─────
        if (!absentColorGroup || absentColorGroup === 'ALL' || absentColorGroup === 'UNASSIGNED') {
            const activeShifts = await prisma.scheduledShift.findMany({
                where: {
                    scheduleId: shift.scheduleId,
                    date: shift.date,
                    shiftType: shift.shiftType,
                    isAbsent: false,
                    id: { not: scheduledShiftId }
                },
                include: { user: { select: { id: true, name: true } } }
            });
            return NextResponse.json({
                success: true,
                shift,
                absentColorGroup,
                activeShifts,
                redistributionPending: true,
                redistributionCompleted: false,
                message: `Turno ${absentColorGroup || 'sin color'} — redistribución manual requerida`
            });
        }

        // ── 2. Residentes del color del ausente ───────────────────────
        const residents = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE', colorGroup: absentColorGroup as any },
            select: { id: true, name: true, colorGroup: true }
        });

        // ── 3. Cuidadores activos del mismo turno ─────────────────────
        const activeShifts = await prisma.scheduledShift.findMany({
            where: {
                scheduleId: shift.scheduleId,
                date: shift.date,
                shiftType: shift.shiftType,
                isAbsent: false,
                id: { not: scheduledShiftId }
            },
            include: {
                user: { select: { id: true, name: true } },
                colorAssignments: { select: { color: true } }
            }
        });

        // Sin cuidadores disponibles o sin residentes → solo marcar ausente
        if (activeShifts.length === 0 || residents.length === 0) {
            return NextResponse.json({
                success: true,
                shift,
                absentColorGroup,
                residents,
                activeShifts: [],
                redistributionPending: false,
                redistributionCompleted: false,
                message: residents.length === 0
                    ? 'Sin residentes que redistribuir en este grupo'
                    : 'Sin cuidadores activos para redistribuir'
            });
        }

        // ── 4. Algoritmo de menor carga ───────────────────────────────
        const caregiverLoads = await Promise.all(
            activeShifts.map(async s => {
                const assignedColors = s.colorAssignments.map(a => a.color);
                const colorsToCount = assignedColors.length > 0
                    ? assignedColors
                    : (s.colorGroup && s.colorGroup !== 'ALL' ? [s.colorGroup] : []);
                const resCount = colorsToCount.length > 0
                    ? await prisma.patient.count({
                        where: {
                            headquartersId: hqId,
                            status: 'ACTIVE',
                            colorGroup: { in: colorsToCount as any[] }
                        }
                    })
                    : 0;
                return { shift: s, currentLoad: resCount };
            })
        );
        const targetLoad = caregiverLoads.sort((a, b) => a.currentLoad - b.currentLoad)[0];
        const targetShift = targetLoad.shift;

        // ── 5. ShiftPatientOverride por cada residente ─────────────────
        await prisma.shiftPatientOverride.createMany({
            data: residents.map(p => ({
                headquartersId: hqId,
                patientId: p.id,
                originalColor: absentColorGroup,
                assignedColor: targetShift.colorGroup || absentColorGroup,
                caregiverId: targetShift.userId,
                shiftDate: shift.date,
                shiftType: shift.shiftType,
                reason: 'ABSENCE_REDISTRIB',
                autoAssigned: true,
                isActive: true,
            }))
        });

        // ── 6. ShiftColorAssignment en el turno receptor ───────────────
        // Necesario para que computeShiftCoverage detecte el color cubierto.
        await prisma.shiftColorAssignment.create({
            data: {
                headquartersId: hqId,
                scheduledShiftId: targetShift.id,
                color: absentColorGroup,
                userId: targetShift.userId,
                assignedBy: markedById,
                isAutoAssigned: true,
                assignedAt: new Date()
            }
        });

        // ── 7. Notificaciones ─────────────────────────────────────────
        await Promise.all([
            notifyUser(targetShift.userId, {
                type: 'SHIFT_ALERT',
                title: `Redistribución — Grupo ${absentColorGroup}`,
                message: `${shift.user?.name || 'Un cuidador'} no se presentó. Se te asignó el Grupo ${absentColorGroup} (${residents.length} residente${residents.length === 1 ? '' : 's'}).`
            }),
            notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'SHIFT_ALERT',
                title: `Ausencia — ${shift.user?.name || 'Cuidador'}`,
                message: `Grupo ${absentColorGroup} redistribuido automáticamente a ${targetShift.user?.name || 'cuidador disponible'} (${residents.length} residente${residents.length === 1 ? '' : 's'}).`
            })
        ]);

        return NextResponse.json({
            success: true,
            shift,
            absentColorGroup,
            residents,
            activeShifts: caregiverLoads,
            suggestedAssignee: targetShift.user,
            redistributionPending: false,
            redistributionCompleted: true,
            assignedTo: targetShift.user?.name,
            residentsRedistributed: residents.length,
            message: `${residents.length} residente${residents.length === 1 ? '' : 's'} del Grupo ${absentColorGroup} redistribuido${residents.length === 1 ? '' : 's'} automáticamente a ${targetShift.user?.name || 'cuidador disponible'}.`
        });

    } catch (error: any) {
        console.error('[absent] error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error procesando ausencia' },
            { status: 500 }
        );
    }
}
