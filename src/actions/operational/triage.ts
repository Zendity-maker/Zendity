"use server";
import { PrismaClient, TicketPriority, TicketOriginType, TicketStatus, SystemAuditAction, Role } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from './audit';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function createTriageTicket(data: {
    originType: TicketOriginType;
    description: string;
    priority?: TicketPriority;
    patientId?: string;
    originReferenceId?: string;
}) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || !session.user || ![Role.SUPERVISOR, Role.DIRECTOR, Role.NURSE].includes(session.user.role)) {
        return { success: false, error: 'Unauthorized Role' };
    }
    
    // @ts-ignore
    const hqId = session.user.headquartersId;

    try {
        const ticket = await prisma.triageTicket.create({
            data: {
                headquartersId: hqId,
                originType: data.originType,
                description: data.description,
                priority: data.priority || 'MEDIUM',
                patientId: data.patientId,
                originReferenceId: data.originReferenceId,
            }
        });

        await createAuditLog(hqId, 'TriageTicket', ticket.id, SystemAuditAction.CREATED, { data });
        revalidatePath('/corporate/triage');
        return { success: true, ticket };
    } catch (error) {
        console.error("Create Triage Error:", error);
        return { success: false, error: 'Internal Server Error' };
    }
}

export async function resolveTriageTicket(ticketId: string, resolutionNote: string) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || !session.user || ![Role.SUPERVISOR, Role.DIRECTOR].includes(session.user.role)) {
        return { success: false, error: 'Unauthorized Role' };
    }
    
    // @ts-ignore
    const hqId = session.user.headquartersId;
    // @ts-ignore
    const userId = session.user.id;

    try {
        const ticket = await prisma.triageTicket.update({
            where: { id: ticketId },
            data: {
                status: TicketStatus.RESOLVED,
                resolutionNote,
                resolvedById: userId,
                resolvedAt: new Date()
            }
        });

        await createAuditLog(hqId, 'TriageTicket', ticket.id, SystemAuditAction.RESOLVED, { resolutionNote });
        revalidatePath('/corporate/triage');
        return { success: true, ticket };
    } catch (error) {
        return { success: false, error };
    }
}
