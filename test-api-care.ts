import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

async function test() {
    try {
        const color = 'YELLOW';
        const hqId = '49a6a75e-93cf-42e4-aa9f-69649bcbb6c0';

        const patients = await prisma.patient.findMany({
            where: {
                colorGroup: color as any,
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] }
            },
            include: {
                medications: { include: { medication: true } },
                lifePlans: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { name: 'asc' }
        });

        console.log("Patients length:", patients.length);

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const events = await prisma.headquartersEvent.findMany({
            where: {
                headquartersId: hqId,
                startTime: { gte: todayStart, lte: todayEnd }
            },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });
        console.log("Events length:", events.length);
    } catch(e) {
        console.error("ERROR CAUGHT:");
        console.error(e);
    }
}
test();
