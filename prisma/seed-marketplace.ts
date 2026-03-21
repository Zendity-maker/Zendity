import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding Holistic Marketplace to all HQs...");
    
    const hqs = await prisma.headquarters.findMany({ select: { id: true } });
    
    for (const hq of hqs) {
        // Soft-deleting old generic services to replace with new holistic ones to prevent clutter
        await prisma.conciergeService.updateMany({
            where: { headquartersId: hq.id },
            data: { isActive: false }
        });

        // Seed Services
        await prisma.conciergeService.createMany({
            data: [
                {
                    headquartersId: hq.id,
                    name: 'Fisioterapia Preventiva (8 Sesiones/mes)',
                    description: 'Mantenga su independencia física con un plan de movimiento adaptado a su ritmo, guiado por expertos en longevidad activa.',
                    price: 320.0,
                    originalPrice: 400.0,
                    isOffer: true,
                    category: 'Salud Holística',
                    providerType: 'THERAPIST',
                    imageUrl: '/images/market/fisioterapia_senior_1774112845841.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Masaje Terapéutico Vivid Relax',
                    description: 'Un respiro de calma profunda. Alivie tensiones musculares y mejore su calidad de descanso en un entorno de paz absoluta.',
                    price: 80.0,
                    category: 'Salud Holística',
                    providerType: 'THERAPIST',
                    imageUrl: '/images/market/masaje_senior_1774112862519.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Masaje Vivid Relax (Mensual - 4 Sesiones)',
                    description: 'Un respiro de calma profunda. Alivie tensiones musculares (4 sesiones mensuales).',
                    price: 260.0,
                    originalPrice: 320.0,
                    isOffer: true,
                    category: 'Salud Holística',
                    providerType: 'THERAPIST',
                    imageUrl: '/images/market/masaje_senior_1774112862519.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Taller Mente Activa (Mensual)',
                    description: 'Desafíe a su mente. Un espacio dinámico para fortalecer las conexiones neuronales a través del juego y la interacción social.',
                    price: 150.0,
                    category: 'Estimulación Cognitiva',
                    providerType: 'SOCIAL_WORKER',
                    imageUrl: '/images/market/taller_cognitivo_senior_1774112875316.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Lazos Digitales (1 Hora)',
                    description: 'La distancia no existe. Le ayudamos a conectar con sus seres queridos y a explorar el mundo digital de forma sencilla y segura.',
                    price: 35.0,
                    category: 'Estimulación Cognitiva',
                    providerType: 'CAREGIVER',
                    imageUrl: '/images/market/asistencia_tecnologica_senior_1774112924893.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Club Estilismo y Barbería (Mensual)',
                    description: 'La elegancia no tiene edad. Un servicio de belleza profesional (2 visitas al mes) en la comodidad de nuestras instalaciones.',
                    price: 90.0,
                    category: 'Estética y Cuidado',
                    providerType: 'BEAUTY_SPECIALIST',
                    imageUrl: '/images/market/estilismo_senior_1774112895688.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Hidratación Facial Profunda',
                    description: 'Nutra su piel. Un tratamiento revitalizante que aporta luminosidad y frescura al rostro en una experiencia sensorial única.',
                    price: 65.0,
                    category: 'Estética y Cuidado',
                    providerType: 'BEAUTY_SPECIALIST',
                    imageUrl: '/images/market/spa_facial_senior_1774112939450.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Experiencia Chef en tu Suite',
                    description: 'Convierta una comida ordinaria en una celebración extraordinaria. Un menú gourmet diseñado para deleitar sus sentidos en la intimidad de su hogar.',
                    price: 120.0,
                    category: 'Gourmet y Celebraciones',
                    providerType: 'KITCHEN',
                    imageUrl: '/images/market/chef_suite_1774112910701.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Cumpleaños Premium (Actividad, Bizcocho y Música)',
                    description: 'Haga de su cumpleaños un día inolvidable. Incluye actividad especial, bizcocho de cumpleaños y música en vivo (guitarrista) para celebrar con sus seres queridos.',
                    price: 300.0,
                    category: 'Gourmet y Celebraciones',
                    providerType: 'SOCIAL_WORKER',
                    imageUrl: '/images/market/cumpleanos_premium_300_1774113676735.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Cumpleaños Deluxe (Actividad y Entremeses)',
                    description: 'Una celebración de alto nivel. Incluye actividad especial de cumpleaños y una selección premium de entremeses para sus invitados.',
                    price: 500.0,
                    category: 'Gourmet y Celebraciones',
                    providerType: 'KITCHEN',
                    imageUrl: '/images/market/cumpleanos_deluxe_500_1774113693324.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Cumpleaños VIP (Actividad, Entremeses y Catering)',
                    description: 'El evento definitivo. Una celebración de lujo que incluye actividad, entremeses y servicio de catering profesional completo para una experiencia inolvidable.',
                    price: 1000.0,
                    category: 'Gourmet y Celebraciones',
                    providerType: 'KITCHEN',
                    imageUrl: '/images/market/cumpleanos_vip_1000_1774113707465.png'
                }
            ]
        });

        // Seed Products
        const existingProducts = await prisma.conciergeProduct.findMany({
            where: { headquartersId: hq.id }
        });

        const productsToSeed = [
            {
                name: 'Canasta de Bienestar Vivid',
                description: 'El regalo perfecto para uno mismo o un ser querido. Incluye tés finos, snacks y cremas.',
                price: 45.0,
                originalPrice: 55.0,
                isOffer: true,
                category: 'Gourmet y Celebraciones',
                stock: 10,
                imageUrl: '/images/market/canasta_bienestar_1774112952708.png'
            },
            {
                name: 'Gift Card Vivid - $100',
                description: 'Regale salud y bienestar. Una tarjeta de regalo con valor de $100 dólares para que su ser querido la utilice en cualquier servicio o producto de nuestro ecosistema Vivid.',
                price: 100.0,
                originalPrice: 100.0,
                isOffer: false,
                category: 'Regalos',
                stock: 999,
                imageUrl: '/images/market/gift_card_100_1774113631877.png'
            },
            {
                name: 'Gift Card Vivid - $200',
                description: 'El regalo perfecto. Tarjeta de regalo con valor de $200 dólares para el Marketplace de Vivid (Terapias, Spa, Peluquería, y más).',
                price: 200.0,
                originalPrice: 200.0,
                isOffer: false,
                category: 'Regalos',
                stock: 999,
                imageUrl: '/images/market/gift_card_200_1774113646739.png'
            },
            {
                name: 'Gift Card Vivid - $300',
                description: 'La máxima expresión de cariño. Tarjeta de regalo con valor de $300 dólares, ideal para paquetes premium, cumpleaños o salud holística.',
                price: 300.0,
                originalPrice: 300.0,
                isOffer: false,
                category: 'Regalos',
                stock: 999,
                imageUrl: '/images/market/gift_card_300_1774113661424.png'
            }
        ];

        for (const prod of productsToSeed) {
            const existing = existingProducts.find(p => p.name === prod.name);
            if (existing) {
                // Update properties in case they changed, specifically imageUrl
                await prisma.conciergeProduct.update({
                    where: { id: existing.id },
                    data: { 
                        description: prod.description,
                        price: prod.price,
                        originalPrice: prod.originalPrice,
                        isOffer: prod.isOffer,
                        category: prod.category,
                        stock: prod.stock,
                        imageUrl: prod.imageUrl 
                    }
                });
            } else {
                await prisma.conciergeProduct.create({
                    data: {
                        headquartersId: hq.id,
                        ...prod
                    }
                });
            }
        }
    }
    console.log("Seeding complete!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
