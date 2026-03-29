"use server";

import { prisma } from "@/lib/prisma";
import { Role, SystemAuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function provisionNewHeadquarters(data: {
  hqName: string;
  capacity: number;
  ownerName: string;
  ownerEmail: string;
  taxId?: string;
  adminUserId: string; // Quien ejecuta la acción (SUPER_ADMIN)
}) {
  try {
    // 1. Evitar Duplicidad: Validar reintentos accidentales
    const existing = await prisma.headquarters.findFirst({
      where: { name: data.hqName },
    });

    if (existing) {
      return { success: false, error: "Ya existe una Sede con ese nombre exacto." };
    }

    const existingOwner = await prisma.user.findUnique({
      where: { email: data.ownerEmail },
    });

    if (existingOwner) {
      return { success: false, error: "El correo del Owner ya está en uso." };
    }

    // 2. Transacción Atómica
    const result = await prisma.$transaction(async (tx) => {
      // 2a. Crear Headquarters
      const newHq = await tx.headquarters.create({
        data: {
          name: data.hqName,
          capacity: data.capacity,
          taxId: data.taxId,
          licenseActive: true,
          licenseExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          ownerName: data.ownerName,
          ownerEmail: data.ownerEmail,
        },
      });

      // 2b. Crear Perfil de Operaciones (HQ_OWNER)
      const ownerUser = await tx.user.create({
        data: {
          name: data.ownerName,
          email: data.ownerEmail,
          role: Role.HQ_OWNER,
          headquartersId: newHq.id,
          isActive: true,
          pinCode: "1234", // Default PIN temporal
        },
      });

      // 2c. Clonación Restringida de Catálogo Maestro Base
      // Trae de la Master DB y clona exactamente en el Silo de la Sede
      const globalMeds = await tx.medication.findMany({
        where: { isGlobalMaster: true },
      });

      if (globalMeds.length > 0) {
        const medsToInsert = globalMeds.map((m: any) => ({
          name: m.name,
          dosage: m.dosage,
          route: m.route,
          description: m.description,
          category: m.category,
          condition: m.condition,
          isControlled: m.isControlled,
          requiresFridge: m.requiresFridge,
          withFood: m.withFood,
          headquartersId: newHq.id, // Asignación rígida Tenant Isolation
          isGlobalMaster: false,
        }));

        await tx.medication.createMany({
          data: medsToInsert,
        });
      }

      // 2d. Traza de Acceso Auditado Global (Sistema Anti-Fuga)
      // Aseguramos que la provisión queda grabada inmutablemente.
      await tx.systemAuditLog.create({
        data: {
          action: SystemAuditAction.CREATED,
          payloadChanges: { info: `Provisionada sede ${data.hqName} (${newHq.id}). Owner creado: ${data.ownerEmail}. Catálogo inicial de medicinas sembrado: ${globalMeds.length} items.` },
          performedById: data.adminUserId,
          headquartersId: newHq.id,
          entityName: "Headquarters",
          entityId: newHq.id,
        },
      });

      return { newHq, ownerUser };
    });

    revalidatePath("/corporate/superadmin");
    return { success: true, data: result };
  } catch (error) {
    console.error("[provisionNewHeadquarters] Transacción Abortada:", error);
    return { success: false, error: "Fallo durante el provisionamiento atómico." };
  }
}
