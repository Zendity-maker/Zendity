-- CreateTable
CREATE TABLE "RotacionNoRealizada" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "nota" TEXT,
    "momento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotacionNoRealizada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RotacionNoRealizada_patientId_momento_idx" ON "RotacionNoRealizada"("patientId", "momento");

-- CreateIndex
CREATE INDEX "RotacionNoRealizada_headquartersId_momento_idx" ON "RotacionNoRealizada"("headquartersId", "momento");

-- AddForeignKey
ALTER TABLE "RotacionNoRealizada" ADD CONSTRAINT "RotacionNoRealizada_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotacionNoRealizada" ADD CONSTRAINT "RotacionNoRealizada_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotacionNoRealizada" ADD CONSTRAINT "RotacionNoRealizada_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

