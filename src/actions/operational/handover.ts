"use server";
import { prisma } from '@/lib/prisma';
import {  ShiftType, NursingHandoverStatus, SystemAuditAction, FlagReason, Role } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from './audit';
import { revalidatePath } from 'next/cache';



export async function submitNursingHandover(data: {
    shiftDate: Date | string;
    shiftType: ShiftType;
    signatureOutBase64: string;
    notes: { patientId: string; flagReason: FlagReason; nursingNote: string }[];
}) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || !session.user || ![Role.NURSE, Role.DIRECTOR].includes(session.user.role)) {
        return { success: false, error: 'Unauthorized Role' };
    }
    
    // @ts-ignore
    const hqId = session.user.headquartersId;
    // @ts-ignore
    const userId = session.user.id;

    try {
        // Validar obligatoriedad de nota si es un Flag clínico
        for (const note of data.notes) {
            if (!note.nursingNote || note.nursingNote.trim().length === 0) {
                return { success: false, error: 'BLOCKED_BY_VALIDATION', message: 'Falta nota obligatoria para paciente con bandera clínica.' };
            }
        }

        const handover = await prisma.nursingHandover.create({
            data: {
                headquartersId: hqId,
                shiftDate: new Date(data.shiftDate),
                shiftType: data.shiftType,
                nurseOutId: userId,
                status: NursingHandoverStatus.SUBMITTED,
                signatureOutBase64: data.signatureOutBase64,
                signedOutAt: new Date(),
                notes: {
                    create: data.notes
                }
            }
        });

        await createAuditLog(hqId, 'NursingHandover', handover.id, SystemAuditAction.SIGNED_OUT, { notesCount: data.notes.length });
        revalidatePath('/nursing/handovers');
        return { success: true, handover };
    } catch (error) {
        console.error("Handover Error:", error);
        return { success: false, error: 'Internal Server Error' };
    }
}

export async function acceptNursingHandover(handoverId: string, signatureInBase64: string) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || !session.user || ![Role.NURSE, Role.DIRECTOR].includes(session.user.role)) {
        return { success: false, error: 'Unauthorized Role' };
    }
    
    // @ts-ignore
    const hqId = session.user.headquartersId;
    // @ts-ignore
    const userId = session.user.id;

    try {
        const handover = await prisma.nursingHandover.update({
            where: { id: handoverId },
            data: {
                status: NursingHandoverStatus.ACCEPTED,
                nurseInId: userId,
                signatureInBase64,
                signedInAt: new Date()
            }
        });

        await createAuditLog(hqId, 'NursingHandover', handover.id, SystemAuditAction.ACCEPTED_IN, {});
        revalidatePath('/nursing/handovers');
        return { success: true, handover };
    } catch (error) {
        return { success: false, error };
    }
}
