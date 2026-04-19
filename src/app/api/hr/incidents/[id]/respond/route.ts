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
                    type: 'EMAR_ALERT',
                    title: 'Respuesta a observación recibida',
                    message: `Empleado ${incident.employee?.name ?? ''} respondió a la observación. Pendiente tu decisión.`
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
                type: 'EMAR_ALERT',
                title: 'Apelación recibida',
                message: `Empleado ${incident.employee?.name ?? ''} apeló la observación.`
            }
        );

        return NextResponse.json({ success: true, incident: updated });

    } catch (error: any) {
        console.error("Error responding to HR incident:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
