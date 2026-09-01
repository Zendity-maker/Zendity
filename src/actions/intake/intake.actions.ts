"use server";

import { prisma } from "@/lib/prisma";
import { IntakeStatus, DietTexture } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { categorizeMedication, normalizeMedicationName } from "@/lib/medication-categorize";

// Sprint Diet System — el form de intake escribe IntakeData.dietSpecifics con
// ids que matchean DietTexture (REGULAR | BLANDA | MAJADA | PUREE | LICUADO |
// LIQUIDOS_CLAROS | PEG). Esta función traduce el string al enum, defensivamente
// — si llega algo viejo o desconocido, retorna null y dejamos el campo sin setear.
const VALID_TEXTURES: ReadonlyArray<DietTexture> = [
    'REGULAR', 'BLANDA', 'MAJADA', 'PUREE', 'LICUADO', 'LIQUIDOS_CLAROS', 'PEG',
];
function parseIntakeDietTexture(raw: string | null | undefined): DietTexture | null {
    if (!raw) return null;
    const upper = raw.toUpperCase().trim();
    if ((VALID_TEXTURES as readonly string[]).includes(upper)) return upper as DietTexture;
    // Heurística defensive — strings legacy que pudieran venir del form viejo
    if (upper === 'DIABETICA') return 'REGULAR'; // Diabética sola → REGULAR (modificador se agrega después)
    return null;
}

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
          // Fecha de ingreso = fecha de registro (regla del dueño).
          admissionDate: new Date(),
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
      // Sprint Diet System — además del campo legacy `diet`, poblamos `dietTexture`
      // para que el residente entre a cocina con la categoría correcta desde el
      // primer día. Si el form mandó algo desconocido, dietTexture queda null y
      // se prescribe luego desde el perfil/care.
      const parsedTexture = parseIntakeDietTexture(intake.dietSpecifics);
      await tx.patient.update({
        where: { id: patientId },
        data: {
          diet: intake.dietSpecifics || undefined, // legacy back-compat
          dietTexture: parsedTexture ?? undefined, // null no escribe nada (Prisma)
          downtonRisk: (intake.downtonScore ?? 0) > 2,  // Lógica heurística de caída
          nortonRisk: (intake.bradenScore ?? 0) < 14,   // Lógica heurística de úlcera
        },
      });

      // 2.3 Creación pasiva del esqueleto del PAI (LifePlan)
      const existingPai = await tx.lifePlan.findFirst({
        where: { patientId, status: { in: ['DRAFT', 'APPROVED'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (existingPai) {
        await tx.lifePlan.update({
          where: { id: existingPai.id },
          data: {
            clinicalSummary: intake.medicalHistory,
            mobility: intake.mobilityLevel,
            continence: intake.continenceLevel,
          },
        });
      } else {
        await tx.lifePlan.create({
          data: {
            patientId,
            type: 'INITIAL',
            status: 'DRAFT',
            clinicalSummary: intake.medicalHistory,
            mobility: intake.mobilityLevel,
            continence: intake.continenceLevel,
          },
        });
      }

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

          // Normalizar nombre (trim, capitalización consistente)
          const normalizedName = normalizeMedicationName(medObj.name);

          // Buscamos un anclaje en el catálogo (case-insensitive) o lo creamos.
          let medRecord = await tx.medication.findFirst({
            where: { name: { contains: normalizedName, mode: "insensitive" } }
          });

          if (!medRecord) {
            // Crecimiento orgánico: categoriza automáticamente por heurística
            // del nombre del medicamento. Si no hay match → "Sin clasificar"
            // (legible, en vez del "Intake Draft" críptico).
            const inferredCategory = categorizeMedication(normalizedName);
            medRecord = await tx.medication.create({
              data: {
                name: normalizedName,
                dosage: "Por Definir",
                route: "Oral",
                category: inferredCategory,
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

    // Sin familiar registrado NI marca explicita, la admision no se cierra.
    //
    // El paso 5 del wizard si pide nombre y correo del familiar, pero tiene su
    // propio boton de guardado y la admision se completaba igual sin pulsarlo.
    // Resultado en Cupey: 5 de los 9 ingresos posteriores a la carga inicial
    // entraron sin nadie a quien avisar, incluidos los tres mas recientes.
    //
    // El objetivo no es obligar a inventarse un familiar. Es que "no tiene
    // familia" quede DICHO en vez de deducido de un campo vacio: hoy ambos
    // casos se ven identicos y no hay forma de saber a quien hay que llamar.
    /**
     * Sin cuota mensual definida, la admision tampoco se cierra.
     *
     * Andres: "debieramos agregar esa informacion en intake para que ingrese al
     * file completo sin tener que hacer cosas adicionales, igual que con lo de
     * los familiares."
     *
     * Lo que pasaba sin esto, medido el 01-sep-2026: el censo de facturacion
     * imprimia 30 de 34 residentes y nadie sabia por que. Los 4 que faltaban
     * eran los ingresos de agosto — generate-month exige monthlyFee > 0 y el
     * asistente nunca la pedia. Unos $10 499 al mes sin facturar, en silencio.
     *
     * null es "sin definir" y bloquea. 0 es una decision explicita —un residente
     * cuyo pago no pasa por aqui— y se permite, pero el mensaje avisa de que
     * significa, para que nadie ponga 0 solo por salir del paso.
     */
    if (intake.patient.monthlyFee == null) {
      return {
        success: false,
        error: 'Falta la cuota mensual. Sin ella este residente no entra en la facturación del mes. Ponla en el paso 5; si su pago no pasa por Zéndity, escribe 0.',
      };
    }

    const familiares = await prisma.familyMember.count({ where: { patientId } });
    if (familiares === 0 && !intake.patient.sinFamiliarConocido) {
      return {
        success: false,
        error: "Falta el familiar. Registra al menos uno en el paso 5, o marca expresamente que el residente no tiene familiar conocido.",
      };
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
