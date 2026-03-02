const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('💊 Iniciando Seeding de Farmacia eMAR...');

    // 1. Obtener HQ Principal y un Paciente Real
    const hq = await prisma.headquarters.findFirst();
    if (!hq) throw new Error("No hay HQ");

    const patient = await prisma.patient.findFirst();

    if (!patient) throw new Error("No se encontró NINGÚN paciente en la Base de Datos. Pide a alguien que cree un residente primero.");

    console.log(`👤 Paciente Seleccionado: ${patient.name} (UUID: ${patient.id})`);

    // 2. Crear Medicamentos Base en el Catálogo de Farmacia
    const losartan = await prisma.medication.create({
        data: { name: 'Losartan', dosage: '50mg', route: 'Oral' }
    });

    const metformina = await prisma.medication.create({
        data: { name: 'Metformina', dosage: '850mg', route: 'Oral' }
    });

    const tylenol = await prisma.medication.create({
        data: { name: 'Tylenol (Acetaminofén)', dosage: '500mg', route: 'Oral' }
    });

    console.log('✅ Catálogo de Fármacos Creado');

    // 3. Vincular los Medicamentos al Paciente (Receta eMAR)

    // - Losartan (Todos los días a las 08:00 AM)
    await prisma.patientMedication.create({
        data: {
            patientId: patient.id,
            medicationId: losartan.id,
            frequency: 'DIARIO',
            scheduleTimes: '08:00 AM',
            instructions: 'Tomar en ayunas',
            prescribedBy: 'Dr. Zendi Cardiólogo',
            isActive: true
        }
    });

    // - Metformina (Todos los dias a las 08:00 AM y 20:00 PM)
    await prisma.patientMedication.create({
        data: {
            patientId: patient.id,
            medicationId: metformina.id,
            frequency: 'DIARIO',
            scheduleTimes: '08:00 AM, 20:00 PM',
            instructions: 'Post-alimentos obligatoriamente',
            prescribedBy: 'Dra. Zendi Médico Internista',
            isActive: true
        }
    });

    // - Tylenol (S.O.S - Por Razón Necesaria)
    await prisma.patientMedication.create({
        data: {
            patientId: patient.id,
            medicationId: tylenol.id,
            frequency: 'PRN',
            scheduleTimes: 'PRN',
            instructions: 'Administrar sólo si presenta dolor 6/10 o fiebre > 38C',
            prescribedBy: 'Dr. Zendi Guardia',
            isActive: true
        }
    });

    console.log(`🩺 Tratamientos enlazados exitosamente al Expediente de ${patient.name}`);
    console.log('🎉 Seeding Completado');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
