/**
 * prisma/seed-ensure.ts
 *
 * Carga productos Ensure (suplemento nutricional) al catálogo Concierge.
 * Acompaña al catálogo base sembrado por prisma/seed.ts.
 *
 * USO:
 *   - Seed al primer HQ:
 *     export $(cat .env | grep -v '^#' | xargs) && npx tsx prisma/seed-ensure.ts
 *   - Seed a una sede específica:
 *     SEED_HQ_ID=<uuid> npx tsx prisma/seed-ensure.ts
 *
 * Idempotente: findFirst por (headquartersId, name). Si existe, lo salta.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const products = [
    {
        name: 'Ensure Original Vainilla — Pack 24',
        description: 'Suplemento nutricional completo, sabor vainilla. Pack de 24 unidades (8 fl oz c/u). Ideal para complementar la alimentación diaria.',
        price: 54.99,
        imageUrl: '/images/market/ensure_vainilla_pack24.jpg',
        category: 'Nutrición',
        stock: 20,
        isActive: true,
        isOffer: false,
        originalPrice: null as number | null,
    },
    {
        name: 'Ensure Original Chocolate — Pack 24',
        description: 'Suplemento nutricional completo, sabor chocolate. Pack de 24 unidades (8 fl oz c/u). Rico en proteínas y vitaminas esenciales.',
        price: 54.99,
        imageUrl: '/images/market/ensure_chocolate_pack24.jpg',
        category: 'Nutrición',
        stock: 20,
        isActive: true,
        isOffer: false,
        originalPrice: null as number | null,
    },
    {
        name: 'Ensure Original Fresa — Pack 24',
        description: 'Suplemento nutricional completo, sabor fresa. Pack de 24 unidades (8 fl oz c/u). Fuente de 27 vitaminas y minerales.',
        price: 54.99,
        imageUrl: '/images/market/ensure_fresa_pack24.jpg',
        category: 'Nutrición',
        stock: 20,
        isActive: true,
        isOffer: false,
        originalPrice: null as number | null,
    },
];

async function main() {
    // HQ dinámico: SEED_HQ_ID env var o primer HQ por createdAt asc
    let targetHqId = process.env.SEED_HQ_ID;
    let hqName = '(desconocido)';

    if (!targetHqId) {
        const hq = await prisma.headquarters.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true },
        });
        if (!hq) {
            console.error('❌ No HQ found. Crea una sede primero o pasa SEED_HQ_ID=<uuid>.');
            process.exit(1);
        }
        targetHqId = hq.id;
        hqName = hq.name;
    } else {
        const hq = await prisma.headquarters.findUnique({
            where: { id: targetHqId },
            select: { name: true },
        });
        if (!hq) {
            console.error(`❌ HQ con id ${targetHqId} no existe.`);
            process.exit(1);
        }
        hqName = hq.name;
    }

    console.log(`Seeding Ensure products para "${hqName}" (${targetHqId})\n`);

    let created = 0;
    let skipped = 0;

    for (const product of products) {
        const exists = await prisma.conciergeProduct.findFirst({
            where: { headquartersId: targetHqId, name: product.name },
            select: { id: true },
        });
        if (exists) {
            skipped++;
            console.log(`  ↪ ya existe: ${product.name}`);
            continue;
        }
        const result = await prisma.conciergeProduct.create({
            data: { ...product, headquartersId: targetHqId },
        });
        created++;
        console.log(`  ✓ creado   : ${result.name} ($${result.price})`);
    }

    console.log(`\n✅ Done — ${created} creados, ${skipped} sin cambios. Total: ${products.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
