/**
 * Corrige el foodIntake falso de las alertas clínicas.
 *
 * Las rutas de alerta (CLÍNICA, UPP/PIEL, VITALES) escribían foodIntake: 100
 * en el DailyLog — un registro que no dice nada sobre comida quedaba como
 * "comió el 100%". 250 registros entre el 23-may y el 24-ago-2026, incluido
 * un traslado al hospital por vómitos. El código ya está corregido; esto
 * limpia lo viejo.
 *
 * Solo toca filas con isClinicalAlert = true Y notes que empieza por uno de
 * los tres prefijos de alerta. Nunca toca una bitácora real de comida.
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/limpiar-foodintake-alertas.ts
 *
 * Aplicar (deja respaldo JSON con los ids y el valor anterior):
 *   DATABASE_URL="..." npx tsx scripts/limpiar-foodintake-alertas.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-foodintake.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
const p = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const RESPALDO = process.argv[process.argv.indexOf('--respaldo') + 1];

const PREFIJOS = ['[ALERTA CLÍNICA]', '[ALERTA UPP/PIEL]', '[ALERTA VITALES]'];

async function main() {
  const objetivo = await p.dailyLog.findMany({
    where: {
      foodIntake: 100,
      isClinicalAlert: true,
      OR: PREFIJOS.map(pre => ({ notes: { startsWith: pre } })),
    },
    select: { id: true, patientId: true, notes: true, createdAt: true },
  });

  console.log(`Registros a corregir (foodIntake 100 -> null): ${objetivo.length}`);

  if (!APLICAR) {
    console.log('ENSAYO — no se escribió nada. Añade --aplicar para ejecutar.');
    return;
  }

  writeFileSync(RESPALDO, JSON.stringify(
    objetivo.map(o => ({ ...o, foodIntakeAnterior: 100 })), null, 2));
  console.log(`Respaldo escrito en ${RESPALDO}`);

  const r = await p.dailyLog.updateMany({
    where: { id: { in: objetivo.map(o => o.id) } },
    data: { foodIntake: null },
  });
  console.log(`Actualizados: ${r.count}`);

  const quedan = await p.dailyLog.count({
    where: { foodIntake: 100, isClinicalAlert: true,
             OR: PREFIJOS.map(pre => ({ notes: { startsWith: pre } })) },
  });
  console.log(`Quedan sin corregir: ${quedan}`);
}
main().finally(() => p.$disconnect());
