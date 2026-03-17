import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: { name: true, role: true, isDeleted: true, isActive: true }
  })
  console.log(JSON.stringify(users, null, 2))
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
