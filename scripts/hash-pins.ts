/**
 * scripts/hash-pins.ts
 *
 * MIGRACIÓN DE SEGURIDAD — Hashear PINs y passcodes en texto plano a bcrypt.
 *
 * INSTRUCCIONES:
 *   1. Ejecutar SOLO en local primero:
 *      export $(cat .env.local | grep -v '^#' | xargs) && npx ts-node scripts/hash-pins.ts
 *   2. Verificar output → confirmar que los conteos son correctos.
 *   3. Para producción, correr UNA SOLA VEZ con DATABASE_URL apuntando a Neon prod.
 *      ⚠️  NO correr dos veces — el script detecta hashes existentes y los salta.
 *
 * El script detecta entradas ya hasheadas (empiezan con '$2') y las omite,
 * por lo que es idempotente.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function hashUserPins() {
    console.log('\n── Usuarios (pinCode) ──────────────────────────────');

    const users = await prisma.user.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, email: true, pinCode: true },
    });

    let migrated = 0;
    let skipped = 0;
    let nullPins = 0;

    for (const u of users) {
        if (!u.pinCode) {
            nullPins++;
            continue;
        }
        if (u.pinCode.startsWith('$2')) {
            skipped++;
            continue;
        }
        const hashed = await bcrypt.hash(u.pinCode, BCRYPT_ROUNDS);
        await prisma.user.update({
            where: { id: u.id },
            data: { pinCode: hashed },
        });
        migrated++;
        console.log(`  ✅ ${u.name} <${u.email}>`);
    }

    console.log(`  → Migrados: ${migrated} | Ya hasheados (skip): ${skipped} | Sin PIN: ${nullPins}`);
    return migrated;
}

async function hashFamilyPasscodes() {
    console.log('\n── Familiares (passcode) ───────────────────────────');

    const members = await prisma.familyMember.findMany({
        select: { id: true, name: true, email: true, passcode: true },
    });

    let migrated = 0;
    let skipped = 0;
    let nullPins = 0;

    for (const m of members) {
        if (!m.passcode) {
            nullPins++;
            continue;
        }
        if (m.passcode.startsWith('$2')) {
            skipped++;
            continue;
        }
        const hashed = await bcrypt.hash(m.passcode, BCRYPT_ROUNDS);
        await prisma.familyMember.update({
            where: { id: m.id },
            data: { passcode: hashed },
        });
        migrated++;
        console.log(`  ✅ ${m.name} <${m.email}>`);
    }

    console.log(`  → Migrados: ${migrated} | Ya hasheados (skip): ${skipped} | Sin passcode: ${nullPins}`);
    return migrated;
}

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  ZÉNDITY — Migración bcrypt de PINs          ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`DB: ${process.env.DATABASE_URL?.slice(0, 40)}...`);

    const usersCount = await hashUserPins();
    const familyCount = await hashFamilyPasscodes();

    console.log('\n══════════════════════════════════════════════');
    console.log(`TOTAL migrados: ${usersCount + familyCount} registros`);
    console.log('Migración completada. Verificar login antes de deploy.');
    console.log('══════════════════════════════════════════════\n');
}

main()
    .catch(e => {
        console.error('❌ Error en migración:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
