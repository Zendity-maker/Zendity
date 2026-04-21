import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { notifyRoles } from "@/lib/notifications";

const CARE_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR'];
const EVENT_AUDIENCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // ±7 días desde el evento

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;

        const events = await prisma.headquartersEvent.findMany({
            where: { headquartersId: hqId },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({ success: true, events });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        // Only higher ups can create events
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const body = await request.json();
        const { title, description, type, startTime, endTime, patientId, targetPopulation, targetGroups, targetPatients } = body;

        if (!title || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newEvent = await prisma.headquartersEvent.create({
            data: {
                headquartersId: hqId,
                title,
                description: description || null,
                type: type || 'OTHER',
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                patientId: patientId || null,
                targetPopulation: targetPopulation || 'ALL',
                targetGroups: targetGroups || [],
                targetPatients: targetPatients || []
            },
            include: {
                patient: { select: { id: true, name: true } }
            }
        });

        // Notificar al público target del evento. Never-throw: si falla la
        // notificación, el evento ya está creado — no revertimos.
        try {
            const dateStr = new Date(newEvent.startTime).toLocaleDateString('es-PR', {
                weekday: 'long', day: '2-digit', month: 'long',
                hour: '2-digit', minute: '2-digit',
            });
            const payload = {
                type: 'SHIFT_ALERT' as const,
                title: `Nuevo evento: ${newEvent.title}`,
                message: `${dateStr} — ${newEvent.description || 'Sin descripción adicional.'}`,
            };

            if (newEvent.targetPopulation === 'ALL') {
                await notifyRoles(hqId, CARE_ROLES, payload);
            } else if (newEvent.targetPopulation === 'GROUP' && newEvent.targetGroups.length > 0) {
                // Usuarios con ScheduledShift con colorGroup en targetGroups dentro
                // de una ventana ±7d del evento (cobertura semanal del roster).
                const windowStart = new Date(new Date(newEvent.startTime).getTime() - EVENT_AUDIENCE_WINDOW_MS);
                const windowEnd = new Date(new Date(newEvent.startTime).getTime() + EVENT_AUDIENCE_WINDOW_MS);
                const targetUsers = await prisma.scheduledShift.findMany({
                    where: {
                        schedule: { headquartersId: hqId },
                        colorGroup: { in: newEvent.targetGroups },
                        isAbsent: false,
                        date: { gte: windowStart, lte: windowEnd },
                    },
                    select: { userId: true },
                });
                const uniqueUserIds = Array.from(new Set(targetUsers.map(t => t.userId)));
                if (uniqueUserIds.length > 0) {
                    await prisma.notification.createMany({
                        data: uniqueUserIds.map(uid => ({
                            userId: uid,
                            type: payload.type,
                            title: payload.title,
                            message: payload.message,
                            isRead: false,
                        })),
                    });
                }
                // Además: supervisores/directores siempre enterados de eventos GROUP
                await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR'], payload);
            } else if (newEvent.targetPopulation === 'SPECIFIC' && newEvent.targetPatients.length > 0) {
                // Cuidadores con override activo sobre esos residentes + cuidadores
                // cuyo colorGroup programado coincide con el color de esos residentes.
                const [targetPatientsData, activeOverrides] = await Promise.all([
                    prisma.patient.findMany({
                        where: { id: { in: newEvent.targetPatients }, headquartersId: hqId },
                        select: { id: true, colorGroup: true },
                    }),
                    prisma.shiftPatientOverride.findMany({
                        where: {
                            headquartersId: hqId,
                            patientId: { in: newEvent.targetPatients },
                            isActive: true,
                        },
                        select: { caregiverId: true },
                    }),
                ]);

                const targetColors = Array.from(new Set(
                    targetPatientsData
                        .map(p => p.colorGroup as string | null)
                        .filter((c): c is string => !!c && c !== 'UNASSIGNED')
                ));
                const overrideUserIds = Array.from(new Set(activeOverrides.map(o => o.caregiverId)));

                const scheduledUsers = targetColors.length > 0
                    ? await prisma.scheduledShift.findMany({
                        where: {
                            schedule: { headquartersId: hqId },
                            colorGroup: { in: targetColors },
                            isAbsent: false,
                            date: {
                                gte: new Date(new Date(newEvent.startTime).getTime() - EVENT_AUDIENCE_WINDOW_MS),
                                lte: new Date(new Date(newEvent.startTime).getTime() + EVENT_AUDIENCE_WINDOW_MS),
                            },
                        },
                        select: { userId: true },
                    })
                    : [];

                const uniqueUserIds = Array.from(new Set([
                    ...overrideUserIds,
                    ...scheduledUsers.map(s => s.userId),
                ]));

                if (uniqueUserIds.length > 0) {
                    await prisma.notification.createMany({
                        data: uniqueUserIds.map(uid => ({
                            userId: uid,
                            type: payload.type,
                            title: payload.title,
                            message: payload.message,
                            isRead: false,
                        })),
                    });
                }
                await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR'], payload);
            }
        } catch (notifyErr) {
            console.error('[calendar POST notify]', notifyErr);
        }

        return NextResponse.json({ success: true, event: newEvent }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const deleted = await prisma.headquartersEvent.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, event: deleted }, { status: 200 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();
        const { status, dismissReason } = body;

        const updated = await prisma.headquartersEvent.update({
            where: { id },
            data: {
                status: status || undefined,
                ...(dismissReason ? { description: dismissReason } : {}),
            },
        });

        return NextResponse.json({ success: true, event: updated });
    } catch (error) {
        console.error('PATCH Error:', error);
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }
}
