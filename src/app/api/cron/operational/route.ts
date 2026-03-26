import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import {  TicketStatus, SystemAuditAction, ShiftClosureStatus, TicketPriority } from '@prisma/client';



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
            }
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
            // TODO: Enviar Push notification a Director
        }

        // 2. Marcar Shift Closures como Abandonados (sin firmas tras +60 min del fin de turno)
        // Asumimos un margen simplificado: buscaremos turnos de hace más de 12 horas que sigan PENDING
        const shiftThreshold = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        const abandonedShifts = await prisma.shiftClosure.findMany({
            where: {
                status: ShiftClosureStatus.PENDING,
                shiftDate: { lt: shiftThreshold }
            }
        });

        for (const shift of abandonedShifts) {
            await prisma.shiftClosure.update({
                where: { id: shift.id },
                data: {
                    status: ShiftClosureStatus.ABANDONED
                }
            });
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: shift.headquartersId,
                    entityName: 'ShiftClosure',
                    entityId: shift.id,
                    action: SystemAuditAction.SYSTEM_ABANDONED,
                    clientIp: 'SystemCRON',
                    payloadChanges: { autoAbandoned: true }
                }
            });
        }

        return NextResponse.json({
            success: true,
            escalatedTickets: overdueTickets.length,
            abandonedShifts: abandonedShifts.length
        });

    } catch (error) {
        console.error("Cron Operational Error:", error);
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    }
}
