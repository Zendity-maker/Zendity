import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const VoidBody = z.object({
    headquartersId: z.string().optional(),
    sourceType:     z.string().min(1, 'sourceType requerido'),
    sourceId:       z.string().min(1, 'sourceId requerido'),
    reason:         z.string().min(10, 'el motivo debe tener al menos 10 caracteres').max(1000),
});

/**
 * Sprint R — Void/descartar ticket con motivo obligatorio (≥10 chars).
 *
 * Actualiza TriageTicket o Complaint según sourceType. Deja rastro del
 * motivo en el registro (resolutionNote para Complaint, followUpNotes
 * JSON array para TriageTicket) + SystemAuditLog.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: invokerHqId } = auth;
        const invokerName = auth.name || 'Supervisor';

        const rawBody = await req.json().catch(() => null);
        const parsed = VoidBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { headquartersId: bodyHqId, sourceType, sourceId, reason } = parsed.data;

        if (bodyHqId && bodyHqId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Sede fuera de tu alcance' }, { status: 403 });
        }
        const hqId = invokerHqId;
        const reasonTrimmed = reason.trim();

        let affected: 'triage' | 'complaint' | 'none' = 'none';

        if (sourceType === 'TRIAGE_TICKET') {
            const ticketCheck = await prisma.triageTicket.findUnique({
                where: { id: sourceId },
                select: { headquartersId: true, followUpNotes: true },
            });
            if (!ticketCheck || ticketCheck.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: 'Ticket fuera de tu sede' }, { status: 403 });
            }
            const existing = Array.isArray(ticketCheck.followUpNotes) ? ticketCheck.followUpNotes : [];
            await prisma.triageTicket.update({
                where: { id: sourceId },
                data: {
                    isVoided: true,
                    status: 'RESOLVED',
                    resolvedAt: new Date(),
                    resolvedById: invokerId,
                    followUpNotes: [
                        ...existing,
                        {
                            authorId: invokerId,
                            authorName: invokerName,
                            note: `Descartado: ${reasonTrimmed}`,
                            createdAt: new Date().toISOString(),
                        },
                    ] as any,
                },
            });
            affected = 'triage';
        } else if (sourceType === 'COMPLAINT') {
            const complaintCheck = await prisma.complaint.findUnique({
                where: { id: sourceId },
                select: { headquartersId: true },
            });
            if (!complaintCheck || complaintCheck.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: 'Queja fuera de tu sede' }, { status: 403 });
            }
            await prisma.complaint.update({
                where: { id: sourceId },
                data: {
                    status: 'RESOLVED',
                    resolutionNote: `Descartado: ${reasonTrimmed}`,
                },
            });
            affected = 'complaint';
        }
        // Otros sourceType (INCIDENT, CLINICAL_ALERT, UPP_SLA, ZENDI_*) no tienen
        // fila canónica — el feed del supervisor los regenera por computación.
        // Registramos solo el audit log para trazabilidad del descarte.

        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: affected === 'complaint' ? 'Complaint' : 'TriageFeed',
                    entityId: sourceId,
                    action: SystemAuditAction.VOIDED,
                    performedById: invokerId,
                    payloadChanges: {
                        kind: 'TICKET_VOIDED',
                        sourceType,
                        sourceId,
                        reason: reasonTrimmed,
                        affected,
                    } as any,
                },
            });
        } catch (e) { logWarn('care.supervisor.void_ticket.audit', e, { sourceType, sourceId }); }

        return NextResponse.json({ success: true, affected });
    } catch (error: any) {
        logError('care.supervisor.void_ticket.post', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error descartando ticket',
        }, { status: 500 });
    }
}
