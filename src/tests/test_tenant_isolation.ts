import { PrismaClient } from '@prisma/client';
import { getTenantPrisma } from '../lib/prisma-tenant';

const baseDb = new PrismaClient();

async function runTest() {
  console.log("=== INICIANDO TEST DE AISLAMIENTO E2E ===");
  
  // 1. Crear HQs Dummy
  const hqA = await baseDb.headquarters.create({ data: { name: "HQ-TEST-A", capacity: 10, licenseExpiry: new Date() }});
  const hqB = await baseDb.headquarters.create({ data: { name: "HQ-TEST-B", capacity: 10, licenseExpiry: new Date() }});

  // 2. Inyectar Paciente en HQ-A
  const patientA = await baseDb.patient.create({
    data: {
      name: "Abuelo Test A",
      headquartersId: hqA.id,
      dateOfBirth: new Date("1940-01-01"),
      status: "ACTIVE",
      roomNumber: "101"
    }
  });
  console.log(`[+] Paciente creado en HQ-A: ${patientA.name} (${patientA.id})`);

  // 3. Obtener Prisma Extension para HQ-B (Simulando sesión del Director B)
  const tenantB = getTenantPrisma(hqB.id);

  // 4. Intentar ver el paciente de la Sede A usando la Sede B
  console.log("[!] Intentando vulnerar aislamiento (Buscando paciente de HQ-A desde vista HQ-B)...");
  
  const resultMany = await tenantB.patient.findMany({ where: { id: patientA.id } });

  if (resultMany && resultMany.length > 0) {
    console.error("❌ FALLO CRÍTICO: Fuga de datos detectada. Aislamiento roto.");
  } else {
    console.log("✅ ÉXITO: Paciente A es invisible para Sede B. Operación Prisma interceptada y salvada.");
  }

  // 5. Limpieza
  await baseDb.patient.delete({ where: { id: patientA.id } });
  await baseDb.headquarters.delete({ where: { id: hqA.id } });
  await baseDb.headquarters.delete({ where: { id: hqB.id } });
  console.log("=== TEST FINALIZADO CON LUZ VERDE ===");
}

runTest().catch(console.error).finally(() => baseDb.$disconnect());
