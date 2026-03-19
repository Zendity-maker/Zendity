const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.conciergeService.deleteMany();
  console.log("✅ Servicios antiguos eliminados para forzar el Seeder Premium.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
