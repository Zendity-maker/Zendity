const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hqs = await prisma.headquarters.findMany();
  console.log("All HQs:", hqs.map(h => ({ id: h.id, name: h.name })));

  const c = await prisma.complaint.findMany({ select: { id: true, headquartersId: true }});
  console.log("Complaints HQs:", c);

  const d = await prisma.dailyLog.findMany({ where: { isClinicalAlert: true }, select: { id: true, patient: { select: { headquartersId: true } } }});
  console.log("Clinical Alerts HQs:", d);
}
main().catch(console.error).finally(() => prisma.$disconnect());
