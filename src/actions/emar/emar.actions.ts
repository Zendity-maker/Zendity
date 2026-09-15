"use server";

import { prisma } from "@/lib/prisma";
import { MedActiveStatus, MedStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { todayStartAST } from "@/lib/dates";
import { marcarDosisVencidas } from "@/lib/emar-schedule";

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
/**
 * ELIMINADA — reemplazada por materializarDosisDelDia() en src/lib/emar-schedule.ts.
 *
 * Se llamaba "executeDailyCronExpansion" y ningún cron la llamaba: era código
 * muerto desde su creación. Por eso la fila de MedicationAdministration solo
 * nacía al administrar, y el cumplimiento eMAR daba 100% dividiendo
 * administradas entre administradas.
 *
 * Ademas componia la hora con setHours, que sobre Vercel usa el reloj UTC y
 * dejaba cada dosis corrida cuatro horas respecto a AST.
 */


/**
 * 3. BARRIDO DE DOSIS VENCIDAS — UNA SOLA REGLA PARA TODO EL PRODUCTO.
 *
 * Esto era un SEGUNDO barrido, con su propia ventana de 12 horas y su propia
 * nota automática ("Posible falla de conectividad en piso u omisión humana"),
 * compitiendo con `marcarDosisVencidas` de src/lib/emar-schedule.ts.
 *
 * Nunca lo llamó nadie, y menos mal: dos reglas distintas decidiendo cuándo una
 * dosis se da por perdida es dos respuestas distintas a la misma pregunta.
 *
 * La regla buena, desde el 15-sep-2026, es el CIERRE DEL TURNO al que pertenece
 * la dosis —MAÑANA 06-14, TARDE 14-22, NOCHE 22-06, más media hora de relevo—
 * medida sobre 10.608 firmas reales: solo el 0,1% se registran después de que
 * cierre su turno, contra el 18,6% que se pasaba de las dos horas fijas.
 *
 * Esta función se queda como puente para que nadie la reinvente, pero delega.
 * Y ya no escribe aquella nota: acusar de "omisión humana" a una dosis que
 * simplemente todavía no se ha tecleado es exactamente lo que había que dejar
 * de hacer.
 */
export async function executeMissedTolerantSweep() {
  try {
    const sweptCount = await marcarDosisVencidas();
    return { success: true, sweptCount };
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
        /**
         * UN PRN NO TIENE HORA PROGRAMADA. Aquí se escribía `scheduledTime: now`
         * y eso es afirmar que estaba agendado para este minuto — que es lo
         * contrario de lo que significa "por razón necesaria".
         *
         * No era cosmético. `scheduledTime` es la mitad de la llave única
         * (patientMedicationId, scheduledTime) y es por donde el barrido busca
         * dosis vencidas; un PRN con hora puesta entra en cálculos de los que
         * debe quedar fuera a propósito — el cumplimiento no puede castigar al
         * hogar por no medicar a quien no lo necesitaba.
         */
        scheduledTime: null,
        administeredAt: now,
        status: MedStatus.ADMINISTERED,
        administeredById: data.userId,
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
    /**
     * LAS DE HOY, Y CON TECHO.
     *
     * El comentario original decía "programadas idealmente para hoy o vigentes"
     * y el `where` no tenía NI filtro de fecha NI `take`: devolvía todas las
     * PENDING de la historia de la sede.
     *
     * Eso no se notaba porque hasta el 15-sep-2026 no existía ni una sola fila
     * PENDING en toda la base —el cron que las crea firmaba con un usuario
     * inexistente y el 100% de sus escrituras reventaba en silencio—. La
     * consulta devolvía cero filas y parecía sana.
     *
     * Desde que el cron funciona son ~360 al día. Sin filtro, en un mes esto
     * son diez mil filas con su residente y su medicamento enganchados, a una
     * tableta. Es el antipatrón 11 de CLAUDE.md, activado por un arreglo.
     */
    const doses = await prisma.medicationAdministration.findMany({
      where: {
        status: MedStatus.PENDING,
        scheduledTime: { gte: todayStartAST() },
        patientMedication: {
          patient: { headquartersId: hqId, status: 'ACTIVE' }
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
      orderBy: { scheduledTime: 'asc' },
      take: 500,
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
        administeredById: userId
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
        administeredById: userId
      }
    });
    revalidatePath("/care", "layout");
    return { success: true, data: dose };
  } catch (error) {
    console.error("[markDoseException] Error:", error);
    return { success: false, error: "Error al registrar excepción" };
  }
}
