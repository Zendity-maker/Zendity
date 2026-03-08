const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.complaint.findMany({ select: { id: true, headquartersId: true, status: true } });
  console.log("Complaints:", c);

  const ev = await prisma.headquartersEvent.findMany({ where: { type: 'OTHER' }, select: { id: true, type: true, status: true } });
  console.log("HQ Events (Incidents):", ev);

  const d = await prisma.dailyLog.findMany({ where: { isClinicalAlert: true }, select: { id: true, isResolved: true } });
  console.log("Clinical Alerts:", d);
}
main().catch(console.error).finally(() => prisma.$disconnect());
