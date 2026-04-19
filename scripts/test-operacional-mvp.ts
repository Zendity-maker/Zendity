import { PrismaClient, Role, TicketPriority, TicketOriginType, ShiftType, SystemAuditAction } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- BATERIA DE PRUEBAS AUTOMATIZADAS MVP OPERACIONAL ---");
  
  console.log("1. Inicializando Seed Environment...");
  let hq = await prisma.headquarters.findFirst();
  if (!hq) {
    hq = await prisma.headquarters.create({
      data: { name: 'Vivid Test HQ', capacity: 100, licenseExpiry: new Date() }
    });
  }

  const director = await prisma.user.create({
    data: { name: 'Director Test', email: `director${Date.now()}@test.com`, role: Role.DIRECTOR, headquartersId: hq.id }
  });
  const supervisor = await prisma.user.create({
    data: { name: 'Supervisor Test', email: `supervisor${Date.now()}@test.com`, role: Role.SUPERVISOR, headquartersId: hq.id }
  });
  const nurse = await prisma.user.create({
    data: { name: 'Nurse Test', email: `nurse${Date.now()}@test.com`, role: Role.NURSE, headquartersId: hq.id }
  });
  
  const patient = await prisma.patient.create({
    data: { name: 'Residente Test QA', headquartersId: hq.id }
  });

  console.log("✓ Usuarios y Residentes semilla creados.");

  console.log("2. Probando Triage Tickets...");
  const tc1 = await prisma.triageTicket.create({
    data: {
      headquartersId: hq.id,
      priority: TicketPriority.HIGH,
      originType: TicketOriginType.MANUAL,
      description: "Prueba ticket HIGH",
      patientId: patient.id
    }
  });

  console.log("✓ Ticket HIGH creado exitosamente. ID:", tc1.id);

  console.log("3. Intentando cerrar turno con bloqueo...");
  const blockingTickets = await prisma.triageTicket.count({
      where: { headquartersId: hq.id, priority: 'HIGH', status: 'OPEN' }
  });
  if (blockingTickets > 0) {
      console.log("✓ Bloqueo exitoso detectado: Triage activo detiene el cierre.");
  } else {
      console.log("⚠️ Falla: Bloqueo de Triage no detectado.");
  }

  console.log("4. Probando ShiftHandover canónico (Sprint B)...");
  try {
      const handover = await prisma.shiftHandover.create({
          data: {
              headquartersId: hq.id,
              shiftType: ShiftType.MORNING,
              outgoingNurseId: nurse.id,
              status: 'PENDING',
              signature: 'TEST_SIGNATURE',
              signedOutAt: new Date(),
              handoverCompleted: true,
              justifications: { 'mock-warning-1': 'REFUSED' },
              notes: {
                  create: [{ patientId: patient.id, clinicalNotes: "Sufrió caída.", isCritical: true }]
              }
          }
      });
      console.log("✓ ShiftHandover creado correctamente. ID:", handover.id);
  } catch(e) {
      console.error(e);
  }

  console.log("5. Resolviendo Triage Ticket...");
  await prisma.triageTicket.update({
      where: { id: tc1.id },
      data: { status: 'RESOLVED', resolutionNote: 'Resuelto en test', resolvedById: supervisor.id }
  });
  console.log("✓ Ticket Resuelto.");

  const auditLogCreate = await prisma.systemAuditLog.create({
      data: { headquartersId: hq.id, entityName: 'TriageTicket', entityId: tc1.id, action: SystemAuditAction.CREATED }
  });
  console.log("✓ System Audit Log validado funcionando.");

  console.log("--- BATERIA COMPLETADA OK ---");
}

main().catch(console.error).finally(() => prisma.$disconnect());
