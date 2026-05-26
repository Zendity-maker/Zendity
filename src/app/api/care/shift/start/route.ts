import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import { inferShiftTypeFromAST, resolveCaregiverCurrentColors } from '@/lib/shift-coverage';
import { ColorGroup } from '@prisma/client';
import { requireRole } from '@/lib/api-auth';
import { logError, logWarn } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Solo personal clínico de piso puede abrir un ShiftSession. Antes el endpoint
// aceptaba cualquier rol, lo que dejaba a DIRECTOR/ADMIN/SUPER_ADMIN crear
// sesiones de prueba que generaban VitalsOrder fantasma para toda la sede.
// FASE 51: se extiende a usuarios con secondaryRoles que incluya CAREGIVER/NURSE
// (ej. SUPERVISOR + CAREGIVER como Zuleyka Valcarcel).
const CAREGIVER_ROLES = ['CAREGIVER', 'NURSE'];

// Sprint J: ventana automática de 4h al inicio de turno
const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;

// Resuelve los residentes asignados al cuidador para la ventana de vitales.
//
// Modelo:
//   - El COLOR BASE viene de ScheduledShift del Builder (semana publicada),
//     filtrado por el shiftType actual.
//   - ShiftColorAssignment NO reemplaza el color base — lo SUMA. Sirve para
//     coberturas adicionales (ej. cuidadora cubre EVENING/YELLOW además de
//     su EVENING/BLUE programado) o para reasignaciones explícitas cuando un
//     cuidador hace overtime en un shiftType distinto del programado.
//   - Si no hay match con el shiftType actual y no hay ColorAssignment, se
//     hace fallback a la ScheduledShift más reciente del día (caso overtime).
//   - Si después de todo no hay colores o aparece 'ALL', se traen todos los
//     residentes ACTIVE de la sede (caso cuidadora solitaria).
//
// Reformulado tras descubrir que el endpoint legacy /api/hr/schedule/absent
// creaba ShiftColorAssignment con el color del AUSENTE para los receptores,
// sobreescribiendo el color base de cuidadoras como Yeray (BLUE → YELLOW).
async function resolveAssignedPatients(caregiverId: string, hqId: string) {
    const dayStart = todayStartAST();
    const currentShiftType = inferShiftTypeFromAST();

    // 1. Color base del Builder para el shiftType actual
    const scheduledNow = await prisma.scheduledShift.findFirst({
        where: {
            userId: caregiverId,
            date: { gte: dayStart },
            shiftType: currentShiftType as any,
            isAbsent: false,
            schedule: { headquartersId: hqId, status: 'PUBLISHED' },
        },
        select: { colorGroup: true },
    });
    const baseColor = scheduledNow?.colorGroup && scheduledNow.colorGroup !== 'UNASSIGNED'
        ? [scheduledNow.colorGroup]
        : [];

    // 2. ShiftColorAssignments del día — coberturas adicionales que SUMAN al base
    const colorAssignments = await prisma.shiftColorAssignment.findMany({
        where: {
            headquartersId: hqId,
            userId: caregiverId,
            assignedAt: { gte: dayStart },
        },
        select: { color: true },
    });
    const overrideColors = colorAssignments.map(a => a.color).filter(Boolean);

    // Unión deduplicada: base + coberturas
    let colors = Array.from(new Set([...baseColor, ...overrideColors]));

    // 3. Fallback overtime: sin match del shiftType actual ni cobertura → usar
    //    la ScheduledShift más reciente del día (cuidadora extendió su turno).
    if (colors.length === 0) {
        const fallback = await prisma.scheduledShift.findFirst({
            where: {
                userId: caregiverId,
                date: { gte: dayStart },
                isAbsent: false,
                schedule: { headquartersId: hqId, status: 'PUBLISHED' },
            },
            orderBy: { date: 'desc' },
            select: { colorGroup: true },
        });
        if (fallback?.colorGroup && fallback.colorGroup !== 'UNASSIGNED') {
            colors = [fallback.colorGroup];
        }
    }

    // 4. Nivel 2 — Auto-escalación a ALL si esta cuidadora es la única en piso.
    //    Auto-corrige: si entra otra cuidadora luego, el siguiente poll de
    //    /api/care recalcula y aplica el filtro normal.
    const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
    const activeCount = await prisma.shiftSession.count({
        where: {
            headquartersId: hqId,
            actualEndTime: null,
            startTime: { gte: fourteenHrsAgo },
            caregiver: { role: { in: ['CAREGIVER', 'NURSE'] } },
        },
    });
    const isSolo = activeCount <= 1;

    // 5. Sin color, 'ALL' o cuidadora solitaria → trae todos los ACTIVE
    const unrestricted = colors.length === 0 || colors.includes('ALL') || isSolo;

    const validColors = colors.filter(c =>
        (['RED', 'YELLOW', 'GREEN', 'BLUE', 'UNASSIGNED'] as string[]).includes(c)
    ) as ColorGroup[];

    return prisma.patient.findMany({
        where: {
            headquartersId: hqId,
            status: 'ACTIVE',
            ...(unrestricted || validColors.length === 0
                ? {}
                : { colorGroup: { in: validColors } })
        },
        select: { id: true, name: true, colorGroup: true }
    });
}

export async function POST(req: Request) {
    try {
        // requireRole ya valida primary OR secondary roles, así soportamos
        // usuarios con doble rol (ej. SUPERVISOR + CAREGIVER) iniciando turno.
        const auth = await requireRole(CAREGIVER_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { caregiverId, headquartersId, initialCensus } = await req.json();

        if (!caregiverId || !headquartersId || typeof initialCensus !== 'number') {
            return NextResponse.json({ success: false, error: "Datos incompletos o census inválido (requiere caregiverId, headquartersId, initialCensus)" }, { status: 400 });
        }

        // FIX: Auto-cerrar sesiones huérfanas del mismo cuidador (>14h sin cerrar).
        const fourteenHoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const autoClosed = await prisma.shiftSession.updateMany({
            where: {
                caregiverId,
                actualEndTime: null,
                startTime: { lt: fourteenHoursAgo }
            },
            data: {
                actualEndTime: new Date()
            }
        });
        if (autoClosed.count > 0) {
            console.log(`[shift/start] Auto-cerradas ${autoClosed.count} sesiones huérfanas del cuidador ${caregiverId}`);
        }

        // Verificar si ya hay una sesión activa reciente (últimas 14h)
        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId,
                actualEndTime: null,
                startTime: { gte: fourteenHoursAgo }
            }
        });

        if (activeSession) {
            return NextResponse.json({ success: true, message: "Ya existe un turno activo", shiftSession: activeSession });
        }

        const newSession = await prisma.shiftSession.create({
            data: {
                caregiverId,
                headquartersId,
                initialCensus,
                startTime: new Date()
            }
        });

        // ── Sprint N.3 — Parte C: Resolver overrides si el cuidador del color ausente llegó ──
        // Si este cuidador es "dueño" de un color que estaba ausente y había
        // overrides activos, revertimos: marcamos overrides resolvedAt+isActive=false,
        // cancelamos las VitalsOrders auto creadas por ellos y notificamos a los
        // receptores que esos residentes vuelven a su grupo.
        try {
            const dayStart = todayStartAST();

            // Colores del cuidador entrante PARA EL TURNO ACTUAL.
            // Usa el helper puro resolveCaregiverCurrentColors que filtra por
            // shiftType compatible con la hora del clock-in. Esto bloquea el
            // bug "entrante 4h antes resuelve overrides prematuramente":
            // una caregiver pautada NIGHT (22–06) que hace clock-in a las 18:00
            // NO es dueña de su NIGHT-color hasta las 22:00; este helper
            // devuelve [] para ella entre 18:00 y 22:00.
            const myColors = await resolveCaregiverCurrentColors({
                caregiverId,
                hqId: headquartersId,
                // Usar startTime de la nueva sesión (acabamos de hacer new Date())
                // garantiza que el shift type se evalúe al momento del clock-in,
                // no al momento de procesar (que puede haber drift de ms).
                at: newSession.startTime,
            });

            if (myColors.length > 0) {
                const overrides = await prisma.shiftPatientOverride.findMany({
                    where: {
                        headquartersId,
                        originalColor: { in: myColors },
                        shiftDate: { gte: dayStart },
                        isActive: true,
                    },
                    include: {
                        caregiver: { select: { id: true, name: true } },
                        patient: { select: { id: true, name: true } },
                    },
                });

                if (overrides.length > 0) {
                    const now = new Date();
                    const overrideIds = overrides.map(o => o.id);
                    const patientIds = overrides.map(o => o.patientId);

                    await prisma.shiftPatientOverride.updateMany({
                        where: { id: { in: overrideIds } },
                        data: { isActive: false, resolvedAt: now },
                    });

                    // Cancelar VitalsOrders auto creadas por la redistribución que
                    // siguen pendientes. Identificamos por patient+shiftSession del
                    // receptor + autoCreated=true + PENDING.
                    const recipientSessionIds = Array.from(new Set(overrides
                        .flatMap(o => [o.caregiverId])
                    ));
                    const recipientShiftSessions = await prisma.shiftSession.findMany({
                        where: {
                            caregiverId: { in: recipientSessionIds },
                            actualEndTime: null,
                            startTime: { gte: dayStart },
                        },
                        select: { id: true, caregiverId: true },
                    });
                    const sessionByCaregiver = new Map(recipientShiftSessions.map(s => [s.caregiverId, s.id]));

                    const cancelTargets = overrides
                        .map(o => ({ patientId: o.patientId, sessionId: sessionByCaregiver.get(o.caregiverId) }))
                        .filter(t => !!t.sessionId);

                    if (cancelTargets.length > 0) {
                        await prisma.vitalsOrder.updateMany({
                            where: {
                                status: 'PENDING',
                                autoCreated: true,
                                OR: cancelTargets.map(t => ({
                                    patientId: t.patientId,
                                    shiftSessionId: t.sessionId!,
                                })),
                            },
                            data: { status: 'EXPIRED' },
                        });
                    }

                    // Notificar a los cuidadores receptores (agrupado por caregiver)
                    const byReceiver = new Map<string, { name: string; patientNames: string[]; colors: Set<string> }>();
                    for (const o of overrides) {
                        if (!byReceiver.has(o.caregiverId)) {
                            byReceiver.set(o.caregiverId, { name: o.caregiver?.name || 'Cuidador', patientNames: [], colors: new Set() });
                        }
                        byReceiver.get(o.caregiverId)!.patientNames.push(o.patient?.name || 'residente');
                        byReceiver.get(o.caregiverId)!.colors.add(o.originalColor);
                    }
                    for (const [receiverId, data] of byReceiver.entries()) {
                        try {
                            const colorList = Array.from(data.colors).join(', ');
                            await notifyUser(receiverId, {
                                type: 'EMAR_ALERT',
                                title: 'Residentes devueltos a su grupo',
                                message: `El cuidador de ${colorList} llegó. Los residentes ${data.patientNames.slice(0, 5).join(', ')}${data.patientNames.length > 5 ? '…' : ''} vuelven a su grupo original.`,
                            });
                        } catch (e) { logWarn('care.shift.start.resolve_override_notify', e, { receiverId }); }
                    }

                    console.log(`[shift/start] Resolvidos ${overrides.length} overrides para colores ${myColors.join(',')} por llegada de ${caregiverId}`);
                }
            }
        } catch (ovErr) {
            logWarn('care.shift.start.resolve_overrides', ovErr, { caregiverId, headquartersId });
        }

        // ── Sprint J: Abrir ventana de 4h para tomar vitales a residentes asignados ──
        try {
            const assigned = await resolveAssignedPatients(caregiverId, headquartersId);
            if (assigned.length > 0) {
                const now = new Date();
                const expiresAt = new Date(now.getTime() + VITALS_WINDOW_MS);
                const fourHoursAgo = new Date(now.getTime() - VITALS_WINDOW_MS);

                // Evitar duplicados: órdenes PENDING para el mismo residente en las últimas 4h
                const patientIds = assigned.map(p => p.id);
                const recentPending = await prisma.vitalsOrder.findMany({
                    where: {
                        headquartersId,
                        patientId: { in: patientIds },
                        status: 'PENDING',
                        orderedAt: { gte: fourHoursAgo }
                    },
                    select: { patientId: true }
                });
                const alreadyPending = new Set(recentPending.map(o => o.patientId));
                const toCreate = assigned.filter(p => !alreadyPending.has(p.id));

                if (toCreate.length > 0) {
                    await prisma.vitalsOrder.createMany({
                        data: toCreate.map(p => ({
                            headquartersId,
                            patientId: p.id,
                            orderedById: caregiverId,
                            caregiverId,
                            reason: 'Vitales de entrada al turno',
                            orderedAt: now,
                            expiresAt,
                            status: 'PENDING',
                            autoCreated: true,
                            shiftSessionId: newSession.id,
                            penaltyApplied: false,
                        }))
                    });

                    const horaLimite = expiresAt.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Puerto_Rico'
                    });
                    await notifyUser(caregiverId, {
                        type: 'EMAR_ALERT',
                        title: 'Vitales de entrada al turno',
                        message: `Tienes 4 horas para tomar vitales a tus ${toCreate.length} residentes. Vencen a las ${horaLimite}.`
                    });
                    console.log(`[shift/start] Abiertas ${toCreate.length} ventanas de vitales 4h para ${caregiverId}`);
                }
            }
        } catch (vitalsErr) {
            // Never-throw: si falla el pre-seed de vitales no rompemos el inicio de turno
            logWarn('care.shift.start.vitals_preseed', vitalsErr, { caregiverId, headquartersId });
        }

        // --- Reporte de turno previo para el cuidador entrante ---
        // El entrante recibe el último handover del turno anterior firmado por
        // el cuidador saliente. Lo ve esté pendiente de firma del supervisor
        // (PENDING) o ya firmado (ACCEPTED). Excluye el prólogo diario del cron.
        // Ventana 12h: cubre cualquier cambio de turno reciente.
        //
        // Caso edge cubierto: si la misma cuidadora cierra un turno y arranca
        // el siguiente, debe ver el reporte que ella misma firmó (cubre dos
        // turnos seguidos). Por eso filtramos por shiftSessionId (excluir la
        // sesión recién creada) en lugar de excluir por outgoingNurseId.
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const pendingHandover = await prisma.shiftHandover.findFirst({
            where: {
                headquartersId,
                isDailyPrologue: false,
                handoverCompleted: true,
                createdAt: { gte: twelveHoursAgo },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                outgoingNurse: { select: { name: true } },
                notes: true,
            },
        });

        if (pendingHandover) {
            return NextResponse.json({
                success: true,
                shiftSession: newSession,
                requireHandoverAccept: true,
                pendingHandover,
            });
        }
        // -------------------------------------------------------------

        return NextResponse.json({ success: true, shiftSession: newSession });

    } catch (error) {
        logError('care.shift.start.post', error);
        return NextResponse.json({ success: false, error: "Fallo registrando el inicio de turno" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const caregiverId = searchParams.get('caregiverId');

        if (!caregiverId) {
            return NextResponse.json({ success: false, error: "caregiverId es requerido" }, { status: 400 });
        }

        // Ventana rodante de 14h (no "hoy UTC") para evitar falsos negativos al cruzar medianoche UTC
        const fourteenHoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId,
                actualEndTime: null,
                startTime: { gte: fourteenHoursAgo }
            }
        });

        return NextResponse.json({ success: true, activeSession });

    } catch (error) {
        logError('care.shift.start.get', error);
        return NextResponse.json({ success: false, error: "Error obteniendo sesión" }, { status: 500 });
    }
}
