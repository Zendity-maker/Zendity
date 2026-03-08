const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const complaints = await prisma.complaint.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log("Complaints:", complaints.map(c => ({ id: c.id, hqId: c.headquartersId, description: c.description })));

  const hqEvents = await prisma.headquartersEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log("HQEvents:", hqEvents.map(c => ({ id: c.id, hqId: c.headquartersId, type: c.type, description: c.description })));

  const dailyLogs = await prisma.dailyLog.findMany({ where: { isClinicalAlert: true }, orderBy: { createdAt: 'desc' }, take: 5 });
  console.log("DailyLogs (Clinical):", dailyLogs.map(c => ({ id: c.id, patientId: c.patientId, isResolved: c.isResolved, notes: c.notes })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
