const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const hqs = await prisma.headquarters.findMany({
            select: { id: true, name: true }
        });
        console.log(JSON.stringify(hqs, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
