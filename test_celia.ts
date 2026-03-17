import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const celia = await prisma.user.findMany({
    where: { name: { contains: 'Celia', mode: 'insensitive' } }
  })
  console.log(JSON.stringify(celia, null, 2))
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
