import { PrismaClient } from "@prisma/client";
import { prisma as basePrisma } from "./prisma";

// Catálogo de modelos que exigen Tenant Isolation en Zendity
// Estos modelos serán ruteados con `where: { headquartersId }` de forma forzosa.
const tenantModels = [
  "Patient",
  "User",
  "Shift",
  "Incident",
  "BillingOrder",
  "PatientMedication",
  "IntakeData",
  "Schedule",
  // El resto del ecosistema hereda sus accesos de HQ a través del Patient
];

/**
 * MOTOR DE AISLAMIENTO B2B (Tenant Isolation)
 * Retorna una instancia extendida de Prisma que auto-inyecta
 * el ID de la Sede en todas las consultas y escrituras.
 * 
 * Uso obligatorio en Server Actions departamentales:
 * `const tenantDb = getTenantPrisma(session.user.hqId);`
 */
export function getTenantPrisma(hqId: string) {
  if (!hqId) {
    throw new Error("TENANT LEAK PREVENTED: No Headquarters ID provided to Prisma Extension.");
  }

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Si es un modelo estricto, le inyectamos la sede en el WHERE o DATA
          if (tenantModels.includes(model)) {
            
            // Para operaciones de LECTURA y ACTUALIZACIÓN
            if (
              operation === "findUnique" ||
              operation === "findFirst" ||
              operation === "findMany" ||
              operation === "update" ||
              operation === "updateMany" ||
              operation === "delete" ||
              operation === "deleteMany"
            ) {
              const baseArgs = args as any;
              baseArgs.where = {
                ...baseArgs.where,
                headquartersId: hqId,
              };
            }

            // Para operaciones de CREACIÓN
            if (operation === "create" || operation === "createMany") {
               const baseArgs = args as any;
               
               if (operation === "create") {
                  baseArgs.data = {
                     ...baseArgs.data,
                     headquartersId: hqId
                  };
               } else if (operation === "createMany" && Array.isArray(baseArgs.data)) {
                  baseArgs.data = baseArgs.data.map((row: any) => ({
                     ...row,
                     headquartersId: hqId
                  }));
               }
            }
          }

          // Ejecutamos el query ya acorazado
          return query(args);
        },
      },
    },
  });
}
