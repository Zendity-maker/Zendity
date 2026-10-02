-- La jornada del residente diurno: a que hora llego y a que hora se fue.
--
-- Solo CREATE TABLE y sus indices. No toca ni una tabla existente, no mueve ni
-- una fila. El SQL lo calculo `prisma migrate diff` contra produccion, no se
-- escribio a mano.
--
-- El indice unico (patientId, fecha) no es solo integridad: es la guarda contra
-- el doble envio. Marcar «llego» dos veces no crea dos filas — el upsert
-- encuentra la que ya existe y devuelve EXITO con ella. Un error en rojo haria
-- que la cuidadora lo intentara otra vez, que es justo lo que produce duplicados.

-- CreateTable
CREATE TABLE "JornadaDiurna" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "llegadaAt" TIMESTAMP(3),
    "llegadaPorId" TEXT,
    "salidaAt" TIMESTAMP(3),
    "salidaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JornadaDiurna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JornadaDiurna_headquartersId_fecha_idx" ON "JornadaDiurna"("headquartersId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "JornadaDiurna_patientId_fecha_key" ON "JornadaDiurna"("patientId", "fecha");

-- AddForeignKey
ALTER TABLE "JornadaDiurna" ADD CONSTRAINT "JornadaDiurna_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

