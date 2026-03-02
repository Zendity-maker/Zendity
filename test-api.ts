import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const patients = await prisma.patient.findMany({
            where: { colorGroup: 'RED' },
            include: {
                vitalSigns: {
                    where: { createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
                    orderBy: { createdAt: 'desc' }
                },
                dailyLogs: {
                    where: { createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
                    orderBy: { createdAt: 'desc' }
                },
                healthAppointments: {
                    where: {
                        appointmentDate: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            lt: new Date(new Date().setHours(23, 59, 59, 999))
                        }
                    }
                }
            }
        });
        console.log("SUCCESS:", patients.length, "patients found.");
    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
