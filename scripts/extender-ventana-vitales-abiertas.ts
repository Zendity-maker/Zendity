/**
 * Extiende a 4 horas las órdenes de vitales que siguen abiertas.
 *
 * El cambio de ventana solo afecta a las órdenes NUEVAS: expiresAt se calcula
 * al crearlas y queda escrito en la fila. Las que ya estaban abiertas cuando
 * Celia pidió las 4 horas conservan su vencimiento de 3 — así que quien tiene
 * un turno en curso seguiría con el plazo viejo sin que nada se lo diga.
 *
 * Al correrlo el 01-sep-2026 eran 23 órdenes de Mariangelie, que vencían a las
 * 12:07 y pasan a las 13:07 AST.
 *
 * Solo toca PENDING. Una orden ya vencida o completada no se reabre: eso
 * cambiaría un resultado que ya ocurrió.
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/extender-ventana-vitales-abiertas.ts
 *
 * Aplicar (deja respaldo JSON):
 *   DATABASE_URL="..." npx tsx scripts/extender-ventana-vitales-abiertas.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-ventana-vitales.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { VITALS_WINDOW_MS } from '../src/lib/vitals-window';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const ri = process.argv.indexOf('--respaldo');
const RESPALDO = ri > -1 ? process.argv[ri + 1] : null;
const AST = (d: Date) => `${String((d.getUTCHours() + 20) % 24).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

async function main() {
    if (APLICAR && !RESPALDO) {
        console.error('✘ --aplicar exige --respaldo <ruta>. No se escribe sin respaldo.');
        process.exit(1);
    }

    const abiertas = await prisma.vitalsOrder.findMany({
        where: { status: 'PENDING' },
        select: {
            id: true, orderedAt: true, expiresAt: true,
            caregiver: { select: { name: true } },
            patient: { select: { name: true } },
        },
    });

    // Solo las que ganan tiempo. Si ya nacieron con la ventana nueva, no se tocan.
    const aExtender = abiertas
        .map(o => ({ ...o, nuevo: new Date(o.orderedAt.getTime() + VITALS_WINDOW_MS) }))
        .filter(o => o.nuevo > o.expiresAt);

    console.log(`Órdenes abiertas: ${abiertas.length} · a extender: ${aExtender.length}\n`);
    const porC = new Map<string, { n: number; de: Date; a: Date }>();
    aExtender.forEach(o => {
        const k = o.caregiver?.name?.trim() ?? '—';
        if (!porC.has(k)) porC.set(k, { n: 0, de: o.expiresAt, a: o.nuevo });
        porC.get(k)!.n++;
    });
    [...porC].forEach(([n, v]) =>
        console.log(`  ${n.padEnd(26)} ${v.n} órdenes · ${AST(v.de)} → ${AST(v.a)} AST`));

    if (aExtender.length === 0) { console.log('\nNada que hacer.'); return; }
    if (!APLICAR) {
        console.log('\n── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify(aExtender, null, 2));
    console.log(`\nRespaldo escrito en ${RESPALDO}`);

    let n = 0;
    for (const o of aExtender) {
        await prisma.vitalsOrder.update({ where: { id: o.id }, data: { expiresAt: o.nuevo } });
        n++;
    }
    console.log(`✔ ${n} órdenes extendidas a la ventana vigente.`);
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
