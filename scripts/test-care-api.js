const { PrismaClient } = require('@prisma/client');
const { startOfDay, endOfDay } = require('date-fns');

const prisma = new PrismaClient();

async function main() {
    try {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const patients = await prisma.patient.findMany({
            where: {
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] }
            },
            include: {
                medications: { include: { medication: true } },
                lifePlan: true,
                mealLogs: {
                    where: { timeLogged: { gte: todayStart, lte: todayEnd } },
                    select: { id: true, mealType: true }
                },
                vitalSigns: {
                    where: { createdAt: { gte: todayStart, lte: todayEnd } },
                    select: { id: true },
                    take: 1
                },
                bathLogs: {
                    where: { timeLogged: { gte: todayStart, lte: todayEnd } },
                    select: { id: true },
                    take: 1
                }
            },
            orderBy: { name: 'asc' }
        });
        console.log("Success! Patients count:", patients.length);
    } catch (e) {
        console.error("PRISMA CRASHED:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
