import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles, notifyUser } from '@/lib/notifications';
import { IncidentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const hqId = (session.user as any).headquartersId;

        const { response, type } = await req.json();
        if (!response || typeof response !== 'string' || response.trim().length < 3) {
            return NextResponse.json({ success: false, error: 'Respuesta requerida' }, { status: 400 });
        }
        if (!['RESPONSE', 'APPEAL'].includes(type)) {
            return NextResponse.json({ success: false, error: 'Tipo inválido (RESPONSE o APPEAL)' }, { status: 400 });
        }

        const incident = await prisma.incidentReport.findUnique({
            where: { id },
            include: { employee: { select: { id: true, name: true } } }
        });
        if (!incident) {
            return NextResponse.json({ success: false, error: 'Observación no encontrada' }, { status: 404 });
        }
        if (incident.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Tenant mismatch' }, { status: 403 });
        }
        // Solo el empleado objeto de la observación puede responder/apelar
        if (incident.employeeId !== invokerId) {
            return NextResponse.json({ success: false, error: 'Solo el empleado puede responder' }, { status: 403 });
        }

        const now = new Date();

        if (type === 'RESPONSE') {
            /**
             * La explicación solo cabe mientras se está pidiendo.
             *
             * Esta rama no miraba el estado (la de APPEAL sí, abajo), así que
             * ponía EXPLANATION_RECEIVED viniera de donde viniera: una respuesta
             * escrita sobre una observación ya APLICADA o ya DESESTIMADA la
             * sacaba de ese estado y la devolvía a la cola del director, con sus
             * puntos ya descontados y su apelación colgando de un estado que
             * había dejado de ser APPLIED.
             */
            if (incident.status !== IncidentStatus.PENDING_EXPLANATION
                && incident.status !== IncidentStatus.EXPLANATION_RECEIVED) {
                return NextResponse.json({
                    success: false,
                    error: 'Esta observación ya fue resuelta. Si no estás de acuerdo, usa la apelación.',
                    code: 'ESTADO_NO_ADMITE_RESPUESTA',
                }, { status: 400 });
            }

            /**
             * Guarda contra doble envío.
             *
             * Sin ella, el segundo toque pisa el texto del primero —se pierde lo
             * que la persona escribió— y manda un segundo aviso idéntico a
             * dirección. Se devuelve ÉXITO con lo que ya está guardado: quien
             * pulsó hizo lo correcto, y un error en rojo es justo lo que le hace
             * volver a pulsar.
             */
            if (incident.employeeResponse && incident.respondedAt) {
                const minutos = (now.getTime() - incident.respondedAt.getTime()) / 60000;
                if (minutos < 10) {
                    return NextResponse.json({
                        success: true,
                        duplicada: true,
                        message: 'Tu explicación ya estaba enviada.',
                        incident,
                    });
                }
            }

            const updated = await prisma.incidentReport.update({
                where: { id },
                data: {
                    employeeResponse: response,
                    respondedAt: now,
                    status: IncidentStatus.EXPLANATION_RECEIVED,
                }
            });

            await notifyRoles(
                hqId,
                ['DIRECTOR', 'SUPERVISOR'],
                {
                    type: 'HR_OBSERVATION',
                    title: 'Respuesta a observación recibida',
                    message: `Empleado ${incident.employee?.name ?? ''} respondió a la observación. Pendiente tu decisión.`,
                    link: '/hr/incidents',
                }
            );

            return NextResponse.json({ success: true, incident: updated });
        }

        // APPEAL — solo si ya fue APPLIED
        if (incident.status !== IncidentStatus.APPLIED) {
            return NextResponse.json({ success: false, error: 'Solo se pueden apelar observaciones aplicadas' }, { status: 400 });
        }

        const updated = await prisma.incidentReport.update({
            where: { id },
            data: {
                appealText: response,
                appealedAt: now,
            }
        });

        await notifyRoles(
            hqId,
            ['DIRECTOR'],
            {
                type: 'HR_OBSERVATION',
                title: 'Apelación recibida',
                message: `Empleado ${incident.employee?.name ?? ''} apeló la observación.`,
                link: '/hr/incidents',
            }
        );

        return NextResponse.json({ success: true, incident: updated });

    } catch (error: any) {
        console.error("Error responding to HR incident:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
