-- CreateEnum
CREATE TYPE "RegistroOrigen" AS ENUM ('TABLETA', 'EMAR_DIRECCION', 'CIERRE_DE_TURNO', 'CRON');

-- AlterTable
ALTER TABLE "MedicationAdministration" ADD COLUMN     "origen" "RegistroOrigen";

