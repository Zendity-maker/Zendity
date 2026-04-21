import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import { ColorGroup } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Solo personal clínico de piso puede abrir un ShiftSession. Antes el endpoint
// aceptaba cualquier rol, lo que dejaba a DIRECTOR/ADMIN/SUPER_ADMIN crear
// sesiones de prueba que generaban VitalsOrder fantasma para toda la sede.
const CAREGIVER_ROLES = ['CAREGIVER', 'NURSE'];

// Sprint J: ventana automática de 4h al inicio de turno
const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;

// Resuelve los residentes asignados al cuidador para la ventana de vitales.
// Prioridad:
//   1. ShiftColorAssignment (overrides intra-turno) → color(es) específicos
//   2. ScheduledShift del día → colorGroup del turno programado
//   3. Fallback: sin color → cuidador solitario, trae todos los ACTIVE de la sede
// Si el color resuelve a 'ALL' o vacío → sin filtro de color.
async function resolveAssignedPatients(caregiverId: string, hqId: string) {
    const dayStart = todayStartAST();

    // 1. ShiftColorAssignment del día clínico para este cuidador
    const colorAssignments = await prisma.shiftColorAssignment.findMany({
        where: {
            headquartersId: hqId,
            userId: caregiverId,
            assignedAt: { gte: dayStart }
        },
        select: { color: true }
    });
    let colors = colorAssignments.map(a => a.color).filter(Boolean);

    // 2. Fallback a ScheduledShift del día
    if (colors.length === 0) {
        const now = new Date();
        const startWindow = new Date(now.getTime() - 14 * 60 * 60 * 1000);
        const scheduled = await prisma.scheduledShift.findFirst({
            where: {
                userId: caregiverId,
                date: { gte: startWindow, lte: now },
                isAbsent: false
            },
            orderBy: { date: 'desc' },
            select: { colorGroup: true }
        });
        if (scheduled?.colorGroup) colors = [scheduled.colorGroup];
    }

    // 3. Sin color / 'ALL' → cuidador solitario, trae todos los ACTIVE
    const unrestricted = colors.length === 0 || colors.includes('ALL');

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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }
        if (!CAREGIVER_ROLES.includes(session.user.role)) {
            return NextResponse.json(
                { success: false, error: "Solo cuidadores y enfermeras pueden iniciar turno clínico" },
                { status: 403 },
            );
        }

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

            // Colores del cuidador entrante (ShiftColorAssignment del día → fallback
            // ScheduledShift.colorGroup reciente).
            const colorAssignments = await prisma.shiftColorAssignment.findMany({
                where: { headquartersId, userId: caregiverId, assignedAt: { gte: dayStart } },
                select: { color: true },
            });
            let myColors = colorAssignments.map(a => a.color).filter(Boolean);
            if (myColors.length === 0) {
                const now = new Date();
                const window14h = new Date(now.getTime() - 14 * 60 * 60 * 1000);
                const sched = await prisma.scheduledShift.findFirst({
                    where: { userId: caregiverId, date: { gte: window14h, lte: now }, isAbsent: false, colorGroup: { not: null } },
                    orderBy: { date: 'desc' },
                    select: { colorGroup: true },
                });
                if (sched?.colorGroup && sched.colorGroup !== 'UNASSIGNED') myColors = [sched.colorGroup];
            }

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
                        } catch (e) { console.error('[shift/start resolve override notify]', e); }
                    }

                    console.log(`[shift/start] Resolvidos ${overrides.length} overrides para colores ${myColors.join(',')} por llegada de ${caregiverId}`);
                }
            }
        } catch (ovErr) {
            console.error('[shift/start] Fallo resolviendo overrides:', ovErr);
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
            console.error('[shift/start] Fallo abriendo ventana de vitales:', vitalsErr);
        }

        // --- FASE 44: Verificar Relevos Pendientes (Clock-In Lock) ---
        const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
        const pendingHandover = await prisma.shiftHandover.findFirst({
            where: {
                headquartersId,
                status: 'PENDING',
                createdAt: { gte: eightHoursAgo }
            },
            orderBy: { createdAt: 'desc' },
            include: {
                outgoingNurse: { select: { name: true } },
                notes: true
            }
        });

        if (pendingHandover) {
            return NextResponse.json({
                success: true,
                shiftSession: newSession,
                requireHandoverAccept: true,
                pendingHandover
            });
        }
        // -------------------------------------------------------------

        return NextResponse.json({ success: true, shiftSession: newSession });

    } catch (error) {
        console.error("Shift Start Error:", error);
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
        console.error("Shift GET Error:", error);
        return NextResponse.json({ success: false, error: "Error obteniendo sesión" }, { status: 500 });
    }
}
