/**
 * Cierra los registros de TRASLADO HOSPITALARIO que quedaron abiertos para
 * siempre porque nadie cierra un traslado.
 *
 * El código ya está corregido —desde hoy nacen resueltos— y esto limpia lo
 * viejo. Al 28-ago-2026 eran 35 de las 51 "alertas clínicas sin resolver", la
 * más antigua de hace 88 días.
 *
 * NO es juicio clínico: un traslado no es una tarea pendiente. Ya ocurrió, ya
 * se atendió, y el residente o volvió o no. Cerrarlo no decide nada; solo deja
 * de contarse como algo que alguien debe hacer.
 *
 * Solo toca DailyLog que cumplan LAS TRES:
 *   - isClinicalAlert = true
 *   - notes empieza por "[TRASLADO HOSPITALARIO DE EMERGENCIA]"
 *   - isResolved = false
 * Y con --dias N (por defecto 2) solo los anteriores a ese corte, para no tocar
 * un traslado que esté ocurriendo ahora mismo.
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-traslados-antiguos.ts
 *
 * Aplicar (deja respaldo JSON con los ids):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-traslados-antiguos.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-traslados.json
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
    if (!Number.isFinite(DIAS) || DIAS < 1) {
        console.error('✘ --dias debe ser un entero ≥ 1.');
        process.exit(1);
    }

    const corte = new Date(Date.now() - DIAS * 86400000);
    const abiertos = await prisma.dailyLog.findMany({
        where: {
            isClinicalAlert: true,
            isResolved: false,
            notes: { startsWith: '[TRASLADO HOSPITALARIO DE EMERGENCIA]' },
            createdAt: { lt: corte },
        },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true, createdAt: true,
            patient: { select: { name: true, status: true } },
        },
    });

    console.log(`Traslados abiertos anteriores a ${corte.toISOString().slice(0,10)} (${DIAS} días): ${abiertos.length}\n`);
    const porEstado = new Map<string, number>();
    abiertos.forEach(a => porEstado.set(a.patient.status, (porEstado.get(a.patient.status) ?? 0) + 1));
    [...porEstado].forEach(([e, n]) => console.log(`  residente ${e}: ${n}`));

    if (abiertos.length === 0) { console.log('\nNada que hacer.'); return; }
    const masViejo = Math.floor((Date.now() - abiertos[0].createdAt.getTime()) / 86400000);
    console.log(`\n  el más antiguo: ${masViejo} días — ${abiertos[0].patient.name.trim()}`);

    if (!APLICAR) {
        console.log('\n── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify(abiertos, null, 2));
    console.log(`\nRespaldo escrito en ${RESPALDO}`);

    // Solo isResolved. NO se toca el texto: la bitácora del traslado es parte
    // del expediente clínico y se queda tal cual se escribió.
    const r = await prisma.dailyLog.updateMany({
        where: { id: { in: abiertos.map(a => a.id) } },
        data: { isResolved: true },
    });
    console.log(`✔ ${r.count} traslados cerrados. El texto del expediente no se tocó.`);
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
