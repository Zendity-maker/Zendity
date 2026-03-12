import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Testing Queries...");
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        console.log("1. Patients");
        const act = await prisma.patient.findMany({ select: { id: true }, take: 2 });
        console.log(act);

        console.log("2. Meds");
        const meds = await prisma.medicationAdministration.count({
            where: {
                status: 'ADMINISTERED',
                timeLogged: {
                    gte: todayStart,
                    lte: todayEnd
                }
            }
        });
        console.log("Meds:", meds);

        console.log("3. Incidents");
        const inc = await prisma.complaint.count({
            where: {
                status: {
                    in: ['PENDING', 'ROUTED_NURSING']
                }
            }
        });
        console.log("Inc:", inc);

        console.log("4. Ulcers");
        const ulc = await prisma.pressureUlcer.count({
            where: {
                status: 'ACTIVE'
            }
        });
        console.log("Ulc:", ulc);

        console.log("All success!");
    } catch (e) {
        console.error("FAILED AT PRISMA:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
