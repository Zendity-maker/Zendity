const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const patient = await prisma.patient.findFirst();
  if (!patient) {
    console.log("No hay pacientes en la DB para enlazar.");
    return;
  }
  
  // Find all family members
  const families = await prisma.familyMember.findMany();
  for (const f of families) {
      let needsFix = false;
      if (!f.patientId) needsFix = true;
      else {
          const p = await prisma.patient.findUnique({ where: { id: f.patientId } });
          if (!p) needsFix = true;
      }
      
      if (needsFix) {
          await prisma.familyMember.update({
              where: { id: f.id },
              data: { patientId: patient.id }
          });
          console.log(`Familiar ${f.name} enlazado a paciente ${patient.name}`);
      }
  }
  console.log("✅ Corrección de Familias completada.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
