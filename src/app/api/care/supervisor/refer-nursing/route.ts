import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * Sprint R — Referir ticket a enfermería.
 *
 * NO crea tarea formal (FastActionAssignment). Solo notifica al grupo NURSE
 * + marca TriageTicket como IN_PROGRESS + isEscalated=true si el sourceType
 * es un TriageTicket real. Para otros sourceType (INCIDENT, CLINICAL_ALERT,
 * COMPLAINT, etc.) solo deja el audit log — el ticket del feed sintético se
 * resuelve upstream.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerId = (session.user as any).id;
        const invokerName = (session.user as any).name || 'Supervisor';
        const invokerHqId = (session.user as any).headquartersId;

        const body = await req.json();
        const { headquartersId: bodyHqId, sourceType, sourceId, patientId, description } = body;

        if (!sourceType || !sourceId || !description) {
            return NextResponse.json({ success: false, error: 'sourceType, sourceId y description requeridos' }, { status: 400 });
        }

        // Tenant check: hqId del body debe coincidir con la sede del invocador
        if (bodyHqId && bodyHqId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Sede fuera de tu alcance' }, { status: 403 });
        }
        const hqId = invokerHqId;

        // Si el ticket es un TriageTicket real (originType EMAR_MISS, DAILY_LOG…),
        // actualizarlo. Los sourceType del feed sintético (INCIDENT, CLINICAL_ALERT,
        // COMPLAINT, UPP_SLA, ZENDI_*) no corresponden a una fila de TriageTicket.
        let triageUpdated = false;
        if (sourceType === 'TRIAGE_TICKET') {
            const ticketCheck = await prisma.triageTicket.findUnique({
                where: { id: sourceId },
                select: { id: true, headquartersId: true },
            });
            if (ticketCheck && ticketCheck.headquartersId === hqId) {
                await prisma.triageTicket.update({
                    where: { id: sourceId },
                    data: { status: 'IN_PROGRESS', isEscalated: true },
                });
                triageUpdated = true;
            }
        }

        // Notificar a todo el rol NURSE
        const notified = await notifyRoles(hqId, ['NURSE'], {
            type: 'EMAR_ALERT',
            title: 'Referido a Enfermería',
            message: `${description.slice(0, 200)} — Referido por ${invokerName}`,
        });

        // Audit log — usamos ESCALATED del enum existente + kind en payload
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'TriageFeed',
                    entityId: sourceId,
                    action: SystemAuditAction.ESCALATED,
                    performedById: invokerId,
                    payloadChanges: {
                        kind: 'REFERRED_TO_NURSING',
                        sourceType,
                        sourceId,
                        patientId: patientId || null,
                        description: description.slice(0, 500),
                        notifiedNurses: notified,
                        triageTicketUpdated: triageUpdated,
                    } as any,
                },
            });
        } catch (e) { console.error('[refer-nursing audit]', e); }

        return NextResponse.json({
            success: true,
            notifiedCount: notified,
            triageTicketUpdated: triageUpdated,
        });
    } catch (error: any) {
        console.error('refer-nursing error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error refiriendo a enfermería',
        }, { status: 500 });
    }
}
