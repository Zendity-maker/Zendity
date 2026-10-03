-- Marcar una ficha que nunca fue un residente.
--
-- Aditiva: solo anade una columna con default, no toca ni una fila existente.
-- El relleno de las cuatro fichas duplicadas que ya hay va aparte, por script
-- con dry-run, porque decidir cual ficha sobra es una lectura y no una regla.
--
-- Ver la nota del campo en schema.prisma: es la misma familia que
-- MedStatus.VOIDED — la fila se conserva y deja de contar.
ALTER TABLE "Patient" ADD COLUMN     "fichaAnulada" BOOLEAN NOT NULL DEFAULT false;
