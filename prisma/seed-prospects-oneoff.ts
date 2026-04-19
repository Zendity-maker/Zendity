import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const prospects = [
  { name: 'Hogar Casa Feliz, Inc.', municipality: 'Bayamón', phone: '787-995-6333', priority: 'ALTA' as const },
  { name: 'Hogar Arcángel Gabriel', municipality: 'Bayamón', phone: '787-730-4118', priority: 'ALTA' as const },
  { name: 'Floramor LLC', municipality: 'Bayamón', phone: '787-649-7146', priority: 'ALTA' as const },
  { name: 'Jardín de Vida, Inc.', municipality: 'Bayamón', phone: '787-294-6727', priority: 'ALTA' as const },
  { name: 'Hogar Ileaner Declet Rosa', municipality: 'Bayamón', phone: '787-294-6275', priority: 'ALTA' as const },
  { name: 'Hogar Urb. San Martín', municipality: 'San Juan', phone: '787-319-5479', priority: 'ALTA' as const },
  { name: 'Hogar Urb. Monte Rey', municipality: 'San Juan', phone: '787-758-4368', priority: 'ALTA' as const },
  { name: 'Hogar Jard. Metropolitano', municipality: 'San Juan', phone: '787-758-4242', priority: 'MEDIA' as const },
  { name: 'Hogar Ave. Ponce de León', municipality: 'San Juan', phone: '787-268-6530', priority: 'MEDIA' as const },
  { name: 'Hogar Cupey Alto', municipality: 'San Juan', phone: '787-293-3249', priority: 'ALTA' as const },
  { name: 'Hogar Mi Querido Viejo', municipality: 'Arecibo', phone: '787-384-0380', priority: 'ALTA' as const },
  { name: 'Hogar Lomas Verdes', municipality: 'Bayamón', phone: '787-995-0090', priority: 'MEDIA' as const },
  { name: 'Hogar Carr. 816', municipality: 'Bayamón', phone: '787-214-1114', priority: 'MEDIA' as const },
  { name: 'Hogar Carr. 830 Ramal 829', municipality: 'Bayamón', phone: '787-730-8848', priority: 'MEDIA' as const },
  { name: 'Inst. Hogar Ponce', municipality: 'Ponce', phone: '787-843-2364', priority: 'ALTA' as const },
  { name: 'Hogar Jardines de Fagot', municipality: 'Ponce', phone: '787-840-5333', priority: 'ALTA' as const },
  { name: 'Hogar Ponce Sabaneta', municipality: 'Ponce', phone: '787-813-5738', priority: 'MEDIA' as const },
  { name: 'Hogar Villa Carolina', municipality: 'Carolina', priority: 'ALTA' as const },
  { name: 'Hogar Lomas de Carolina', municipality: 'Carolina', priority: 'MEDIA' as const },
  { name: 'Hogar Trujillo Alto', municipality: 'Trujillo Alto', priority: 'MEDIA' as const },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const p of prospects) {
    const existing = await prisma.saaSProspect.findFirst({ where: { name: p.name } });
    if (existing) { skipped++; continue; }
    await prisma.saaSProspect.create({ data: p });
    created++;
  }
  console.log(`✅ Creados: ${created}  ·  Ya existían: ${skipped}  ·  Total en DB: ${await prisma.saaSProspect.count()}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
