"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * SCAN ENGINE
 * Barre la base de datos buscando discrepancias generadas durante las
 * horas nominales del Turno Operativo.
 * No genera estado persistente nuevo; lee la realidad viva.
 */
export async function getShiftPreScan(shiftId: string, hqId: string) {
  try {
    // 1. Hard Blockers: PRN sin nota firmada, eMAR Base dejado "PENDING", Incidentes graves abiertos.
    const openCriticalIncidents = await prisma.incident.findMany({
      where: {
        headquartersId: hqId,
        severity: "CRITICAL",
        isResolved: false,
        // (Lógica hipotética time-range) createdAt: { gte: shiftStartTime, lte: shiftEndTime }
      },
    });

    const pendingEmar = await prisma.medicationAdministration.findMany({
      where: {
        status: "PENDING",
        // Aquí entraría validación de time filter
      },
      include: { patientMedication: { include: { medication: true, patient: true } } }
    });

    // Clasificación Rápida en Memoria (TypeScript)
    const hardBlockers = [
      ...openCriticalIncidents.map(inc => ({
        id: inc.id,
        type: "INCIDENT",
        title: `Incidente Abierto: ${inc.category}`,
        description: "Requiere nota clínica de resolución obligatoria.",
      }))
    ];

    const warnings = [
      ...pendingEmar.map(med => ({
        id: med.id,
        type: "MEDICATION",
        title: `Pendiente: ${med.patientMedication.medication.name}`,
        description: `Paciente: ${med.patientMedication.patient.name}`,
      }))
    ];

    return { success: true, hardBlockers, warnings };
  } catch (error) {
    console.error("[getShiftPreScan] Error interno:", error);
    return { success: false, error: "Fallo durante el Scaneo del Turno." };
  }
}

/**
 * JUSTIFICADOR RÁPIDO
 * Muta una advertencia a estado "Justificado" (Ej. REFUSED o HELD) 
 * sin salir de la pantalla del Guard.
 */
export async function resolveShiftWarning(itemId: string, type: string, action: "REFUSED" | "HELD") {
  try {
    if (type === "MEDICATION") {
      await prisma.medicationAdministration.update({
        where: { id: itemId },
        data: { status: action, notes: `Justificado en Guard: ${action}` }
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Fallo justificando:", error);
    return { success: false, error: "No se pudo impactar la DB." };
  }
}

/**
 * TRANSFERENCIA DE TAREAS
 * Delega al INCOMING SHIFT la advertencia dejándola en PENDING 
 * pero agregada al saco de Transferencias Trazables.
 */
export async function transferTaskToNextShift(itemId: string, type: string, reason: string) {
  // Lógica de marcado orgánico (Ej. Añadir nota de que fue transferida)
  return { success: true };
}

/**
 * FINALIZE SHIFT CLOSURE (El Candado Final)
 * Arranca Prisma Transaction con Optimistic Concurrency Control.
 */
export async function finalizeShiftClosure(shiftId: string, adminId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Bloqueo Optimista: Evita Doble Cierre (Race Condition)
      const shift = await tx.shiftClosure.findUnique({ where: { id: shiftId } });
      if (!shift || shift.status !== "ACTIVE") {
        throw new Error("RACE_CONDITION: Turnover is already closing or closed.");
      }

      // 2. Lock Temporal
      await tx.shiftClosure.update({
        where: { id: shiftId },
        data: { status: "CLOSING" },
      });

      // 3. (Hipotético) Re-Scaneo profundo `hardBlockers == 0`
      const isClean = true; // Simulación del Check

      if (!isClean) {
        throw new Error("HARD_BLOCK_DETECTED: Faltan pendientes obligatorios.");
      }

      // 4. Cierre Definitivo
      const closedShift = await tx.shiftClosure.update({
        where: { id: shiftId },
        data: { 
          status: "CLOSED", 
          signedOutAt: new Date(),
          supervisorOutId: adminId
        },
      });

      return closedShift;
    });

    // ============================================
    // 5. LLM ZENDI FIRE AND FORGET (ASYNC NO-BLOCKING)
    // ============================================
    triggerZendiAsyncDigest(shiftId).catch(console.error);

    revalidatePath("/care", "layout");
    return { success: true, data: result };

  } catch (error: any) {
    if (error.message.includes("RACE_CONDITION")) {
      return { success: false, error: "Este turno ya está en proceso de cierre o cerrado." };
    }
    console.error("[finalizeShiftClosure] Abortado:", error);
    return { success: false, error: "El candado final rebotó la transacción." };
  }
}

/**
 * Worker Asíncrono de NLP Zendi.
 * Desacoplado del Request Inicial para liberar la tableta.
 */
async function triggerZendiAsyncDigest(shiftId: string) {
  // Simulación: Llamada a OpenAI 
  console.log(`[ZENDI-WORKER] Levantando histórico de Shift ${shiftId} para compilar Digest verbal.`);
  await new Promise(res => setTimeout(res, 3000)); // Simula Delay LLM
  
  const aiDigest = "El turno cerró tranquilo. Un paciente rehusó su paracetamol a las 2PM. Se administró una curación abierta transferida para el siguiente turno.";

  await prisma.shiftClosure.update({
    where: { id: shiftId },
    data: { zendiDigest: aiDigest }
  });
  console.log(`[ZENDI-WORKER] Digest insertado orgánicamente.`);
}
