import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

// Emails de staging que deben eliminarse
const STAGING_EMAILS = [
    'director@vivid.com',
    'sup.cupey@vivid.com',
    'sup.guaynabo@vivid.com',
    'sup.dorado@vivid.com',
    'c1@vivid.com',
    'c2@vivid.com',
    'c3@vivid.com',
    'c4@vivid.com',
    // Usuarios de seed.ts original (si existen)
    'admin@vividcupey.com',
    'enfermera@vividcupey.com',
    'cuidador@vividcupey.com',
    'terapista@vividcupey.com',
    'belleza@vividcupey.com',
    'hija@vividcupey.com',
];

// Nombres de pacientes ficticios de staging
const STAGING_PATIENTS = [
    'Doña Rosa', 'Don Julio', 'María Antonieta', 'Miguel Rivera',
    'Carmen Solís', 'Roberto Martínez', 'Ana Luisa', 'Juana Cruz',
    'Víctor Hugo', 'Luz Esther', 'Francisco Pérez', 'Teresa Colón',
    'Jorge Luis', 'Ángel Vega', 'Héctor Pagán',
    // seed.ts original
    'Doña Rosa García',
];

const REAL_EMAILS = [
    'andrestyflores@gmail.com',
    'sierracelia55@gmail.com',
    'yerayzamilf@gmail.com',
    'mariangelierivera1047@gmail.com',
    'joanelizrosario739@gmail.com',
    'valcarcelleylanis@icloud.com',
];

async function main() {
    console.log('[🧹] Iniciando limpieza de data de staging en producción...\n');

    // 1. Encontrar IDs de pacientes ficticios
    const hq = await prisma.headquarters.findFirst({ where: { name: 'Vivid Senior Living Cupey' } });
    if (!hq) throw new Error('HQ not found');

    const stagingPatients = await prisma.patient.findMany({
        where: { 
            headquartersId: hq.id,
            name: { in: STAGING_PATIENTS }
        },
        select: { id: true, name: true }
    });

    console.log(`[🔍] Pacientes ficticios encontrados: ${stagingPatients.length}`);
    stagingPatients.forEach(p => console.log('  -', p.name));

    const stagingPatientIds = stagingPatients.map(p => p.id);

    // 2. Encontrar IDs de usuarios staging
    const stagingUsers = await prisma.user.findMany({
        where: { email: { in: STAGING_EMAILS } },
        select: { id: true, email: true, name: true }
    });

    console.log(`\n[🔍] Usuarios staging encontrados: ${stagingUsers.length}`);
    stagingUsers.forEach(u => console.log('  -', u.email));

    const stagingUserIds = stagingUsers.map(u => u.id);

    // 3. Eliminar datos relacionados a pacientes ficticios (en orden para respetar FKs)
    if (stagingPatientIds.length > 0) {
        const d1 = await prisma.calendarEvent.deleteMany({ where: { patientId: { in: stagingPatientIds } } });
        console.log(`\n[🗑️]  CalendarEvents eliminados: ${d1.count}`);

        const d2 = await prisma.triageTicket.deleteMany({ where: { patientId: { in: stagingPatientIds } } });
        console.log(`[🗑️]  TriageTickets eliminados: ${d2.count}`);

        const d3 = await prisma.dailyLog.deleteMany({ where: { patientId: { in: stagingPatientIds } } });
        console.log(`[🗑️]  DailyLogs eliminados: ${d3.count}`);

        const d4 = await prisma.vitalSigns.deleteMany({ where: { patientId: { in: stagingPatientIds } } });
        console.log(`[🗑️]  VitalSigns eliminados: ${d4.count}`);

        // eMAR: primero administrations, luego patientMedications
        const patMeds = await prisma.patientMedication.findMany({ 
            where: { patientId: { in: stagingPatientIds } },
            select: { id: true }
        });
        const patMedIds = patMeds.map(m => m.id);
        
        if (patMedIds.length > 0) {
            const d5 = await prisma.medicationAdministration.deleteMany({ where: { patientMedicationId: { in: patMedIds } } });
            console.log(`[🗑️]  MedicationAdministrations eliminadas: ${d5.count}`);
            const d6 = await prisma.patientMedication.deleteMany({ where: { id: { in: patMedIds } } });
            console.log(`[🗑️]  PatientMedications eliminadas: ${d6.count}`);
        }

        const d7 = await prisma.familyMessage.deleteMany({ where: { patientId: { in: stagingPatientIds } } }).catch(() => ({ count: 0 }));
        console.log(`[🗑️]  FamilyMessages eliminados: ${d7.count}`);

        const d8 = await prisma.shiftHandover.deleteMany({ where: { headquartersId: hq.id } });
        console.log(`[🗑️]  ShiftHandovers eliminados: ${d8.count}`);

        // Eliminar pacientes ficticios
        const d9 = await prisma.patient.deleteMany({ where: { id: { in: stagingPatientIds } } });
        console.log(`[🗑️]  Pacientes ficticios eliminados: ${d9.count}`);
    }

    // 4. Eliminar datos relacionados a usuarios staging
    if (stagingUserIds.length > 0) {
        await prisma.shiftSession.deleteMany({ where: { caregiverId: { in: stagingUserIds } } });
        await prisma.performanceScore.deleteMany({ where: { userId: { in: stagingUserIds } } });
        await prisma.academyAssignment.deleteMany({ where: { userId: { in: stagingUserIds } } });
        await prisma.dailyLog.deleteMany({ where: { authorId: { in: stagingUserIds } } });

        const d10 = await prisma.user.deleteMany({ where: { id: { in: stagingUserIds } } });
        console.log(`[🗑️]  Usuarios staging eliminados: ${d10.count}`);
    }

    // 5. Eliminar CalendarEvents y HQEvents de staging sin paciente real
    await prisma.calendarEvent.deleteMany({ 
        where: { headquartersId: hq.id, originContext: { in: ['SEED_SCRIPT', 'API_SEED_SCRIPT'] } }
    });
    await prisma.headquartersEvent.deleteMany({ 
        where: { headquartersId: hq.id, description: { contains: 'seed' } }
    });

    // 6. Eliminar FamilyMembers de staging
    await prisma.familyMember.deleteMany({ 
        where: { headquartersId: hq.id, email: { contains: 'vividcupey.com' } }
    });

    // 7. Confirmación: verificar empleados reales siguen intactos
    const realStaff = await prisma.user.findMany({
        where: { email: { in: REAL_EMAILS } },
        select: { name: true, email: true, role: true, pinCode: true }
    });
    console.log(`\n[✅] Empleados reales preservados (${realStaff.length}):`);
    realStaff.forEach(u => console.log(`  - ${u.name} | ${u.role} | PIN: ${u.pinCode}`));

    // 8. Estado final de la BD
    const finalPatients = await prisma.patient.count({ where: { headquartersId: hq.id } });
    const finalUsers = await prisma.user.count({ where: { headquartersId: hq.id } });
    console.log(`\n[📊] Estado final Vivid Cupey:`);
    console.log(`  Pacientes: ${finalPatients} (listo para ingreso manual)`);
    console.log(`  Usuarios activos: ${finalUsers} (empleados reales)`);
    console.log('\n[🎉] Base de datos limpia. La plataforma está lista para ingreso manual.');
}

main()
    .catch((e) => { console.error('[❌]', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
