"use server";

import { prisma } from "@/lib/prisma";
import { IntakeStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * 1. GUARDADO SILENCIOSO (Fase A)
 * Guarda la data en estado INGRESADO. No dispara cascadas clínicas todavía.
 * Útil para interrupciones en la tablet de recepción.
 */
export async function saveIntakeDraft(data: {
  patientId?: string;
  headquartersId: string;
  name?: string;
  medicalHistory?: string | null;
  allergies?: string | null;
  diagnoses?: string | null;
  mobilityLevel?: string | null;
  continenceLevel?: string | null;
  dietSpecifics?: string | null;
  downtonScore?: number | null;
  bradenScore?: number | null;
  rawMedications?: string | null;
}) {
  try {
    let currentPatientId = data.patientId;

    if (!currentPatientId) {
      if (!data.name || !data.headquartersId) {
        return { success: false, error: "Falta Nombre o Sede para iniciar el Intake" };
      }
      const newPatient = await prisma.patient.create({
        data: {
          name: data.name,
          headquartersId: data.headquartersId,
          downtonRisk: false,
          nortonRisk: false,
        }
      });
      currentPatientId = newPatient.id;
    }

    const { patientId, headquartersId, name, ...intakeFields } = data;

    const intake = await prisma.intakeData.upsert({
      where: { patientId: currentPatientId },
      update: {
        ...intakeFields,
        status: IntakeStatus.INGRESADO,
      },
      create: {
        patientId: currentPatientId,
        ...intakeFields,
        status: IntakeStatus.INGRESADO,
      },
    });

    return { success: true, data: intake, patientId: currentPatientId };
  } catch (error) {
    console.error("[saveIntakeDraft] Error:", error);
    return { success: false, error: "Error al guardar el borrador de Intake" };
  }
}

/**
 * 2. SUBMIT OFICIAL (Fase B)
 * Cambia estado a PENDIENTE_REVISION.
 * Actúa sobre el Perfil y PAI propagando el "Día Cero" clínico, pero no enciende operaciones duras de eMAR o alertas críticas.
 */
export async function submitIntake(patientId: string) {
  try {
    const intake = await prisma.intakeData.findUnique({
      where: { patientId },
    });

    if (!intake) {
      return { success: false, error: "Intake no encontrado" };
    }

    if (intake.status === IntakeStatus.CONFIRMADO) {
      return { success: false, error: "Ingreso bloquedo: El Intake ya fue confirmado y sellado médicamente." };
    }

    // Ejecución Atómica: Cascada Estructural
    await prisma.$transaction(async (tx) => {
      // 2.1 Update Intake Status
      await tx.intakeData.update({
        where: { patientId },
        data: { status: IntakeStatus.PENDIENTE_REVISION },
      });

      // 2.2 Derramamiento hacia el Perfil Vivo (Patient)
      await tx.patient.update({
        where: { id: patientId },
        data: {
          diet: intake.dietSpecifics || undefined,
          downtonRisk: (intake.downtonScore ?? 0) > 2,  // Lógica heurística de caída
          nortonRisk: (intake.bradenScore ?? 0) < 14,   // Lógica heurística de úlcera
        },
      });

      // 2.3 Creación pasiva del esqueleto del PAI (LifePlan)
      await tx.lifePlan.upsert({
        where: { patientId },
        update: {
          clinicalSummary: intake.medicalHistory,
          mobility: intake.mobilityLevel,
          continence: intake.continenceLevel,
        },
        create: {
          patientId,
          clinicalSummary: intake.medicalHistory,
          mobility: intake.mobilityLevel,
          continence: intake.continenceLevel,
          status: "DRAFT",
        },
      });

      // 2.4 Generación de Borradores eMAR (PatientMedication DRAFT)
      if (intake.rawMedications) {
        // Idempotency Lock: Borramos drafts previos inyectados por este modulo (evita duplicidad por doble-submit)
        await tx.patientMedication.deleteMany({
          where: {
             patientId: patientId,
             status: "DRAFT",
             isActive: false,
             instructions: { contains: "importado automáticamente desde Intake" }
          }
        });

        let parsedMeds: Array<{name: string, scheduleTimes: string[]}> = [];
        try {
          parsedMeds = JSON.parse(intake.rawMedications);
        } catch {
          // Fallback en caso de que sea un string viejo atorado en el Draft
          parsedMeds = intake.rawMedications.split('\n').filter(Boolean).map(m => ({
            name: m.trim(),
            scheduleTimes: ["PRN"]
          }));
        }

        for (const medObj of parsedMeds) {
          if (!medObj.name) continue;

          // Buscamos un anclaje en el catálogo o creamos uno de transición
          let medRecord = await tx.medication.findFirst({
            where: { name: { contains: medObj.name.trim(), mode: "insensitive" } }
          });
          
          if (!medRecord) {
            medRecord = await tx.medication.create({
              data: {
                name: medObj.name.trim(),
                dosage: "Por Definir",
                route: "Oral",
                category: "Intake Draft"
              }
            });
          }

          const joinedSchedules = medObj.scheduleTimes && medObj.scheduleTimes.length > 0 
                                  ? medObj.scheduleTimes.join(", ") 
                                  : "PRN";

          // Inyectamos el draft inactivo y seguro al paciente
          await tx.patientMedication.create({
            data: {
              patientId: patientId,
              medicationId: medRecord.id,
              frequency: joinedSchedules === "PRN" ? "PRN" : "DIARIO",
              scheduleTimes: joinedSchedules,
              status: "DRAFT",
              isActive: false,   // Seguridad pasiva estructural
              instructions: "Borrador importado automáticamente desde Intake"
            }
          });
        }
      }
    });

    // Invalidar caché del panel de revisión clínica
    revalidatePath("/corporate/care/triage", "layout");
    return { success: true };
  } catch (error) {
    console.error("[submitIntake] Error:", error);
    return { success: false, error: "Error al emitir (submit) el Intake" };
  }
}

/**
 * 3. CONFIRMACIÓN FINAL (Fase C)
 * El Supervisor Clínico aprueba el Intake. Se genera el v1.0 Muting Snapshot, 
 * inmutable a perpetuidad, y se preparan los Triggers futuros (Cocina, Emails, Cronjobs).
 */
export async function confirmIntake(patientId: string) {
  try {
    const intake = await prisma.intakeData.findUnique({
      where: { patientId },
      include: { patient: true }
    });

    if (!intake) {
      return { success: false, error: "Intake no encontrado" };
    }

    // Snapshot v1.0 Generado
    const snapshotJson = JSON.stringify({
      version: "1.0",
      signedAt: new Date().toISOString(),
      clinicalState: intake,
      demographicsBaseline: intake.patient
    });

    // Marcado final en DB
    await prisma.intakeData.update({
      where: { patientId },
      data: {
        status: IntakeStatus.CONFIRMADO,
        snapshotData: snapshotJson
      }
    });

    // TODO: Disparadores asíncronos (Webhook Kitchen Hub, SendGrid Familiar OTP)

    revalidatePath("/corporate/care/triage", "layout");
    return { success: true };
  } catch (error) {
    console.error("[confirmIntake] Error:", error);
    return { success: false, error: "Error al confirmar clinicamente el Intake" };
  }
}
