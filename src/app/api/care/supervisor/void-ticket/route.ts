import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * Sprint R — Void/descartar ticket con motivo obligatorio (≥10 chars).
 *
 * Actualiza TriageTicket o Complaint según sourceType. Deja rastro del
 * motivo en el registro (resolutionNote para Complaint, followUpNotes
 * JSON array para TriageTicket) + SystemAuditLog.
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
        const { headquartersId: bodyHqId, sourceType, sourceId, reason } = body;

        if (!sourceType || !sourceId) {
            return NextResponse.json({ success: false, error: 'sourceType y sourceId requeridos' }, { status: 400 });
        }
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
            return NextResponse.json({ success: false, error: 'El motivo debe tener al menos 10 caracteres' }, { status: 400 });
        }

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
        } catch (e) { console.error('[void-ticket audit]', e); }

        return NextResponse.json({ success: true, affected });
    } catch (error: any) {
        console.error('void-ticket error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error descartando ticket',
        }, { status: 500 });
    }
}
