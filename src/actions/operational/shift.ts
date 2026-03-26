import { prisma } from '@/lib/prisma';
"use server";
import {  ShiftType, ShiftClosureStatus, SystemAuditAction, Role } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from './audit';
import { revalidatePath } from 'next/cache';



export async function createShiftClosure(data: {
    shiftDate: Date | string;
    shiftType: ShiftType;
    handoverNotes?: string;
    signatureOutBase64: string;
    isOverridden?: boolean;
}) {
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
        // 1. Validar Triage Tickets críticos abiertos
        const blockingTicketsCount = await prisma.triageTicket.count({
            where: { 
                headquartersId: hqId, 
                status: { not: 'RESOLVED' },
                priority: { in: ['HIGH', 'CRITICAL'] },
                isVoided: false
            }
        });

        if (blockingTicketsCount > 0 && !data.isOverridden) {
            return { success: false, error: 'BLOCKED_BY_TRIAGE', message: `Existen ${blockingTicketsCount} tickets urgentes abiertos.` };
        }

        // 2. Validar Handover de Enfermería
        const handover = await prisma.nursingHandover.findFirst({
            where: {
                headquartersId: hqId,
                shiftDate: new Date(data.shiftDate),
                shiftType: data.shiftType,
                status: { in: ['SUBMITTED', 'ACCEPTED'] }
            }
        });

        if (!handover && !data.isOverridden) {
            return { success: false, error: 'BLOCKED_BY_HANDOVER', message: 'Falta la entrega de guardia clínica.' };
        }

        // Verificar existencia
        const existing = await prisma.shiftClosure.findUnique({
            where: {
                headquartersId_shiftDate_shiftType: {
                    headquartersId: hqId,
                    shiftDate: new Date(data.shiftDate),
                    shiftType: data.shiftType
                }
            }
        });

        if (existing) {
             return { success: false, error: 'Shift closure already exists for this shift' };
        }

        const closure = await prisma.shiftClosure.create({
            data: {
                headquartersId: hqId,
                shiftDate: new Date(data.shiftDate),
                shiftType: data.shiftType,
                supervisorOutId: userId,
                handoverNotes: data.handoverNotes,
                status: ShiftClosureStatus.SIGNED_OUT,
                signatureOutBase64: data.signatureOutBase64,
                signedOutAt: new Date(),
                isOverridden: data.isOverridden || false,
                triageSnapshot: { blockingTicketsCount, handoverExists: !!handover }
            }
        });

        await createAuditLog(hqId, 'ShiftClosure', closure.id, SystemAuditAction.SIGNED_OUT, { isOverridden: data.isOverridden });
        revalidatePath('/corporate/shift-closure');
        return { success: true, closure };
    } catch (error) {
        console.error("Shift Closure Error:", error);
        return { success: false, error: 'Internal Server Error' };
    }
}

export async function acceptShiftClosure(closureId: string, signatureInBase64: string) {
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
        const closure = await prisma.shiftClosure.update({
            where: { id: closureId },
            data: {
                status: ShiftClosureStatus.ACCEPTED_IN,
                supervisorInId: userId,
                signatureInBase64,
                signedInAt: new Date()
            }
        });

        await createAuditLog(hqId, 'ShiftClosure', closure.id, SystemAuditAction.ACCEPTED_IN, {});
        revalidatePath('/corporate/shift-closure');
        return { success: true, closure };
    } catch (error) {
        return { success: false, error };
    }
}
