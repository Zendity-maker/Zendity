import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import { ColorGroup } from '@prisma/client';

export const dynamic = 'force-dynamic';

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
