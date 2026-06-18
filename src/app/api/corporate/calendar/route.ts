import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { notifyRoles } from "@/lib/notifications";
import { withPhiAccessLog, logPhiAccess } from '@/lib/phi-audit';
import { getSessionUser } from '@/lib/api-auth';
import { EventType, PhiAccessAction } from '@prisma/client';

const CARE_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR'];
const EVENT_AUDIENCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // ±7 días desde el evento

// Tipos del calendario que representan citas/eventos con familiares.
// Sprint Coordinador (jun-2026): COORDINATOR-puro ve SOLO estos (minimum-necessary).
// El PATCH de aprobación de FamilyAppointment ya mapea los 5 tipos de cita a
// estos 3: VIDEO_CALL→FAMILY_VIDEO_CALL, PHONE_CALL→FAMILY_PHONE_CALL, y
// VISIT/DIRECTOR_MEETING/SPECIAL_OCCASION→FAMILY_VISIT — el set cubre el
// universo completo de citas aprobadas que Wanda debe ver.
const FAMILY_EVENT_TYPES = [
    EventType.FAMILY_VISIT,
    EventType.FAMILY_VIDEO_CALL,
    EventType.FAMILY_PHONE_CALL,
];

// Mismo criterio "puro" que la cláusula de protección en AuthContext y el
// filtro de tabs en /corporate/medical/patients/[id] (una sola definición).
const FULL_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'SOCIAL_WORKER'];

// PHI audit (Pilar 1) — Sprint Coordinador (jun-2026): wrap exterior captura
// el evento de lista; el handler emite además 1 fila logPhiAccess por cada
// patientId único entre los eventos retornados (patrón "fila por paciente",
// mismo de los demás list endpoints del sprint). NOTA: esto audita a TODOS
// los consumidores del calendario (no solo COORDINATOR) — intencional, cierra
// un gap pre-existente sobre HeadquartersEvent ligados a paciente.
export const GET = withPhiAccessLog(getCalendarHandler, {
    resourceType: 'HeadquartersEventList',
});

async function getCalendarHandler(request: Request) {
    try {
        const auth = await getSessionUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const hqId = auth.headquartersId;

        // ¿COORDINATOR puro? Si SOCIAL_WORKER/NURSE/SUP/DIR/ADMIN aparece como
        // primary o secondary, NO se considera puro — esos roles ya tienen
        // acceso amplio legítimo y deben ver el calendario completo.
        const allRoles = [auth.role, ...auth.secondaryRoles];
        const isCoordinatorPure =
            allRoles.includes('COORDINATOR') &&
            !allRoles.some(r => FULL_VIEW_ROLES.includes(r));

        // FIX 2026-05-31: excluir eventos ligados a un paciente DISCHARGED o
        // DECEASED. Antes el calendario seguía mostrando recordatorios futuros
        // (citas médicas, cumpleaños, visitas) de residentes que ya no están
        // en la sede — confunde a Celia y al equipo. Eventos sin paciente
        // específico (sede entera o grupos de color) se conservan.
        const events = await prisma.headquartersEvent.findMany({
            where: {
                headquartersId: hqId,
                OR: [
                    { patientId: null },
                    { patient: { status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } } },
                ],
                // Scope minimum-necessary: COORDINATOR-puro solo ve eventos
                // de familia. El resto de roles ve el calendario completo.
                ...(isCoordinatorPure ? { type: { in: FAMILY_EVENT_TYPES } } : {}),
            },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        // Fila-por-paciente: dedupe por patientId. Eventos sin patientId NO
        // emiten fila adicional (el wrap exterior ya registra la consulta).
        const seen = new Set<string>();
        for (const ev of events) {
            if (!ev.patientId || seen.has(ev.patientId)) continue;
            seen.add(ev.patientId);
            logPhiAccess({
                action: PhiAccessAction.READ,
                resourceType: 'HeadquartersEvent',
                resourceId: ev.id,
                patientId: ev.patientId,
                userId: auth.id,
                userRole: auth.role,
                hqId,
                success: true,
                routePath: '/api/corporate/calendar',
                context: { listSize: events.length, scopedToFamily: isCoordinatorPure },
            });
        }

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
                link: '/corporate/calendar',
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
                            link: payload.link,
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
                            link: payload.link,
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
