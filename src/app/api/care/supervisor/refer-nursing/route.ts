import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError, logWarn } from '@/lib/logger';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const ReferBody = z.object({
    headquartersId: z.string().optional(),
    sourceType:     z.string().min(1, 'sourceType requerido'),
    sourceId:       z.string().min(1, 'sourceId requerido'),
    patientId:      z.string().optional().nullable(),
    description:    z.string().min(1, 'descripción requerida').max(1000),
});

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
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: invokerHqId } = auth;
        const invokerName = auth.name || 'Supervisor';

        const rawBody = await req.json().catch(() => null);
        const parsed = ReferBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { headquartersId: bodyHqId, sourceType, sourceId, patientId, description } = parsed.data;

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
        } catch (e) { logWarn('care.supervisor.refer_nursing.audit', e, { sourceType, sourceId }); }

        return NextResponse.json({
            success: true,
            notifiedCount: notified,
            triageTicketUpdated: triageUpdated,
        });
    } catch (error: any) {
        logError('care.supervisor.refer_nursing.post', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error refiriendo a enfermería',
        }, { status: 500 });
    }
}
