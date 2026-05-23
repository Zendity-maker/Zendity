/**
 * prisma/seed-cleaning.ts
 *
 * Restaurar las 23 áreas de limpieza de Vivid Senior Living tras el wipe
 * del 20-may-2026.
 *
 * USO:
 *   - Seed al primer HQ (por createdAt asc):
 *     export $(cat .env | grep -v '^#' | xargs) && npx tsx prisma/seed-cleaning.ts
 *   - Seed a una sede específica:
 *     SEED_HQ_ID=<uuid> npx tsx prisma/seed-cleaning.ts
 *
 * Idempotente: findFirst + create — si el área ya existe, no la duplica
 * pero la reactiva (isActive: true). Seguro de correr múltiples veces.
 *
 * NO toca CleaningLog, CleaningRequest ni ninguna otra tabla.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface AreaSeed {
    name: string;
    floor: 'FIRST_FLOOR' | 'SECOND_FLOOR';
    category: 'BATHROOM' | 'ROOM' | 'COMMON' | 'TRASH';
    requiresPhoto: boolean;
    order: number;
    roomNumber?: string;
}

const areas: AreaSeed[] = [
    // ── PRIMER PISO (12 áreas) ──
    { name: 'Baño 1 — Primer Piso',           floor: 'FIRST_FLOOR',  category: 'BATHROOM', requiresPhoto: true,  order: 1  },
    { name: 'Baño 2 — Primer Piso',           floor: 'FIRST_FLOOR',  category: 'BATHROOM', requiresPhoto: true,  order: 2  },
    { name: 'Baño 3 — Primer Piso',           floor: 'FIRST_FLOOR',  category: 'BATHROOM', requiresPhoto: true,  order: 3  },
    { name: 'Baño 4 — Primer Piso',           floor: 'FIRST_FLOOR',  category: 'BATHROOM', requiresPhoto: true,  order: 4  },
    { name: 'Baño 5 — Primer Piso',           floor: 'FIRST_FLOOR',  category: 'BATHROOM', requiresPhoto: true,  order: 5  },
    { name: 'Habitación',                     floor: 'FIRST_FLOOR',  category: 'ROOM',     requiresPhoto: false, order: 6, roomNumber: '' },
    { name: 'Exterior de Habitaciones',       floor: 'FIRST_FLOOR',  category: 'COMMON',   requiresPhoto: false, order: 7  },
    { name: 'Área de Recepción',              floor: 'FIRST_FLOOR',  category: 'COMMON',   requiresPhoto: false, order: 8  },
    { name: 'Lobby',                          floor: 'FIRST_FLOOR',  category: 'COMMON',   requiresPhoto: false, order: 9  },
    { name: 'Conference',                     floor: 'FIRST_FLOOR',  category: 'COMMON',   requiresPhoto: false, order: 10 },
    { name: 'Oficinas Administrativas',       floor: 'FIRST_FLOOR',  category: 'COMMON',   requiresPhoto: false, order: 11 },
    { name: 'Zafacones — Todas las Áreas (Primer Piso)',  floor: 'FIRST_FLOOR',  category: 'TRASH', requiresPhoto: true,  order: 12 },

    // ── SEGUNDO PISO (11 áreas) ──
    { name: 'Baño 1 — Segundo Piso',          floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true,  order: 13 },
    { name: 'Baño 2 — Segundo Piso',          floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true,  order: 14 },
    { name: 'Baño 3 — Segundo Piso',          floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true,  order: 15 },
    { name: 'Baño 4 — Segundo Piso',          floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true,  order: 16 },
    { name: 'Baño 5 — Segundo Piso',          floor: 'SECOND_FLOOR', category: 'BATHROOM', requiresPhoto: true,  order: 17 },
    { name: 'Comedor',                        floor: 'SECOND_FLOOR', category: 'COMMON',   requiresPhoto: false, order: 18 },
    { name: 'Exterior de Habitaciones',       floor: 'SECOND_FLOOR', category: 'COMMON',   requiresPhoto: false, order: 19 },
    { name: 'Laundry',                        floor: 'SECOND_FLOOR', category: 'COMMON',   requiresPhoto: false, order: 20 },
    { name: 'Superficies',                    floor: 'SECOND_FLOOR', category: 'COMMON',   requiresPhoto: false, order: 21 },
    { name: 'Habitación',                     floor: 'SECOND_FLOOR', category: 'ROOM',     requiresPhoto: false, order: 22, roomNumber: '' },
    { name: 'Zafacones — Todas las Áreas (Segundo Piso)', floor: 'SECOND_FLOOR', category: 'TRASH', requiresPhoto: true,  order: 23 },
];

async function main() {
    // HQ dinámico: acepta SEED_HQ_ID env var, o usa el primer HQ por createdAt asc
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

    console.log(`Seeding cleaning areas para "${hqName}" (${targetHqId})\n`);

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const area of areas) {
        // No hay unique constraint compuesto en (headquartersId, name, floor),
        // así que usamos findFirst + create/update manual (sin upsert nativo).
        const existing = await prisma.cleaningArea.findFirst({
            where: {
                headquartersId: targetHqId,
                name: area.name,
                floor: area.floor,
            },
            select: { id: true, isActive: true, order: true, category: true, requiresPhoto: true },
        });

        if (!existing) {
            await prisma.cleaningArea.create({
                data: {
                    headquartersId: targetHqId,
                    name: area.name,
                    floor: area.floor,
                    category: area.category,
                    requiresPhoto: area.requiresPhoto,
                    order: area.order,
                    roomNumber: area.roomNumber ?? null,
                    isActive: true,
                },
            });
            created++;
            console.log(`  ✓ creado     : [${area.order.toString().padStart(2, '0')}] ${area.category.padEnd(10)} | ${area.name}`);
        } else {
            // Si ya existe, asegurar isActive=true y campos consistentes
            const needsUpdate =
                !existing.isActive ||
                existing.order !== area.order ||
                existing.category !== area.category ||
                existing.requiresPhoto !== area.requiresPhoto;

            if (needsUpdate) {
                await prisma.cleaningArea.update({
                    where: { id: existing.id },
                    data: {
                        isActive: true,
                        order: area.order,
                        category: area.category,
                        requiresPhoto: area.requiresPhoto,
                    },
                });
                updated++;
                console.log(`  ↻ actualizado: [${area.order.toString().padStart(2, '0')}] ${area.name}`);
            } else {
                unchanged++;
            }
        }
    }

    console.log(`\n✅ Done — ${created} creadas, ${updated} actualizadas, ${unchanged} sin cambios. Total: ${areas.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
