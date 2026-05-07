import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const hqId = 'b5d13d84-0a57-42fe-a1ed-bff887ed0c09'; // Vivid Senior Living Cupey

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
            originalPrice: null,
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
            originalPrice: null,
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
            originalPrice: null,
        },
    ];

    for (const p of products) {
        // Check if already exists
        const exists = await prisma.conciergeProduct.findFirst({
            where: { headquartersId: hqId, name: p.name }
        });
        if (exists) {
            console.log(`Already exists: ${p.name}`);
            continue;
        }
        const created = await prisma.conciergeProduct.create({
            data: { ...p, headquartersId: hqId }
        });
        console.log(`Created: ${created.name} (${created.id})`);
    }
    console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
