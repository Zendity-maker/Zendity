"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const IMPERSONATION_COOKIE = "Zendity-Impersonated-HQ";

/**
 * Activa el puente de Impersonation.
 * Inyecta una Cookie envenenada autorizada que los endpoints locales 
 * leerán en vez del JWT nativo del administrador.
 */
export async function startImpersonation(targetHqId: string, hqName: string, adminUserId: string) {
  try {
    // 1. Trazabilidad Nuclear Obligatoria (HIPAA COMPLIANT)
    await prisma.systemAuditLog.create({
      data: {
        action: "IMPERSONATION_START",
        details: `ADMINSTRADOR inició impersonation legal sobre la sede: ${hqName} (${targetHqId}).`,
        executedById: adminUserId,
        targetHqId: targetHqId,
      },
    });

    // 2. Sobrescritura Cortacircuito
    cookies().set(IMPERSONATION_COOKIE, targetHqId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 Horas máximo de ventana por si olvidan cerrarlo
    });

    // Añadimos otra cookie cosmética para que el Banner Amarillo sepa a quién usurpa
    cookies().set("Zendity-Impersonated-Name", hqName, { path: "/" });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[startImpersonation] Falla estructural:", error);
    return { success: false, error: "Error de integridad al abrir Impersonation." };
  }
}

/**
 * Rompe el puente de Impersonation y cicatriza la sesión.
 */
export async function stopImpersonation(adminUserId: string) {
  try {
    const targetHqId = cookies().get(IMPERSONATION_COOKIE)?.value || "UNKNOWN";

    // 1. Trazabilidad de Cierre
    await prisma.systemAuditLog.create({
      data: {
        action: "IMPERSONATION_STOP",
        details: `ADMINSTRADOR cerró el túnel de impersonation sobre Sede: ${targetHqId}.`,
        executedById: adminUserId,
      },
    });

    // 2. Destrucción de Contexto Residual
    cookies().delete(IMPERSONATION_COOKIE);
    cookies().delete("Zendity-Impersonated-Name");

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[stopImpersonation] Falla estructural:", error);
    return { success: false, error: "Error al cerrar sesión de Impersonation." };
  }
}

/**
 * Resolver de HQ Seguro.
 * Debería ser llamado por TODOS los Server Actions locales para decidir 
 * si usan el JWT de la persona o la Cookie Usurpada del SuperAdmin.
 */
export async function resolveCurrentHqId(nativeJwtHqId: string): Promise<string> {
  const impersonated = cookies().get(IMPERSONATION_COOKIE)?.value;
  // Si existe una cookie de impersonation, le pertenece temporalmente a ella
  if (impersonated) return impersonated;
  return nativeJwtHqId;
}
