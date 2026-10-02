-- RESIDENTE DIURNO Y MEDICAMENTO QUE TRAE LA FAMILIA.
--
-- Dos columnas aditivas, las dos NOT NULL con DEFAULT false: no reescriben
-- ninguna fila existente y no hay relleno que hacer. Los residentes y recetas
-- que ya existen quedan exactamente como estaban.
--
-- `esDiurno` NO se mete en `Patient.status` a proposito: un diurno SI esta
-- activo, y meterlo ahi obligaria a revisar las 38 consultas de cuido que dan
-- por hecho que ACTIVE significa «esta en el edificio».
--
-- Ver src/lib/residente-diurno.ts.

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "esDiurno" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PatientMedication" ADD COLUMN     "traeLaFamilia" BOOLEAN NOT NULL DEFAULT false;
