/**
 * Cierra bitácoras y alertas clínicas registradas dos veces por doble envío.
 *
 * CASO. El 01-sep-2026 apareció una alerta de María M. Meléndez duplicada con
 * DOS segundos de diferencia: misma autora, mismo texto, las dos abiertas. En
 * el panel del supervisor contaba como dos alertas distintas.
 *
 * NO BORRA. Marca la sobrante como resuelta con su motivo. El texto de la
 * bitácora es parte del expediente clínico; una fila que desaparece sin rastro
 * es peor que una marcada como duplicada. Y sale de los conteos igual, porque
 * el panel y el badge filtran por isResolved.
 *
 * Conserva SIEMPRE la primera: es la de la hora real en que se reportó.
 *
 * Detecta los pares solo: mismo residente, misma autora, MISMO TEXTO, menos de
 * dos minutos. Dos notas distintas seguidas son trabajo real y no se tocan.
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-bitacora-duplicada.ts
 *
 * Aplicar (deja respaldo JSON):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-bitacora-duplicada.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-bitacoras-dup.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const ri = process.argv.indexOf('--respaldo');
const RESPALDO = ri > -1 ? process.argv[ri + 1] : null;
const VENTANA_MS = 2 * 60 * 1000;

async function main() {
    if (APLICAR && !RESPALDO) {
        console.error('✘ --aplicar exige --respaldo <ruta>. No se escribe sin respaldo.');
        process.exit(1);
    }

    const logs = await prisma.dailyLog.findMany({
        where: { isResolved: false },
        orderBy: [{ patientId: 'asc' }, { createdAt: 'asc' }],
        select: {
            id: true, patientId: true, authorId: true, createdAt: true, notes: true,
            isClinicalAlert: true,
            patient: { select: { name: true } },
        },
    });

    // Se guarda el PAR, no solo la sobrante: para mostrar cual se conserva hay
    // que saber cual la precedio de verdad. Buscar "la primera con el mismo
    // texto" agarraba una de hace dias —las notas de limpieza se repiten a
    // diario— y el informe decia "+346 768s", que no es el par que se cierra.
    const pares: { conservar: typeof logs[number]; cerrar: typeof logs[number]; seg: number }[] = [];
    for (let i = 1; i < logs.length; i++) {
        const a = logs[i - 1], b = logs[i];
        if (a.patientId !== b.patientId) continue;
        if (a.authorId !== b.authorId) continue;
        // El TEXTO es la huella. Sin texto no hay forma de saber si dos filas
        // son la misma cosa: un baño y una comida del mismo residente en el
        // mismo minuto son dos acciones distintas y las dos van sin notas.
        // Emparejarlas cerraría trabajo real.
        if (!a.notes?.trim() || !b.notes?.trim()) continue;
        if (a.notes !== b.notes) continue;
        if (b.createdAt.getTime() - a.createdAt.getTime() > VENTANA_MS) continue;
        pares.push({ conservar: a, cerrar: b, seg: Math.round((b.createdAt.getTime() - a.createdAt.getTime()) / 1000) });
    }
    const sobrantes = pares.map(p => p.cerrar);

    console.log(`Bitácoras abiertas: ${logs.length}`);
    console.log(`Duplicadas por doble envío: ${sobrantes.length}\n`);
    pares.forEach(({ conservar, cerrar, seg }) => {
        console.log(`  ${cerrar.patient.name.trim()} — +${seg}s${cerrar.isClinicalAlert ? ' · ALERTA' : ''}`);
        console.log(`    se conserva ${conservar.id.slice(0, 8)} (${conservar.createdAt.toISOString().slice(11, 19)})   se cierra ${cerrar.id.slice(0, 8)} (${cerrar.createdAt.toISOString().slice(11, 19)})`);
        console.log(`    "${(cerrar.notes ?? '').replace(/\s+/g, ' ').slice(0, 70)}"\n`);
    });

    if (sobrantes.length === 0) { console.log('Nada que hacer.'); return; }
    if (!APLICAR) {
        console.log('── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify(sobrantes, null, 2));
    console.log(`Respaldo escrito en ${RESPALDO}`);
    const r = await prisma.dailyLog.updateMany({
        where: { id: { in: sobrantes.map(s => s.id) } },
        data: { isResolved: true },
    });
    console.log(`✔ ${r.count} cerradas como duplicadas. El texto del expediente no se tocó.`);
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
