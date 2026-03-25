"use server";
import { PrismaClient, SystemAuditAction } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function createAuditLog(
    headquartersId: string,
    entityName: string,
    entityId: string,
    action: SystemAuditAction,
    payloadChanges?: any
) {
    try {
        const session = await getServerSession(authOptions);
        // @ts-ignore
        const performedById = session?.user?.id || null;
        
        const clientIp = "ServerAction";

        await prisma.systemAuditLog.create({
            data: {
                headquartersId,
                entityName,
                entityId,
                action,
                performedById,
                payloadChanges: payloadChanges || {},
                clientIp
            }
        });
    } catch (error) {
        console.error("Error creating audit log:", error);
    }
}
