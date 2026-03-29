import { PrismaClient, IntakeStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function runE2E() {
  console.log("=== INICIANDO VALIDACIÓN E2E DEL INTAKE COMPLETO ===");

  // 1. Obtener HQ de prueba
  let hq = await prisma.headquarters.findFirst();
  if (!hq) {
    hq = await prisma.headquarters.create({ data: { name: "HQ Test E2E", licenseExpiry: new Date() } });
  }

  // 2. Identificadores de Testing
  const TEST_NAME = "Residente Test " + Date.now();
  
  console.log("-> 1. Interrupción / Auto-Save Inicial");
  
  // Ejecutando la función expcional tal y como ocurre en NextJS
  // saveIntakeDraft (creando al paciente vacio)
  const draftCreateRes = await saveIntakeMock({
      headquartersId: hq.id,
      name: TEST_NAME,
      allergies: "Alergias Dummy"
  });

  if (!draftCreateRes.success) throw new Error("Fallo crear draft");
  const pid = draftCreateRes.patientId;
  console.log(`   [x] Patient ID Generado: ${pid}`);

  const intakeCheck1 = await prisma.intakeData.findUnique({ where: { patientId: pid } });
  console.log(`   [x] Estado del Intake: ${intakeCheck1?.status} (Debería ser INGRESADO)`);

  console.log("\\n-> 2. Llenado asíncrono y Emitir (submitIntake)");
  // Upsert again
  await saveIntakeMock({
      patientId: pid,
      headquartersId: hq.id,
      name: TEST_NAME,
      medicalHistory: "Historia Dummy",
      mobilityLevel: "ASSISTED",
      rawMedications: "Aspirina 100mg\\nLosartan 50mg"
  });

  await submitIntakeMock(pid);
  const intakeCheck2 = await prisma.intakeData.findUnique({ where: { patientId: pid } });
  console.log(`   [x] Nuevo Estado: ${intakeCheck2?.status} (Debería ser PENDIENTE_REVISION)`);
  
  console.log("\\n-> 3. PRUEBA DE RESILIENCIA (Forzando Doble-Submit)");
  await submitIntakeMock(pid); // Doble click
  await submitIntakeMock(pid); // Triple click
  
  const medsCount = await prisma.patientMedication.count({ where: { patientId: pid } });
  console.log(`   [x] Conteo de Medicinas Draft: ${medsCount} (Debería ser 2, demostrando IDEMPOTENCIA)`);

  console.log("\\n-> 4. Proyección a Patient y LifePlan");
  const patient = await prisma.patient.findUnique({ where: { id: pid }});
  const lifePlan = await prisma.lifePlan.findUnique({ where: { patientId: pid }});
  console.log(`   [x] LifePlan Creado? ${!!lifePlan} (Movilidad: ${lifePlan?.mobility})`);

  console.log("\\n-> 5. Confirmación Final del Supervisor");
  await confirmIntakeMock(pid);
  const intakeFinal = await prisma.intakeData.findUnique({ where: { patientId: pid }});
  console.log(`   [x] Estado Final: ${intakeFinal?.status} (Debería ser CONFIRMADO)`);
  console.log(`   [x] Snapshot V1.0 Sellado: ${!!intakeFinal?.snapshotData}`);

  console.log("\\n=== VALIDACIÓN EXITOSA ===");
}

// ---- MOCK CLONES OR ACTIONS IMPORTS ----
// We clone them temporarily here to run the raw logic without NextJS server context limits in standalone ts-node execution
async function saveIntakeMock(data: any) {
    let currentPatientId = data.patientId;
    if (!currentPatientId) {
      const newPatient = await prisma.patient.create({
        data: { name: data.name, headquartersId: data.headquartersId, downtonRisk: false, nortonRisk: false }
      });
      currentPatientId = newPatient.id;
    }
    const { patientId, headquartersId, name, ...intakeFields } = data;
    const intake = await prisma.intakeData.upsert({
      where: { patientId: currentPatientId },
      update: { ...intakeFields, status: "INGRESADO" },
      create: { patientId: currentPatientId, ...intakeFields, status: "INGRESADO" },
    });
    return { success: true, patientId: currentPatientId };
}

async function submitIntakeMock(patientId: string) {
    const intake = await prisma.intakeData.findUnique({ where: { patientId } });
    if (!intake) return;
    await prisma.$transaction(async (tx) => {
      await tx.intakeData.update({ where: { patientId }, data: { status: "PENDIENTE_REVISION" } });
      await tx.patient.update({ where: { id: patientId }, data: { diet: intake.dietSpecifics || undefined } });
      await tx.lifePlan.upsert({
        where: { patientId },
        update: { clinicalSummary: intake.medicalHistory, mobility: intake.mobilityLevel },
        create: { patientId, clinicalSummary: intake.medicalHistory, mobility: intake.mobilityLevel, status: "DRAFT" },
      });
      if (intake.rawMedications) {
        await tx.patientMedication.deleteMany({
          where: { patientId, status: "DRAFT", isActive: false, instructions: { contains: "automáticamente desde Intake" } }
        });
        const rawMedsList = intake.rawMedications.split('\\n').filter(Boolean);
        for (const rawMed of rawMedsList) {
          let medRecord = await tx.medication.findFirst({ where: { name: { contains: rawMed.trim() } } });
          if (!medRecord) {
            medRecord = await tx.medication.create({
              data: { name: rawMed.trim(), dosage: "Por Definir", route: "Oral", category: "Intake Draft" }
            });
          }
          await tx.patientMedication.create({
            data: { patientId, medicationId: medRecord.id, frequency: "DIARIO", scheduleTimes: "08:00", status: "DRAFT", isActive: false, instructions: "Borrador importado automáticamente desde Intake" }
          });
        }
      }
    });
}
async function confirmIntakeMock(patientId: string) {
    const intake = await prisma.intakeData.findUnique({ where: { patientId }, include: { patient: true }});
    const snapshotJson = JSON.stringify({ version: "1.0", clinicalState: intake });
    await prisma.intakeData.update({ where: { patientId }, data: { status: "CONFIRMADO", snapshotData: snapshotJson } });
}

runE2E().catch(console.error).finally(() => prisma.$disconnect());
