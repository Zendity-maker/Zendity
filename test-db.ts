import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking DB...");
    const user = await prisma.user.findUnique({
        where: { email: 'admin@vividcupey.com' }
    });
    console.log("User:", user);

    const hq = await prisma.headquarters.findFirst();
    console.log("HQ:", hq);
}

main().catch(console.error).finally(() => prisma.$disconnect());
