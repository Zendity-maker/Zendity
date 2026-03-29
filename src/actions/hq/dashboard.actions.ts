"use server";

import { prisma } from "@/lib/prisma";
import { SystemAuditAction, IncidentSeverity } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getGlobalDashboardMetrics(adminUserId: string) {
  try {
    // 1. Trazabilidad Global Omitida: No asociable a Sede Única en FK.
    // 2. Consulta de la Estructura de Sedes
    const allHQs = await prisma.headquarters.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            patients: { where: { status: "ACTIVE" } },
            incidents: { where: { severity: "CRITICAL" } },
            users: { where: { isActive: true } },
          },
        },
      },
    });

    // 3. Mapeo a un objeto purificado y seguro (Sin PII)
    const metricsFleet = allHQs.map((hq) => ({
      id: hq.id,
      name: hq.name,
      capacity: hq.capacity,
      occupiedBeds: (hq as any)._count?.patients || 0,
      criticalIncidentsOpen: (hq as any)._count?.incidents || 0,
      activeStaff: (hq as any)._count?.users || 0,
      licenseActive: hq.licenseActive,
      licenseExpiryDate: hq.licenseExpiry,
      ownerEmail: hq.ownerEmail || "N/A",
      alertStatus: ((hq as any)._count?.incidents || 0) > 0 ? "WARNING" : "OK",
    }));

    return { 
      success: true, 
      data: metricsFleet,
      globalTotalOccupancy: metricsFleet.reduce((acc, curr) => acc + curr.occupiedBeds, 0),
      globalTotalCapacity: metricsFleet.reduce((acc, curr) => acc + curr.capacity, 0)
    };
  } catch (error) {
    console.error("[getGlobalDashboardMetrics] Error:", error);
    return { success: false, error: "Fallo al obtiener el censo multi-sede." };
  }
}
