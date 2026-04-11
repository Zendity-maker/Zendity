import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const VIVID_HQ_ID = 'b5d13d84-0a57-42fe-a1ed-bff887ed0c09'

const areas = [
  // PRIMER PISO
  { name: 'Baño 1 — Primer Piso', floor: 'FIRST_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 1 },
  { name: 'Baño 2 — Primer Piso', floor: 'FIRST_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 2 },
  { name: 'Baño 3 — Primer Piso', floor: 'FIRST_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 3 },
  { name: 'Baño 4 — Primer Piso', floor: 'FIRST_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 4 },
  { name: 'Baño 5 — Primer Piso', floor: 'FIRST_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 5 },
  { name: 'Habitación', floor: 'FIRST_FLOOR', category: 'ROOM', requiresPhoto: false, order: 6, roomNumber: '' },
  { name: 'Exterior de Habitaciones', floor: 'FIRST_FLOOR', category: 'COMMON', requiresPhoto: false, order: 7 },
  { name: 'Área de Recepción', floor: 'FIRST_FLOOR', category: 'COMMON', requiresPhoto: false, order: 8 },
  { name: 'Lobby', floor: 'FIRST_FLOOR', category: 'COMMON', requiresPhoto: false, order: 9 },
  { name: 'Conference', floor: 'FIRST_FLOOR', category: 'COMMON', requiresPhoto: false, order: 10 },
  { name: 'Oficinas Administrativas', floor: 'FIRST_FLOOR', category: 'COMMON', requiresPhoto: false, order: 11 },
  { name: 'Zafacones — Todas las Áreas (Primer Piso)', floor: 'FIRST_FLOOR', category: 'TRASH', requiresPhoto: true, order: 12 },

  // SEGUNDO PISO
  { name: 'Baño 1 — Segundo Piso', floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 13 },
  { name: 'Baño 2 — Segundo Piso', floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 14 },
  { name: 'Baño 3 — Segundo Piso', floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 15 },
  { name: 'Baño 4 — Segundo Piso', floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 16 },
  { name: 'Baño 5 — Segundo Piso', floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true, order: 17 },
  { name: 'Comedor', floor: 'SECOND_FLOOR', category: 'COMMON', requiresPhoto: false, order: 18 },
  { name: 'Exterior de Habitaciones', floor: 'SECOND_FLOOR', category: 'COMMON', requiresPhoto: false, order: 19 },
  { name: 'Laundry', floor: 'SECOND_FLOOR', category: 'COMMON', requiresPhoto: false, order: 20 },
  { name: 'Superficies', floor: 'SECOND_FLOOR', category: 'COMMON', requiresPhoto: false, order: 21 },
  { name: 'Habitación', floor: 'SECOND_FLOOR', category: 'ROOM', requiresPhoto: false, order: 22, roomNumber: '' },
  { name: 'Zafacones — Todas las Áreas (Segundo Piso)', floor: 'SECOND_FLOOR', category: 'TRASH', requiresPhoto: true, order: 23 },
]

async function main() {
  console.log('Seeding cleaning areas for Vivid Senior Living...')

  await prisma.cleaningArea.createMany({
    data: areas.map(a => ({ ...a, headquartersId: VIVID_HQ_ID })),
  })

  console.log(`Done — ${areas.length} areas created.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
