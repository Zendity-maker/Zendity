/**
 * Cierra alertas clínicas abiertas de residentes que ya no están en el hogar.
 *
 * Al 28-ago-2026 había 4: dos de José J. Hernández (dado de baja) y dos de
 * residentes fallecidas —Sara E. Díaz y María T. González— ambas con "poco
 * apetito" de hace 89 días.
 *
 * Nadie va a atender eso nunca. Y una tarea pendiente a nombre de alguien que
 * murió no es solo un contador que no baja: es un renglón que no debería estar
 * ahí cuando alguien abre la pantalla.
 *
 * NO toca residentes en TEMPORARY_LEAVE. Esos vuelven, y sus alertas siguen
 * siendo pertinentes — al correr esto había 6 de José Troche y Dwight Santiago
 * que se quedan donde están.
 *
 * Solo toca isResolved. El texto del expediente clínico no se toca nunca.
 *
 * Tampoco toca nada de los últimos --dias (por defecto 2). Un registro recién
 * escrito puede estar en medio de algo que sigue en curso; barrerlo el mismo
 * día no es limpieza, es borrar el rastro mientras todavía se usa.
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-alertas-residentes-idos.ts
 *
 * Aplicar (deja respaldo JSON):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-alertas-residentes-idos.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-alertas-idos.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const ri = process.argv.indexOf('--respaldo');
const RESPALDO = ri > -1 ? process.argv[ri + 1] : null;
const di = process.argv.indexOf('--dias');
const DIAS = di > -1 ? parseInt(process.argv[di + 1], 10) : 2;

async function main() {
    if (APLICAR && !RESPALDO) {
        console.error('✘ --aplicar exige --respaldo <ruta>. No se escribe sin respaldo.');
        process.exit(1);
    }

    const abiertas = await prisma.dailyLog.findMany({
        where: {
            isClinicalAlert: true,
            isResolved: false,
            patient: { status: { in: ['DECEASED', 'DISCHARGED'] } },
            createdAt: { lt: new Date(Date.now() - DIAS * 86400000) },
        },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true, createdAt: true, notes: true,
            patient: { select: { name: true, status: true } },
        },
    });

    console.log(`Alertas abiertas de residentes fallecidos o dados de baja, anteriores a ${DIAS} días: ${abiertas.length}\n`);
    abiertas.forEach(a => {
        const dias = Math.floor((Date.now() - a.createdAt.getTime()) / 86400000);
        console.log(`  ${String(dias).padStart(3)}d  ${a.patient.status.padEnd(11)} ${a.patient.name.trim().padEnd(26)} ${(a.notes ?? '').slice(0, 46)}`);
    });

    const enHospital = await prisma.dailyLog.count({
        where: { isClinicalAlert: true, isResolved: false, patient: { status: 'TEMPORARY_LEAVE' } },
    });
    console.log(`\n  (Se dejan intactas ${enHospital} de residentes en el hospital — esos vuelven.)`);

    if (abiertas.length === 0) { console.log('\nNada que hacer.'); return; }
    if (!APLICAR) {
        console.log('\n── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify(abiertas, null, 2));
    console.log(`\nRespaldo escrito en ${RESPALDO}`);
    const r = await prisma.dailyLog.updateMany({
        where: { id: { in: abiertas.map(a => a.id) } },
        data: { isResolved: true },
    });
    console.log(`✔ ${r.count} alertas cerradas. El texto del expediente no se tocó.`);
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
