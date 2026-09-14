import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { TicketStatus, SystemAuditAction, TicketPriority } from '@prisma/client';
import { notifyRoles } from '@/lib/notifications';
import { logWarn } from '@/lib/logger';
import { requireCronSecret } from '@/lib/cron-auth';
import { marcarDosisVencidas } from '@/lib/emar-schedule';



export async function GET(request: Request) {
    const denied = requireCronSecret(request);
    if (denied) return denied;

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

        /**
         * ── LA DOSIS QUE NO SE DIO ────────────────────────────────────────
         *
         * `marcarDosisVencidas()` existía desde que se escribió el módulo y NO
         * LA LLAMABA NADIE. Cero invocadores en todo el repo.
         *
         * Es la otra mitad del agujero del 14-sep-2026: el cron de las 6:01
         * materializa las dosis del día y este las cierra. Sin este, aquél solo
         * acumularía PENDING para siempre —el cumplimiento bajaría todo el día
         * sin resolverse nunca— y sin aquél, éste no tiene nada que marcar.
         * Ninguno de los dos servía solo, y por eso el eMAR llevaba cinco meses
         * con 26.535 ADMINISTERED, 3 OMITTED y ni un solo MISSED jamás.
         *
         * Va en el cron horario y no en uno nuevo porque la gracia son dos
         * horas: revisar cada hora es la cadencia que le corresponde.
         */
        let dosisVencidas = 0;
        try {
            dosisVencidas = await marcarDosisVencidas();
            if (dosisVencidas > 0) {
                console.log(`[cron/operational] ${dosisVencidas} dosis marcadas como no administradas`);
            }
        } catch (e) {
            // No tumba el resto del cron, pero se nombra. El fallo mudo es lo
            // que escondió este módulo durante cinco meses.
            logWarn('cron.operational.dosis_vencidas', e);
        }

        return NextResponse.json({
            success: true,
            escalatedTickets: overdueTickets.length,
            dosisVencidas,
        });

    } catch (error) {
        console.error("Cron Operational Error:", error);
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    }
}
