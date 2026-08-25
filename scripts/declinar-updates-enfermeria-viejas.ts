/**
 * Declina las actualizaciones de enfermeria que quedaron pendientes.
 *
 * Solo existieron 2 en toda la historia — 30-jun y 3-jul-2026, ambas sin
 * enviar — porque el widget vivia en /care y la enfermera del hogar tiene cero
 * turnos abiertos en esa pantalla. El modelo se cambio: ahora el borrador se
 * pide desde el expediente del residente.
 *
 * Estas llevan datos clinicos de hace dos meses: presion, medicamentos de esa
 * semana, notas de turno de entonces. Mandarselas hoy a una familia seria
 * decirle algo que ya no es cierto.
 *
 * Ensayo (no escribe):
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/declinar-updates-enfermeria-viejas.ts
 *
 * Aplicar:
 *   ... --aplicar --respaldo ~/Desktop/respaldo-updates-enfermeria.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const RESPALDO = process.argv[process.argv.indexOf('--respaldo') + 1];
const CORTE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

async function main() {
    const viejas = await prisma.zendiNursingUpdate.findMany({
        where: { status: 'PENDING', createdAt: { lt: CORTE } },
        select: {
            id: true,
            createdAt: true,
            patient: { select: { name: true } },
            author: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    console.log(`Actualizaciones de enfermeria PENDING de mas de 7 dias: ${viejas.length}\n`);
    viejas.forEach(u => console.log(
        `   ${u.createdAt.toISOString().slice(0, 10)}  ${u.patient.name.padEnd(28)} por ${u.author.name}`));

    if (viejas.length === 0) return;

    if (!APLICAR) {
        console.log('\nENSAYO — no se escribio nada. Anade --aplicar para ejecutar.');
        return;
    }

    if (RESPALDO) {
        writeFileSync(RESPALDO, JSON.stringify(
            viejas.map(u => ({
                id: u.id,
                creadoEl: u.createdAt,
                residente: u.patient.name,
                autor: u.author.name,
                statusAnterior: 'PENDING',
            })), null, 2));
        console.log(`\nRespaldo escrito en ${RESPALDO}`);
    }

    const r = await prisma.zendiNursingUpdate.updateMany({
        where: { id: { in: viejas.map(u => u.id) } },
        data: { status: 'DECLINED' },
    });
    console.log(`Declinadas: ${r.count}`);

    const quedan = await prisma.zendiNursingUpdate.count({ where: { status: 'PENDING' } });
    console.log(`PENDING que quedan: ${quedan}`);
}

main()
    .catch(e => { console.error('Error:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
