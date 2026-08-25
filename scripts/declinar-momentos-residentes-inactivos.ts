/**
 * Declina los momentos de Zendi que quedaron pendientes de residentes que ya
 * no están en el hogar.
 *
 * Al aprobar un momento, Zendity notificaba a la familia. Habia 38 en PENDING
 * de residentes fallecidos o dados de baja: aprobar uno le habria mandado a la
 * familia un aviso sobre su ser querido meses despues. El codigo ya no
 * notifica en ese caso (commit 7288fa5), pero los momentos siguen apareciendo
 * en la cola de la supervisora mezclados con los de residentes actuales.
 *
 * Esto los cierra. No borra nada: quedan en DECLINED y el momento sigue en el
 * expediente del residente.
 *
 * Solo toca status PENDING de residentes DISCHARGED o DECEASED. Un momento de
 * un residente activo no se toca jamas, aunque sea viejo.
 *
 * Ensayo (no escribe):
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/declinar-momentos-residentes-inactivos.ts
 *
 * Aplicar (deja respaldo con los ids y su estado anterior):
 *   ... --aplicar --respaldo ~/Desktop/respaldo-momentos.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const RESPALDO = process.argv[process.argv.indexOf('--respaldo') + 1];

async function main() {
    const objetivo = await prisma.zendiFamilyMoment.findMany({
        where: {
            status: 'PENDING',
            patient: { status: { in: ['DISCHARGED', 'DECEASED'] } },
        },
        select: {
            id: true,
            createdAt: true,
            patientId: true,
            patient: { select: { name: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    console.log(`Momentos PENDING de residentes que ya no estan: ${objetivo.length}\n`);

    const porResidente = new Map<string, number>();
    for (const m of objetivo) {
        const k = `${m.patient.name} (${m.patient.status})`;
        porResidente.set(k, (porResidente.get(k) ?? 0) + 1);
    }
    [...porResidente].sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => console.log(`   ${String(v).padStart(3)}  ${k}`));

    // Control: cuantos PENDING quedan de residentes que SI estan. No se tocan.
    const activos = await prisma.zendiFamilyMoment.count({
        where: { status: 'PENDING', patient: { status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } } },
    });
    console.log(`\nPENDING de residentes activos (NO se tocan): ${activos}`);

    if (objetivo.length === 0) return;

    if (!APLICAR) {
        console.log('\nENSAYO — no se escribio nada. Anade --aplicar para ejecutar.');
        return;
    }

    if (RESPALDO) {
        writeFileSync(RESPALDO, JSON.stringify(
            objetivo.map(m => ({
                id: m.id,
                creadoEl: m.createdAt,
                residente: m.patient.name,
                estadoResidente: m.patient.status,
                statusAnterior: 'PENDING',
            })), null, 2));
        console.log(`\nRespaldo escrito en ${RESPALDO}`);
    }

    const r = await prisma.zendiFamilyMoment.updateMany({
        where: { id: { in: objetivo.map(m => m.id) } },
        data: { status: 'DECLINED' },
    });
    console.log(`Declinados: ${r.count}`);

    const quedan = await prisma.zendiFamilyMoment.count({
        where: { status: 'PENDING', patient: { status: { in: ['DISCHARGED', 'DECEASED'] } } },
    });
    const activosDespues = await prisma.zendiFamilyMoment.count({
        where: { status: 'PENDING', patient: { status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } } },
    });
    console.log(`Quedan de inactivos (debe ser 0) ....... ${quedan}`);
    console.log(`PENDING de activos (debe seguir igual) . ${activosDespues}`);
}

main()
    .catch(e => { console.error('Error:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
