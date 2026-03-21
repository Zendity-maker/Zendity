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
                    name: 'Masaje Terapéutico Zendity Relax',
                    description: 'Un respiro de calma profunda. Alivie tensiones musculares y mejore su calidad de descanso en un entorno de paz absoluta.',
                    price: 80.0,
                    category: 'Salud Holística',
                    providerType: 'THERAPIST',
                    imageUrl: '/images/market/masaje_senior_1774112862519.png'
                },
                {
                    headquartersId: hq.id,
                    name: 'Masaje Zendity Relax (Mensual - 4 Sesiones)',
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
                }
            ]
        });

        // Seed Product
        // Ensure "Canasta Bienestar Zendity" exists
        const existsCanasta = await prisma.conciergeProduct.findFirst({
            where: { headquartersId: hq.id, name: 'Canasta de Bienestar Zendity' }
        });

        if (!existsCanasta) {
            await prisma.conciergeProduct.create({
                data: {
                    headquartersId: hq.id,
                    name: 'Canasta de Bienestar Zendity',
                    description: 'El regalo perfecto para uno mismo o un ser querido. Incluye tés finos, snacks y cremas.',
                    price: 45.0,
                    originalPrice: 55.0,
                    isOffer: true,
                    category: 'Gourmet y Celebraciones',
                    stock: 10,
                    imageUrl: '/images/market/canasta_bienestar_1774112952708.png'
                }
            });
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
