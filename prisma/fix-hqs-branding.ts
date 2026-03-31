import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

const VIVID_CUPEY_ID = 'b5d13d84-0a57-42fe-a1ed-bff887ed0c09';
const FAKE_HQ_IDS = [
    '068ad1ef-d2f6-406e-afd7-24e34efa5741', // Vivid Guaynabo Elite
    'd91935e5-ccba-4d7c-9ae9-9cd3328edfc4', // Vivid Dorado Resort
];

async function main() {
    console.log('[🚀] Ejecutando fixes de HQ y branding...\n');

    // 1. Set logoUrl for Vivid Cupey
    const vivid = await prisma.headquarters.update({
        where: { id: VIVID_CUPEY_ID },
        data: { logoUrl: '/logo-vivid.png' }
    });
    console.log(`[✅] Logo Vivid configurado: ${vivid.logoUrl} -> ${vivid.name}`);

    // 2. Delete fake HQs (confirmed empty - no patients, no users)
    for (const id of FAKE_HQ_IDS) {
        const hq = await prisma.headquarters.findUnique({ where: { id } });
        if (hq) {
            // Double-check emptiness before deleting
            const pCount = await prisma.patient.count({ where: { headquartersId: id } });
            const uCount = await prisma.user.count({ where: { headquartersId: id } });
            if (pCount > 0 || uCount > 0) {
                console.log(`[⚠️]  SKIPPED ${hq.name} — tiene data (${pCount} pacientes, ${uCount} usuarios)`);
                continue;
            }
            await prisma.headquarters.delete({ where: { id } });
            console.log(`[🗑️]  Eliminada: ${hq.name}`);
        }
    }

    // 3. Create Sede de Prueba (Sandbox)
    const existing = await prisma.headquarters.findFirst({ where: { name: 'Sede de Prueba (Sandbox)' } });
    if (!existing) {
        const sandbox = await prisma.headquarters.create({
            data: {
                name: 'Sede de Prueba (Sandbox)',
                licenseActive: true,
                licenseExpiry: new Date('2099-12-31'),
                logoUrl: '/brand/zendity_logo_primary.svg',
            }
        });
        console.log(`[✅] Sede de Prueba creada: ${sandbox.id}`);

        // Create a sandbox admin user
        await prisma.user.upsert({
            where: { email: 'sandbox@zendity.dev' },
            update: { headquartersId: sandbox.id },
            create: {
                email: 'sandbox@zendity.dev',
                name: 'Admin Sandbox',
                role: 'ADMIN',
                pinCode: '0000',
                headquartersId: sandbox.id,
            }
        });
        console.log(`[✅] Usuario sandbox@zendity.dev creado (PIN: 0000)`);
    } else {
        console.log(`[✅] Sede de Prueba ya existe: ${existing.id}`);
    }

    // 4. Final state
    const hqs = await prisma.headquarters.findMany({ select: { name: true, logoUrl: true }, orderBy: { name: 'asc' } });
    console.log('\n=== Estado Final de HQs ===');
    hqs.forEach((h: any) => console.log(` - ${h.name} | logo: ${h.logoUrl || 'NONE'}`));

    console.log('\n[🎉] DB actualizada correctamente.');
}

main()
    .catch((e) => { console.error('[❌]', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
