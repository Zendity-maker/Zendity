const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulate(email) {
    console.log("Testeando para:", email);
    try {
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: email }
        });

        if (!familyMember || !familyMember.patientId) {
            console.log("No familiar o patientId", familyMember);
            return;
        }

        const resident = await prisma.patient.findUnique({
            where: { id: familyMember.patientId },
            include: {
                headquarters: true,
                lifePlan: {
                    select: {
                        id: true,
                        status: true
                    }
                },
                vitalSigns: { orderBy: { createdAt: 'desc' }, take: 5 },
                dailyLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
                wellnessNotes: { orderBy: { createdAt: 'desc' }, take: 5 },
                medications: { include: { medication: true } },
                invoices: { orderBy: { issueDate: 'desc' }, include: { items: true } }
            }
        });

        console.log("✅ Exito! Resident ID:", resident?.id, "LifePlan:", resident?.lifePlan);
    } catch(e) {
        console.error("❌ ERROR AL HACER QUERY:", e.message);
    }
}

async function main() {
  await simulate('hija@vividcupey.com');
  await simulate('testfam@test.com');
  await simulate('andrestyflores2@gmail.com');
}

main().catch(console.error).finally(() => prisma.$disconnect());
