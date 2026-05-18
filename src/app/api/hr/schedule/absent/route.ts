import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
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
 *   5. Crea ShiftPatientOverride por cada residente — idempotente
 *      (no crea si ya hay override activo del paciente para el turno)
 *   6. Notifica al cuidador receptor + roles supervisores
 *
 * Importante: NO se crea ShiftColorAssignment para los receptores. El
 * cuidador receptor mantiene su color base del Builder y recibe los
 * residentes adicionales vía override (el endpoint /api/care ya hace
 * el OR entre color propio + overrides activos).
 *
 * Antes: la redistribución creaba ShiftColorAssignment con el color del
 * ausente para los receptores, lo que sobreescribía su color base
 * (ej. Yeray BLUE → YELLOW). Eso rompía la UX y la lógica clínica.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const markedById = auth.id;
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

        // ── 4. Carga actual de cada cuidador activo ───────────────────
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
                return { shift: s, currentLoad: resCount, assigned: [] as typeof residents };
            })
        );

        // ── 5. Distribución equitativa (round-robin por carga ascendente) ──
        // Ordena de menor a mayor carga para que quien tiene menos reciba primero.
        caregiverLoads.sort((a, b) => a.currentLoad - b.currentLoad);
        residents.forEach((resident, i) => {
            caregiverLoads[i % caregiverLoads.length].assigned.push(resident);
        });

        // ── 6. ShiftPatientOverride por cuidador (idempotente) ─────────
        // NO crear ShiftColorAssignment: el color base del receptor lo da
        // ScheduledShift. Mover su color base sobreescribiría sus residentes
        // originales y rompería el flujo del piso.
        //
        // Idempotencia: si por alguna razón ya existe un override activo del
        // residente para el mismo shiftDate+shiftType, lo saltamos. Evita
        // duplicados si el endpoint se invoca dos veces o tras un crash.
        const dayStartForOv = new Date(shift.date);
        const dayEndForOv = new Date(dayStartForOv.getTime() + 24 * 3600000);
        await Promise.all(
            caregiverLoads
                .filter(c => c.assigned.length > 0)
                .map(async c => {
                    for (const p of c.assigned) {
                        const existing = await prisma.shiftPatientOverride.findFirst({
                            where: {
                                patientId: p.id,
                                shiftDate: { gte: dayStartForOv, lt: dayEndForOv },
                                shiftType: shift.shiftType,
                                isActive: true,
                            },
                            select: { id: true },
                        });
                        if (existing) continue;
                        await prisma.shiftPatientOverride.create({
                            data: {
                                headquartersId: hqId,
                                patientId: p.id,
                                originalColor: absentColorGroup,
                                assignedColor: c.shift.colorGroup || absentColorGroup,
                                caregiverId: c.shift.userId,
                                shiftDate: shift.date,
                                shiftType: shift.shiftType,
                                reason: 'ABSENCE_REDISTRIB',
                                autoAssigned: true,
                                isActive: true,
                            },
                        });
                    }
                })
        );

        // ── 7. Notificaciones individuales con lista de residentes ─────
        const absentName = shift.user?.name || 'Un cuidador';
        await Promise.all([
            // Notificar a cada cuidador con SUS residentes específicos
            ...caregiverLoads
                .filter(c => c.assigned.length > 0)
                .map(c => {
                    const names = c.assigned.map(p => p.name).join(', ');
                    return notifyUser(c.shift.userId, {
                        type: 'SHIFT_ALERT',
                        title: `Cobertura — Grupo ${absentColorGroup} (ausencia)`,
                        message: `${absentName} no se presentó. Se te asignaron ${c.assigned.length} residente${c.assigned.length === 1 ? '' : 's'} del Grupo ${absentColorGroup}: ${names}.`,
                        link: '/care'
                    });
                }),
            // Notificar a supervisores con el resumen completo
            notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'SHIFT_ALERT',
                title: `Ausencia — ${absentName} · Grupo ${absentColorGroup}`,
                message: `${residents.length} residente${residents.length === 1 ? '' : 's'} distribuidos equitativamente entre ${caregiverLoads.filter(c => c.assigned.length > 0).length} cuidador${caregiverLoads.filter(c => c.assigned.length > 0).length === 1 ? '' : 'es'}: ${caregiverLoads.filter(c => c.assigned.length > 0).map(c => `${c.shift.user?.name || '?'} (${c.assigned.length})`).join(', ')}.`,
                link: '/care/supervisor'
            })
        ]);

        const distributionSummary = caregiverLoads
            .filter(c => c.assigned.length > 0)
            .map(c => ({ caregiver: c.shift.user?.name, count: c.assigned.length, patients: c.assigned.map(p => p.name) }));

        return NextResponse.json({
            success: true,
            shift,
            absentColorGroup,
            residents,
            redistributionPending: false,
            redistributionCompleted: true,
            distribution: distributionSummary,
            residentsRedistributed: residents.length,
            message: `${residents.length} residente${residents.length === 1 ? '' : 's'} del Grupo ${absentColorGroup} distribuidos equitativamente entre ${distributionSummary.length} cuidador${distributionSummary.length === 1 ? '' : 'es'}.`
        });

    } catch (error: any) {
        logError('hr.schedule.absent.post', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error procesando ausencia' },
            { status: 500 }
        );
    }
}
