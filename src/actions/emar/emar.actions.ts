"use server";

import { prisma } from "@/lib/prisma";
import { MedActiveStatus, MedStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * 1. CONCILIACIÓN: DRAFT -> ACTIVE
 * Ejecutado por el Director Médico en el Triage.
 */
export async function approveMedicationDraft(data: {
  patientMedicationId: string;
  frequency: string;
  scheduleTimes: string;
  userId: string;
}) {
  try {
    const med = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.patientMedication.update({
        where: { id: data.patientMedicationId },
        data: {
          status: MedActiveStatus.ACTIVE,
          frequency: data.frequency,
          scheduleTimes: data.scheduleTimes,
        },
      });

      await tx.medicationAuditLog.create({
         data: {
            patientMedicationId: data.patientMedicationId,
            action: "APPROVE",
            userId: data.userId,
            notes: `Frecuencia: ${data.frequency}. Horarios asignados: ${data.scheduleTimes}`
         }
      });

      return updated;
    });

    revalidatePath("/corporate/care/triage", "layout");
    return { success: true, data: med };
  } catch (error) {
    console.error("[approveMedicationDraft] Error:", error);
    return { success: false, error: "Error al activar el medicamento" };
  }
}

/**
 * 2. EL RELOJ DE EXPANSIÓN (CRON MOTOR)
 */
export async function executeDailyCronExpansion() {
  try {
    const activeMeds = await prisma.patientMedication.findMany({
      where: {
        status: MedActiveStatus.ACTIVE,
        isActive: true,
      },
    });

    const now = new Date();
    const todayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let injectedCount = 0;

    for (const pm of activeMeds) {
      if (!pm.scheduleTimes) continue;

      const times = pm.scheduleTimes.split(",").map((t) => t.trim());
      
      for (const timeStr of times) {
        const [hours, minutes] = timeStr.split(":").map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        const scheduledTime = new Date(todayBase);
        scheduledTime.setHours(hours, minutes, 0, 0);

        try {
          await prisma.medicationAdministration.upsert({
            where: {
              patientMedicationId_scheduledTime: {
                patientMedicationId: pm.id,
                scheduledTime: scheduledTime,
              },
            },
            update: {}, 
            create: {
              patientMedicationId: pm.id,
              scheduledFor: timeStr,
              scheduledTime: scheduledTime,
              status: MedStatus.PENDING,
            },
          });
          injectedCount++;
        } catch (e) {
          // Silent catch for edge upsert cases
        }
      }
    }

    return { success: true, injected: injectedCount };
  } catch (error) {
    console.error("[executeDailyCronExpansion] Error:", error);
    return { success: false, error: "Fallo crónico del Motor de Expansión" };
  }
}

/**
 * 3. GRACE PERIOD SWEEP (Manejo Tolerante de MISSED)
 */
export async function executeMissedTolerantSweep() {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 12); 

    const res = await prisma.medicationAdministration.updateMany({
      where: {
        status: MedStatus.PENDING,
        scheduledTime: {
          lt: cutoffTime, 
        },
      },
      data: {
        status: MedStatus.MISSED,
        notes: "Auto-marcado por reloj maestro (Grace Period 12h Expirado). Posible falla de conectividad en piso u omisión humana.",
      },
    });

    return { success: true, sweptCount: res.count };
  } catch (error) {
    console.error("[executeMissedTolerantSweep] Error:", error);
    return { success: false, error: "Error en el Sweep de limpieza" };
  }
}

/**
 * 4. PRN DE PRIMERA OLA (Botón A Demanda)
 */
export async function administerPRN(data: {
  patientMedicationId: string;
  userId: string;
  reason: string;
}) {
  try {
    const now = new Date();

    const admin = await prisma.medicationAdministration.create({
      data: {
        patientMedicationId: data.patientMedicationId,
        scheduledFor: "PRN",
        scheduledTime: now,
        administeredAt: now,
        status: MedStatus.ADMINISTERED,
        executedById: data.userId,
        notes: data.reason,
      },
    });

    revalidatePath("/care", "layout");
    return { success: true, data: admin };
  } catch (error) {
    console.error("[administerPRN] Error:", error);
    return { success: false, error: "Fallo al despachar medicamento PRN" };
  }
}

/**
 * 5. OBTENER BORRADORES (DRAFTS) PARA CONCILIACIÓN
 */
export async function fetchEmarDrafts(headquartersId: string) {
  try {
    const drafts = await prisma.patientMedication.findMany({
      where: {
         status: MedActiveStatus.DRAFT,
         patient: { headquartersId }
      },
      include: {
         patient: true,
         medication: true
      },
      orderBy: { startDate: "asc" }
    });
    return { success: true, data: drafts };
  } catch (error) {
    console.error("[fetchEmarDrafts] Error:", error);
    return { success: false, error: "Fallo al obtener drafts" };
  }
}

/**
 * 6. DESCARTAR BORRADOR
 */
export async function discardMedicationDraft(data: {
  patientMedicationId: string;
  userId: string;
  reason: string;
}) {
  try {
    await prisma.$transaction(async (tx: any) => {
      await tx.patientMedication.update({
        where: { id: data.patientMedicationId },
        data: { status: MedActiveStatus.DISCONTINUED }
      });
      await tx.medicationAuditLog.create({
        data: {
           patientMedicationId: data.patientMedicationId,
           action: "DISCARD",
           userId: data.userId,
           notes: data.reason
        }
      });
    });
    revalidatePath("/corporate/care/triage", "layout");
    return { success: true };
  } catch (error) {
    console.error("[discardMedicationDraft] Error:", error);
    return { success: false, error: "Fallo al descartar draft" };
  }
}

// ==========================================
// NUEVOS ENDPOINTS PARA FASE 3: TIMELINE DE PISO
// ==========================================

export async function fetchShiftPendingDoses(hqId: string) {
  try {
    // Para la experiencia de piso MVP, filtramos directamente 
    // todas las PENDING programadas idealmente para hoy o vigentes
    const doses = await prisma.medicationAdministration.findMany({
      where: {
        status: MedStatus.PENDING,
        patientMedication: {
          patient: { headquartersId: hqId }
        }
      },
      include: {
        patientMedication: {
          include: {
            medication: true,
            patient: true
          }
        }
      },
      orderBy: { scheduledTime: 'asc' }
    });

    return { success: true, data: doses };
  } catch (error) {
    console.error("[fetchShiftPendingDoses] Error:", error);
    return { success: false, error: "Fallo al obtener ruta de medicación" };
  }
}

export async function markDoseAsGiven(adminId: string, userId: string) {
  try {
    const dose = await prisma.medicationAdministration.update({
      where: { id: adminId },
      data: {
        status: MedStatus.ADMINISTERED,
        administeredAt: new Date(),
        executedById: userId
      }
    });
    revalidatePath("/care", "layout");
    return { success: true, data: dose };
  } catch (error) {
    console.error("[markDoseAsGiven] Error:", error);
    return { success: false, error: "Error al impartir dosis" };
  }
}

export async function markDoseException(
  adminId: string, 
  status: MedStatus, 
  reason: string, 
  userId: string
) {
  try {
    const dose = await prisma.medicationAdministration.update({
      where: { id: adminId },
      data: {
        status: status, // HELD o REFUSED
        notes: reason,
        administeredAt: new Date(),
        executedById: userId
      }
    });
    revalidatePath("/care", "layout");
    return { success: true, data: dose };
  } catch (error) {
    console.error("[markDoseException] Error:", error);
    return { success: false, error: "Error al registrar excepción" };
  }
}
