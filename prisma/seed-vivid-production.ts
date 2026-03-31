import { PrismaClient, Role } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function main() {
    console.log(`[🚀] Seeding real Vivid Cupey production staff...`);

    // Vivid Senior Living Cupey HQ
    const hq = await prisma.headquarters.findFirst({
        where: { name: 'Vivid Senior Living Cupey' }
    });

    if (!hq) {
        throw new Error('❌ HQ "Vivid Senior Living Cupey" not found. Run the base seed first.');
    }

    console.log(`[✅] HQ encontrado: ${hq.name} (${hq.id})`);

    // Real Vivid Cupey Staff — personal emails normalized to lowercase
    const realStaff = [
        { name: 'Andrés Flores (Director General)', email: 'andrestyflores@gmail.com', role: Role.DIRECTOR, pinCode: '1234' },
        { name: 'Celia Sierra (Administradora)', email: 'sierracelia55@gmail.com', role: Role.ADMIN, pinCode: '1234' },
        { name: 'Yeray Flores (Cuidador)', email: 'yerayzamilf@gmail.com', role: Role.CAREGIVER, pinCode: '1234' },
        { name: 'Mariangelie Carmona (Cuidadora)', email: 'mariangelierivera1047@gmail.com', role: Role.CAREGIVER, pinCode: '1234' },
        { name: 'Joaneliz Rosario (Cuidadora)', email: 'joanelizrosario739@gmail.com', role: Role.CAREGIVER, pinCode: '1234' },
        { name: 'Zuleika Valcarcel (Cuidadora)', email: 'valcarcelleylanis@icloud.com', role: Role.CAREGIVER, pinCode: '1234' },
    ];

    for (const staff of realStaff) {
        const cleanEmail = staff.email.toLowerCase().trim();

        const result = await prisma.user.upsert({
            where: { email: cleanEmail },
            update: {
                name: staff.name,
                role: staff.role,
                pinCode: staff.pinCode,
                headquartersId: hq.id,
            },
            create: {
                name: staff.name,
                email: cleanEmail,
                role: staff.role,
                pinCode: staff.pinCode,
                headquartersId: hq.id,
            },
        });

        console.log(`[✅] ${result.name} | ${result.role} | ${result.email}`);
    }

    console.log(`\n[🎉] DONE — ${realStaff.length} staff members upserted successfully.`);
    console.log(`[ℹ️]  All staff have PIN: 1234. Remind them to change it after first login.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
