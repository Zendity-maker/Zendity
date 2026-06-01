import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { TicketStatus, SystemAuditAction, TicketPriority } from '@prisma/client';
import { notifyRoles } from '@/lib/notifications';
import { logWarn } from '@/lib/logger';



export async function GET(request: Request) {
    // Simple sec check for cron if needed
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
         return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();
        const threshold120m = new Date(now.getTime() - 120 * 60 * 1000);

        // 1. Escalar Triage Tickets (HIGH) no resueltos tras 120 min
        const overdueTickets = await prisma.triageTicket.findMany({
            where: {
                priority: TicketPriority.HIGH,
                status: { not: TicketStatus.RESOLVED },
                isEscalated: false,
                createdAt: { lt: threshold120m }
            },
            include: { patient: { select: { name: true } } }
        });

        for (const ticket of overdueTickets) {
            await prisma.triageTicket.update({
                where: { id: ticket.id },
                data: {
                    isEscalated: true,
                    escalatedAt: now
                }
            });
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: ticket.headquartersId,
                    entityName: 'TriageTicket',
                    entityId: ticket.id,
                    action: SystemAuditAction.ESCALATED,
                    clientIp: 'SystemCRON',
                    payloadChanges: { reason: 'SLA_BREACH_120M' }
                }
            });

            // FIX 2026-05-31: el TODO histórico ahora sí dispara notificación.
            // Antes la escalación era pasiva (solo flag isEscalated en BD); el
            // director/supervisor solo veía el badge "Escalado" si abría
            // /corporate/triage y refrescaba. Ahora notifica activamente para
            // que el ticket no muera por silencio.
            try {
                const ageMin = Math.floor((now.getTime() - new Date(ticket.createdAt).getTime()) / 60000);
                const patientLabel = ticket.patient?.name ? `${ticket.patient.name} — ` : '';
                const descShort = (ticket.description || '').slice(0, 100);
                await notifyRoles(ticket.headquartersId, ['DIRECTOR', 'SUPERVISOR'], {
                    type: 'TRIAGE',
                    title: '🚨 Ticket escalado por SLA',
                    message: `${patientLabel}Sin resolver hace ${ageMin}min. ${descShort}`,
                    link: '/corporate/triage',
                });
            } catch (e) {
                logWarn('cron.operational.escalation_notify', e, { ticketId: ticket.id });
            }
        }

        // (Sprint A) Bloque de auto-cierre de ShiftClosure eliminado — el modelo
        // será dropeado en Sprint B cuando se unifique todo en ShiftHandover.

        return NextResponse.json({
            success: true,
            escalatedTickets: overdueTickets.length
        });

    } catch (error) {
        console.error("Cron Operational Error:", error);
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    }
}
