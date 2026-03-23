import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const incidents = await prisma.incidentReport.findMany({
    include: {
      employee: { select: { name: true, email: true } },
      supervisor: { select: { name: true } },
    }
  });
  
  console.log(`Total incidents found: ${incidents.length}`);
  
  if (incidents.length > 0) {
    console.log(JSON.stringify(incidents, null, 2));
  } else {
    // Also check if Joaneliz exists to see her ID
    const users = await prisma.user.findMany({
      where: { name: { contains: "joaneliz", mode: "insensitive" } }
    });
    console.log("Users matching Joaneliz:");
    console.log(users.map(u => ({ id: u.id, name: u.name, hqId: u.headquartersId })));
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
