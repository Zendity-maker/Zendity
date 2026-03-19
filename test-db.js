const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const families = await prisma.familyMember.findMany();
  console.log('Familias registradas:', families);
}
main().catch(console.error).finally(() => prisma.$disconnect());
