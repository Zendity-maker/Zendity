/**
 * Cierra una caída registrada dos veces por doble envío.
 *
 * CASO. La caída de Pura Hornedo del 30-ago-2026 entró DOS veces con 6 segundos
 * de diferencia — 12:29:49 y 12:29:55 — con los mismos datos, la misma
 * gravedad y las mismas intervenciones. Cada una creó su propio ticket de
 * triage, así que contaba doble en el panel, en el historial de la residente y
 * en las métricas de caídas.
 *
 * NO BORRA. Marca la sobrante como resuelta con la nota de por qué, y cierra
 * también su ticket de triage. Razones:
 *   - El historial de caídas de un residente es material clínico y legal. Una
 *     fila que desaparece sin rastro es peor que una marcada como duplicada.
 *   - Es reversible.
 *   - Sale de los conteos igual: el panel y las métricas filtran por resolvedAt.
 *
 * Conserva SIEMPRE la primera —la más antigua— porque es la que refleja la
 * hora real en que se reportó el evento.
 *
 * Detecta pares automáticamente: mismo residente, menos de 5 minutos de
 * diferencia, ambas sin resolver. No hay que pasarle ids.
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-caida-duplicada.ts
 *
 * Aplicar (deja respaldo JSON):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-caida-duplicada.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-caida-duplicada.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const ri = process.argv.indexOf('--respaldo');
const RESPALDO = ri > -1 ? process.argv[ri + 1] : null;
const VENTANA_MS = 5 * 60000;

async function main() {
    if (APLICAR && !RESPALDO) {
        console.error('✘ --aplicar exige --respaldo <ruta>. No se escribe sin respaldo.');
        process.exit(1);
    }

    const caidas = await prisma.fallIncident.findMany({
        where: { resolvedAt: null },
        orderBy: { reportedAt: 'asc' },
        select: {
            id: true, patientId: true, reportedAt: true, severity: true,
            location: true, interventions: true, notes: true,
            patient: { select: { name: true } },
        },
    });

    // Pares del mismo residente dentro de la ventana. Se conserva la primera.
    const sobrantes: typeof caidas = [];
    for (let i = 1; i < caidas.length; i++) {
        const a = caidas[i - 1], b = caidas[i];
        if (a.patientId !== b.patientId) continue;
        if (b.reportedAt.getTime() - a.reportedAt.getTime() > VENTANA_MS) continue;
        sobrantes.push(b);
    }

    console.log(`Caídas abiertas: ${caidas.length}`);
    console.log(`Duplicadas por doble envío: ${sobrantes.length}\n`);
    sobrantes.forEach(s => {
        const primera = caidas.find(c => c.patientId === s.patientId && c.reportedAt < s.reportedAt);
        console.log(`  ${s.patient.name.trim()}`);
        console.log(`    se conserva  ${primera?.id.slice(0, 8)}  ${primera?.reportedAt.toISOString().slice(11, 19)}`);
        console.log(`    se cierra    ${s.id.slice(0, 8)}  ${s.reportedAt.toISOString().slice(11, 19)}  (+${Math.round((s.reportedAt.getTime() - (primera?.reportedAt.getTime() ?? 0)) / 1000)}s)\n`);
    });

    if (sobrantes.length === 0) { console.log('Nada que hacer.'); return; }
    if (!APLICAR) {
        console.log('── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify(sobrantes, null, 2));
    console.log(`Respaldo escrito en ${RESPALDO}`);

    const ids = sobrantes.map(s => s.id);
    const r = await prisma.fallIncident.updateMany({
        where: { id: { in: ids } },
        data: {
            resolvedAt: new Date(),
            resolutionNote: 'Duplicada por doble envío del formulario. El registro válido es el primero de la misma hora.',
        },
    });
    // El ticket de triage de la sobrante también, o el panel la sigue contando.
    const t = await prisma.triageTicket.updateMany({
        where: { originType: 'FALL', originReferenceId: { in: ids }, status: { not: 'RESOLVED' } },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    console.log(`✔ ${r.count} caída(s) cerradas como duplicadas · ${t.count} ticket(s) de triage cerrados.`);
    console.log('  Las filas se conservan: salen de los conteos, no del historial.');
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
