const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    try {
        const patients = await prisma.patient.findMany({
            where: { headquartersId: '49a6a75e-93cf-42e4-aa9f-69649bcbb6c0', status: "ACTIVE" },
            select: { id: true, name: true, roomNumber: true },
            orderBy: { name: 'asc' }
        });
        console.log('Success:', patients.length);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
run();
