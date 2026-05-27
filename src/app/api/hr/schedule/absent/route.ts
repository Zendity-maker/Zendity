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

        // ── 1b. PATRÓN DE AUSENCIAS — detección automática ──────────────
        // Si el empleado acumula ABSENCE_THRESHOLD ausencias en los últimos
        // ABSENCE_WINDOW_DAYS días, generamos un IncidentReport severidad
        // WARNING que dispara el flujo estándar de explicación de 72h
        // (cron apply-pending-observations). Si no responde → APPLIED con
        // -5 puntos sobre complianceScore. Esto cierra el gap "marqué
        // ausente pero el score no cambia": una ausencia esporádica no
        // penaliza, pero el patrón crónico sí — proporcional y justo.
        //
        // Idempotente: marca [AUSENCIA_PATRON] en description + lookup
        // dedup. No se crean incidentes duplicados en la misma ventana.
        const ABSENCE_WINDOW_DAYS = 30;
        const ABSENCE_THRESHOLD = 3;
        const ABSENCE_MARKER = '[AUSENCIA_PATRON]';
        let patternIncident: { id: string; absenceCount: number } | null = null;
        try {
            const windowStart = new Date(Date.now() - ABSENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
            const employeeId = shift.userId;
            const absenceCount = await prisma.scheduledShift.count({
                where: {
                    userId: employeeId,
                    isAbsent: true,
                    date: { gte: windowStart },
                },
            });
            if (absenceCount >= ABSENCE_THRESHOLD) {
                const existing = await prisma.incidentReport.findFirst({
                    where: {
                        employeeId,
                        headquartersId: hqId,
                        description: { contains: ABSENCE_MARKER },
                        status: { in: ['DRAFT', 'NOTIFIED', 'PENDING_EXPLANATION', 'EXPLANATION_RECEIVED', 'APPLIED'] as any[] },
                        createdAt: { gte: windowStart },
                    },
                    select: { id: true },
                });
                if (!existing) {
                    const empName = shift.user?.name || 'empleado';
                    const created = await prisma.incidentReport.create({
                        data: {
                            employeeId,
                            supervisorId: markedById,
                            headquartersId: hqId,
                            type: 'WARNING', // legacy field, mantenido por compatibilidad
                            severity: 'WARNING' as any,
                            category: 'PUNCTUALITY' as any,
                            status: 'PENDING_EXPLANATION' as any,
                            description: `${ABSENCE_MARKER} Patrón de ausencias detectado automáticamente por el sistema: ${absenceCount} ausencias en los últimos ${ABSENCE_WINDOW_DAYS} días. Se generó esta observación al cruzar el umbral de ${ABSENCE_THRESHOLD} ausencias en la ventana. Por favor explique las circunstancias en las próximas 72 horas; de lo contrario se aplicará automáticamente con -5 puntos al compliance score.`,
                            visibleToEmployee: true,
                        },
                        select: { id: true },
                    });
                    patternIncident = { id: created.id, absenceCount };
                    // Notificar al empleado y a los supervisores
                    await Promise.all([
                        notifyUser(employeeId, {
                            type: 'EMAR_ALERT',
                            title: 'Observación: patrón de ausencias',
                            message: `Se detectó un patrón de ${absenceCount} ausencias en ${ABSENCE_WINDOW_DAYS} días. Tienes 72h para explicar las circunstancias antes de que se aplique automáticamente.`,
                            link: `/my-observations/${created.id}`,
                        }),
                        notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                            type: 'EMAR_ALERT',
                            title: `Patrón de ausencias — ${empName}`,
                            message: `${empName} acumula ${absenceCount} ausencias en ${ABSENCE_WINDOW_DAYS}d. Sistema generó observación WARNING (PENDING_EXPLANATION).`,
                            link: `/hr/audit/${employeeId}`,
                        }),
                    ]);
                }
            }
        } catch (e) {
            // La detección no debe bloquear el marcado de ausencia ni la
            // redistribución. Log + seguimos.
            logError('hr.schedule.absent.pattern_detection', e);
        }

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
                patternIncident,
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
                patternIncident,
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
                // `assigned`: residentes que el round-robin le tocó (intención).
                // `created`:  residentes que efectivamente recibieron un override
                //             NUEVO (no saltado por idempotencia). Las
                //             notificaciones, summary y contador deben usar
                //             `created`, no `assigned`, para no decir "se te
                //             asignaron 9 residentes" cuando 8 ya estaban
                //             cubiertos vía override previo.
                return { shift: s, currentLoad: resCount, assigned: [] as typeof residents, created: [] as typeof residents };
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
                        // Sólo aquí (override real creado) lo registramos
                        // para notificaciones y summary.
                        c.created.push(p);
                    }
                })
        );

        const totalCreated = caregiverLoads.reduce((sum, c) => sum + c.created.length, 0);

        // ── 7. Notificaciones individuales con lista de residentes ─────
        // Sólo notificamos a cuidadoras que recibieron overrides NUEVOS.
        // Si idempotencia saltó todos los del round-robin, totalCreated === 0
        // y nadie recibe spam de "se te asignaron N" que no se le asignaron.
        const absentName = shift.user?.name || 'Un cuidador';
        const recipientsWithCreated = caregiverLoads.filter(c => c.created.length > 0);
        if (totalCreated > 0) {
            await Promise.all([
                // Notificar a cada cuidador con SUS residentes NUEVOS
                ...recipientsWithCreated.map(c => {
                    const names = c.created.map(p => p.name).join(', ');
                    return notifyUser(c.shift.userId, {
                        type: 'SHIFT_ALERT',
                        title: `Cobertura — Grupo ${absentColorGroup} (ausencia)`,
                        message: `${absentName} no se presentó. Se te asignaron ${c.created.length} residente${c.created.length === 1 ? '' : 's'} del Grupo ${absentColorGroup}: ${names}.`,
                        link: '/care'
                    });
                }),
                // Notificar a supervisores con el resumen real
                notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                    type: 'SHIFT_ALERT',
                    title: `Ausencia — ${absentName} · Grupo ${absentColorGroup}`,
                    message: `${totalCreated} residente${totalCreated === 1 ? '' : 's'} distribuido${totalCreated === 1 ? '' : 's'} entre ${recipientsWithCreated.length} cuidador${recipientsWithCreated.length === 1 ? '' : 'es'}: ${recipientsWithCreated.map(c => `${c.shift.user?.name || '?'} (${c.created.length})`).join(', ')}.`,
                    link: '/care/supervisor'
                })
            ]);
        }

        const distributionSummary = recipientsWithCreated
            .map(c => ({ caregiver: c.shift.user?.name, count: c.created.length, patients: c.created.map(p => p.name) }));

        // Mensaje resumen — distingue "nada nuevo (idempotencia)" de
        // "distribución real". Cuando idempotencia saltó todos los del
        // round-robin, totalCreated === 0 → indicamos que la cobertura ya
        // existía sin sugerir trabajo que no se hizo.
        const summaryMessage = totalCreated === 0
            ? `Grupo ${absentColorGroup} ya tenía cobertura activa (${residents.length} residente${residents.length === 1 ? '' : 's'} con override previo).`
            : `${totalCreated} residente${totalCreated === 1 ? '' : 's'} del Grupo ${absentColorGroup} distribuido${totalCreated === 1 ? '' : 's'} equitativamente entre ${distributionSummary.length} cuidador${distributionSummary.length === 1 ? '' : 'es'}.`;

        return NextResponse.json({
            success: true,
            shift,
            absentColorGroup,
            residents,
            redistributionPending: false,
            redistributionCompleted: true,
            distribution: distributionSummary,
            residentsRedistributed: totalCreated,
            patternIncident,
            message: summaryMessage,
        });

    } catch (error: any) {
        logError('hr.schedule.absent.post', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error procesando ausencia' },
            { status: 500 }
        );
    }
}
