-- Estado VOIDED en MedStatus: una fila que registra un acto YA registrado en
-- otra. Ver el comentario del enum en prisma/schema.prisma.
--
-- Aditivo. PostgreSQL no permite quitar un valor de un enum, asi que esto no
-- se puede revertir con un DOWN: si hubiera que retirarlo habria que recrear
-- el tipo. Se añade sabiendolo.
ALTER TYPE "MedStatus" ADD VALUE 'VOIDED';
