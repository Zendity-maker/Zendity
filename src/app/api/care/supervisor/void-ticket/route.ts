import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { cerrarTicketDeOrigen } from '@/lib/triage-sync';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * DOS COSAS DISTINTAS QUE ANTES ERAN UNA.
 *
 * Hasta el 10-sep-2026 la unica forma de cerrar una alerta del panel era un
 * boton que decia DESCARTAR y exigia escribir un motivo de 10 caracteres.
 *
 * Quien ATENDIO la alerta no tenia donde decirlo. Sus dos opciones eran
 * "descartar" algo que si habia atendido —que suena a que no valia nada— o
 * dejarla ahi. Andres lo dijo con sus palabras: "se atendieron algunos avisos
 * pero siguen ahi".
 *
 * Lo que quedo en Cupey: 28 alertas clinicas sin cerrar, 27 de mas de un dia; y
 * SIETE caidas sin resolver, algunas de junio — tres meses.
 *
 *   ATENDIDO    hice algo. La nota es opcional.
 *   DESCARTADO  no era real o no aplica. El motivo sigue siendo obligatorio,
 *               porque cerrar una alerta clinica SIN actuar es justo lo que
 *               tiene que quedar explicado.
 *
 * La distincion no es cosmetica: en el expediente no es lo mismo "se atendio"
 * que "se descarto", y hasta hoy todo lo cerrado quedaba como descartado.
 */
const VoidBody = z.object({
    headquartersId: z.string().optional(),
    sourceType:     z.string().min(1, 'sourceType requerido'),
    sourceId:       z.string().min(1, 'sourceId requerido'),
    accion:         z.enum(['ATENDIDO', 'DESCARTADO']).default('DESCARTADO'),
    reason:         z.string().max(1000).optional(),
}).refine(
    d => d.accion === 'ATENDIDO' || (d.reason ?? '').trim().length >= 10,
    { message: 'Para descartar hace falta un motivo de al menos 10 caracteres', path: ['reason'] },
);

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
        const { headquartersId: bodyHqId, sourceType, sourceId, reason, accion } = parsed.data;

        if (bodyHqId && bodyHqId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Sede fuera de tu alcance' }, { status: 403 });
        }
        const hqId = invokerHqId;
        // La nota que queda en el expediente dice CUAL de las dos cosas paso.
        // "Descartado: ..." sobre algo que se atendio es una linea falsa en el
        // registro de un residente.
        const reasonTrimmed = (reason ?? '').trim();
        const prefijo = accion === 'ATENDIDO' ? 'Atendido' : 'Descartado';
        const nota = reasonTrimmed
            ? `${prefijo}: ${reasonTrimmed}`
            : `${prefijo} por supervisión.`;

        let affected: 'triage' | 'complaint' | 'clinical_alert' | 'incident' | 'fall' | 'none' = 'none';

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
                            note: nota,
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
                return NextResponse.json({ success: false, error: 'Señalamiento fuera de tu sede' }, { status: 403 });
            }
            await prisma.complaint.update({
                where: { id: sourceId },
                data: {
                    status: 'RESOLVED',
                    resolutionNote: nota,
                },
            });
            affected = 'complaint';
        } else if (sourceType === 'CLINICAL_ALERT') {
            // CLINICAL_ALERT SÍ tiene fila canónica: es un DailyLog, y su campo
            // isResolved existe exactamente para esto. Se asumió que era
            // sintético como los grupos de Zendi, así que el supervisor
            // descartaba, recibía "listo", y el registro quedaba igual.
            // Resultado en Cupey: 286 alertas levantadas, CERO resueltas.
            const logCheck = await prisma.dailyLog.findUnique({
                where: { id: sourceId },
                select: { patient: { select: { headquartersId: true } } },
            });
            if (!logCheck || logCheck.patient.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: 'Alerta fuera de tu sede' }, { status: 403 });
            }
            await prisma.dailyLog.update({
                where: { id: sourceId },
                data: { isResolved: true },
            });
            affected = 'clinical_alert';
        } else if (sourceType === 'INCIDENT') {
            // INCIDENT sí tiene fila canónica. Antes se asumió que era
            // sintético como los grupos de Zendi, así que el supervisor
            // descartaba, recibía "listo", y el incidente seguía apareciendo
            // hasta que se caía solo de la ventana de 24 horas.
            const r = await prisma.incident.updateMany({
                where: { id: sourceId, headquartersId: hqId, resolvedAt: null },
                data: { resolvedAt: new Date(), resolvedById: invokerId, resolutionNote: nota },
            });
            if (r.count > 0) affected = 'incident';
        } else if (sourceType === 'FALL') {
            const r = await prisma.fallIncident.updateMany({
                where: { id: sourceId, patient: { headquartersId: hqId }, resolvedAt: null },
                data: { resolvedAt: new Date(), resolvedById: invokerId, resolutionNote: nota },
            });
            if (r.count > 0) affected = 'fall';
        }
        // Los demás sourceType (UPP_SLA, ZENDI_*) sí se regeneran por
        // computación y no tienen fila que cerrar. Solo queda el audit log.

        // Espejo hacia el centro de triage. El mismo evento vive como ticket
        // allá; si no se cierra, dirección lo sigue viendo pendiente después
        // de que el supervisor ya lo descartó. Best-effort: la acción
        // principal ya se guardó y no se revierte por fallar el espejo.
        let ticketsCerrados = 0;
        if (affected === 'clinical_alert' || affected === 'complaint') {
            try {
                ticketsCerrados = await cerrarTicketDeOrigen(
                    sourceId, hqId, reasonTrimmed, invokerId, invokerName,
                );
            } catch (e) {
                logWarn('[void-ticket] no se pudo cerrar el ticket espejo', e as any);
            }
        }

        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: affected === 'complaint' ? 'Complaint'
                        : affected === 'clinical_alert' ? 'DailyLog' : 'TriageFeed',
                    entityId: sourceId,
                    action: SystemAuditAction.VOIDED,
                    performedById: invokerId,
                    payloadChanges: {
                        // La auditoria tambien distingue las dos: "quien cerro
                        // esto y por que" no se contesta igual si lo atendio
                        // que si lo descarto.
                        kind: accion === 'ATENDIDO' ? 'TICKET_ATENDIDO' : 'TICKET_VOIDED',
                        accion,
                        sourceType,
                        sourceId,
                        reason: reasonTrimmed || null,
                        affected,
                    } as any,
                },
            });
        } catch (e) { logWarn('care.supervisor.void_ticket.audit', e, { sourceType, sourceId }); }

        return NextResponse.json({ success: true, affected, ticketsCerrados });
    } catch (error: any) {
        logError('care.supervisor.void_ticket.post', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error descartando ticket',
        }, { status: 500 });
    }
}
