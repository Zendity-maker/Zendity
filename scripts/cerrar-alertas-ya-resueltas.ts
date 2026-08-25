/**
 * Cierra las alertas clínicas cuyo ticket de triage ya se resolvió.
 *
 * Cada reporte crea DOS filas: el DailyLog crudo y un TriageTicket que lo
 * apunta. Hasta el 25-ago-2026 cada pantalla cerraba solo su copia, así que
 * resolver en el centro de triage dejaba la alerta viva en el inbox del
 * supervisor. Medido en Cupey: 296 alertas levantadas, CERO resueltas, con
 * 248 de ellas ya atendidas del lado del triage.
 *
 * El código ya está corregido (src/lib/triage-sync.ts) y de aquí en adelante
 * el cierre es en ambos sentidos. Esto limpia lo acumulado.
 *
 * Solo toca DailyLog cuyo ticket tiene resolvedAt. Si el ticket sigue
 * abierto, la alerta se queda abierta: no cierra nada que nadie haya atendido.
 *
 * Ensayo (no escribe):
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/cerrar-alertas-ya-resueltas.ts
 *
 * Aplicar (deja respaldo con los ids):
 *   ... npx tsx scripts/cerrar-alertas-ya-resueltas.ts --aplicar --respaldo ~/Desktop/respaldo-alertas.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const RESPALDO = process.argv[process.argv.indexOf('--respaldo') + 1];

async function main() {
    const abiertas = await prisma.dailyLog.findMany({
        where: { isClinicalAlert: true, isResolved: false },
        select: { id: true, createdAt: true, notes: true },
    });

    const tickets = await prisma.triageTicket.findMany({
        where: {
            originType: 'DAILY_LOG',
            originReferenceId: { in: abiertas.map(a => a.id) },
            resolvedAt: { not: null },
        },
        select: { originReferenceId: true, resolvedAt: true, resolvedById: true },
    });

    const cerrables = new Map(tickets.map(t => [t.originReferenceId!, t]));
    const objetivo = abiertas.filter(a => cerrables.has(a.id));

    console.log(`Alertas clínicas abiertas ................ ${abiertas.length}`);
    console.log(`   ...cuyo ticket YA se resolvió ......... ${objetivo.length}  <- a cerrar`);
    console.log(`   ...sin ticket o con ticket abierto .... ${abiertas.length - objetivo.length}  <- se quedan`);

    if (objetivo.length === 0) return;

    if (!APLICAR) {
        console.log('\nENSAYO — no se escribió nada. Añade --aplicar para ejecutar.');
        return;
    }

    if (RESPALDO) {
        writeFileSync(RESPALDO, JSON.stringify(
            objetivo.map(o => ({
                dailyLogId: o.id,
                createdAt: o.createdAt,
                nota: (o.notes || '').slice(0, 120),
                ticketResueltoEl: cerrables.get(o.id)?.resolvedAt,
                isResolvedAnterior: false,
            })), null, 2));
        console.log(`\nRespaldo escrito en ${RESPALDO}`);
    }

    const r = await prisma.dailyLog.updateMany({
        where: { id: { in: objetivo.map(o => o.id) } },
        data: { isResolved: true },
    });
    console.log(`Cerradas: ${r.count}`);

    const quedan = await prisma.dailyLog.count({ where: { isClinicalAlert: true, isResolved: false } });
    console.log(`Alertas que siguen abiertas (correcto): ${quedan}`);
}

main()
    .catch(e => { console.error('Error:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
