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
                    imageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=800'
                },
                {
                    headquartersId: hq.id,
                    name: 'Masaje Terapéutico Zendity Relax',
                    description: 'Un respiro de calma profunda. Alivie tensiones musculares y mejore su calidad de descanso en un entorno de paz absoluta.',
                    price: 80.0,
                    category: 'Salud Holística',
                    providerType: 'THERAPIST',
                    imageUrl: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&q=80&w=800'
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
                    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=800'
                },
                {
                    headquartersId: hq.id,
                    name: 'Taller Mente Activa (Mensual)',
                    description: 'Desafíe a su mente. Un espacio dinámico para fortalecer las conexiones neuronales a través del juego y la interacción social.',
                    price: 150.0,
                    category: 'Estimulación Cognitiva',
                    providerType: 'SOCIAL_WORKER',
                    imageUrl: 'https://images.unsplash.com/photo-1516534775068-ba3e7458af70?auto=format&fit=crop&q=80&w=800'
                },
                {
                    headquartersId: hq.id,
                    name: 'Lazos Digitales (1 Hora)',
                    description: 'La distancia no existe. Le ayudamos a conectar con sus seres queridos y a explorar el mundo digital de forma sencilla y segura.',
                    price: 35.0,
                    category: 'Estimulación Cognitiva',
                    providerType: 'CAREGIVER',
                    imageUrl: 'https://images.unsplash.com/photo-1588196749597-9ff0464b2805?auto=format&fit=crop&q=80&w=800'
                },
                {
                    headquartersId: hq.id,
                    name: 'Club Estilismo y Barbería (Mensual)',
                    description: 'La elegancia no tiene edad. Un servicio de belleza profesional (2 visitas al mes) en la comodidad de nuestras instalaciones.',
                    price: 90.0,
                    category: 'Estética y Cuidado',
                    providerType: 'BEAUTY_SPECIALIST',
                    imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800'
                },
                {
                    headquartersId: hq.id,
                    name: 'Hidratación Facial Profunda',
                    description: 'Nutra su piel. Un tratamiento revitalizante que aporta luminosidad y frescura al rostro en una experiencia sensorial única.',
                    price: 65.0,
                    category: 'Estética y Cuidado',
                    providerType: 'BEAUTY_SPECIALIST',
                    imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=800'
                },
                {
                    headquartersId: hq.id,
                    name: 'Experiencia Chef en tu Suite',
                    description: 'Convierta una comida ordinaria en una celebración extraordinaria. Un menú gourmet diseñado para deleitar sus sentidos en la intimidad de su hogar.',
                    price: 120.0,
                    category: 'Gourmet y Celebraciones',
                    providerType: 'KITCHEN',
                    imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=800'
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
                    imageUrl: 'https://images.unsplash.com/photo-1608660897701-d779f06ce2a1?auto=format&fit=crop&q=80&w=800'
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
