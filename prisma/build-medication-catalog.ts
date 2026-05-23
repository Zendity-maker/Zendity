/**
 * prisma/build-medication-catalog.ts
 *
 * Normaliza y re-categoriza el catálogo global de Medication.
 *
 * Problema actual: 150 medicamentos creados por intake.actions.ts con
 * category="Intake Draft" y dosage="Por Definir" (placeholders).
 *
 * Este script:
 *   1. Lee todos los Medication existentes
 *   2. Normaliza el name (trim, capitalización, sufijos farmacéuticos)
 *   3. Detecta duplicados por name normalizado (case-insensitive)
 *   4. Categoriza usando heurística por nombre del medicamento
 *   5. Actualiza in-place (NO borra, solo update)
 *
 * Idempotente: corriéndolo múltiples veces no daña data.
 *
 * USO:
 *   export $(cat .env | grep -v '^#' | xargs) && npx tsx prisma/build-medication-catalog.ts
 */

import { PrismaClient } from '@prisma/client';
import { categorizeMedication, normalizeMedicationName } from '../src/lib/medication-categorize';

const prisma = new PrismaClient();

interface Stats {
    total: number;
    renamed: number;
    recategorized: number;
    duplicatesFound: string[];
    untouched: number;
}

async function main() {
    const all = await prisma.medication.findMany({
        select: { id: true, name: true, category: true, dosage: true },
        orderBy: { name: 'asc' },
    });

    console.log(`📚 Catálogo Medication tiene ${all.length} entradas\n`);

    const stats: Stats = {
        total: all.length,
        renamed: 0,
        recategorized: 0,
        duplicatesFound: [],
        untouched: 0,
    };

    // Detectar duplicados por name normalizado (case-insensitive)
    const seen = new Map<string, { id: string; name: string }>();

    for (const med of all) {
        const normalizedName = normalizeMedicationName(med.name);
        const key = normalizedName.toLowerCase();

        // Duplicado detectado: lo reportamos pero NO lo borramos (puede tener
        // PatientMedication enlazados)
        if (seen.has(key)) {
            stats.duplicatesFound.push(`${med.name} (id ${med.id.slice(0, 8)}) ↔ ${seen.get(key)!.name}`);
            continue;
        }
        seen.set(key, { id: med.id, name: normalizedName });

        const inferredCategory = categorizeMedication(med.name);
        const needsRename = med.name !== normalizedName;
        const needsRecategorize =
            (med.category === 'Intake Draft' || med.category === 'General') &&
            inferredCategory !== 'Sin clasificar';

        if (!needsRename && !needsRecategorize) {
            stats.untouched++;
            continue;
        }

        const updates: Record<string, string> = {};
        if (needsRename) updates.name = normalizedName;
        if (needsRecategorize) updates.category = inferredCategory;

        await prisma.medication.update({
            where: { id: med.id },
            data: updates,
        });

        if (needsRename) {
            stats.renamed++;
            console.log(`  ✏️  rename: "${med.name}" → "${normalizedName}"`);
        }
        if (needsRecategorize) {
            stats.recategorized++;
            console.log(`  🏷️  cat: ${normalizedName.padEnd(35)} → ${inferredCategory}`);
        }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`Total entradas:      ${stats.total}`);
    console.log(`Renombradas:         ${stats.renamed}`);
    console.log(`Re-categorizadas:    ${stats.recategorized}`);
    console.log(`Sin cambios:         ${stats.untouched}`);
    console.log(`Duplicados detectados (NO borrados): ${stats.duplicatesFound.length}`);
    if (stats.duplicatesFound.length > 0) {
        console.log(`  (revisar manualmente — pueden tener PatientMedication enlazados):`);
        stats.duplicatesFound.slice(0, 10).forEach((d) => console.log(`    - ${d}`));
        if (stats.duplicatesFound.length > 10) console.log(`    ... y ${stats.duplicatesFound.length - 10} más`);
    }

    // Stats post-update: distribución por categoría
    const byCategory = await prisma.medication.groupBy({
        by: ['category'],
        _count: { _all: true },
        orderBy: { _count: { id: 'desc' } },
    });
    console.log(`\n📊 Distribución por categoría tras normalización:`);
    byCategory.forEach((c) => console.log(`  ${c._count._all.toString().padStart(4)} ${c.category}`));

    console.log(`\n✅ Done`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
