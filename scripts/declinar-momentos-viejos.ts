/**
 * Declina los momentos de Zendi que llevan mas de 7 dias sin resolver.
 *
 * Un momento dice como amanecio el residente ESE dia. Mandarselo hoy a la
 * familia como si fuera de hoy seria falso, y guardarlo para siempre no sirve
 * de nada: son 560 acumulados en 96 dias.
 *
 * POR QUE se acumularon, que es lo que de verdad se arreglo en codigo:
 *
 *   1. El widget solo miraba los de HOY (createdAt >= todayStart). El de ayer
 *      desaparecia de la pantalla pero seguia vivo en la base. Ahora la
 *      ventana es de 7 dias, asi que el trabajo sin terminar se ve.
 *   2. Declinar costaba -3 puntos. Quien no queria mandar ese mensaje tenia
 *      tres salidas: enviarlo igual (+3), declinar (-3) o no tocar nada (0).
 *      La tercera era la unica racional — 62 declinados frente a 560
 *      abandonados, nueve a uno. Declinar ya es gratis.
 *
 * Esto limpia lo viejo. Con los dos arreglos, no deberia volver a pasar.
 *
 * Solo toca PENDING de mas de 7 dias. Los de la ultima semana se quedan: esos
 * todavia tienen sentido enviarlos y ahora si se ven en el widget.
 *
 * Ensayo (no escribe):
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/declinar-momentos-viejos.ts
 *
 * Aplicar (deja respaldo con los ids):
 *   ... --aplicar --respaldo ~/Desktop/respaldo-momentos-viejos.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const RESPALDO = process.argv[process.argv.indexOf('--respaldo') + 1];
const CORTE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

async function main() {
    const viejos = await prisma.zendiFamilyMoment.findMany({
        where: { status: 'PENDING', createdAt: { lt: CORTE } },
        select: {
            id: true,
            createdAt: true,
            patient: { select: { name: true } },
            author: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    const recientes = await prisma.zendiFamilyMoment.count({
        where: { status: 'PENDING', createdAt: { gte: CORTE } },
    });

    console.log(`Corte: ${CORTE.toISOString().slice(0, 10)}\n`);
    console.log(`Momentos PENDING de mas de 7 dias .... ${viejos.length}   <- a declinar`);
    console.log(`Momentos PENDING de la ultima semana . ${recientes}   <- se quedan visibles`);

    if (viejos.length === 0) return;

    const mas = viejos[0];
    console.log(`\nEl mas viejo es del ${mas.createdAt.toISOString().slice(0, 10)} (${Math.floor((Date.now() - mas.createdAt.getTime()) / 864e5)} dias)`);

    if (!APLICAR) {
        console.log('\nENSAYO — no se escribio nada. Anade --aplicar para ejecutar.');
        return;
    }

    if (RESPALDO) {
        writeFileSync(RESPALDO, JSON.stringify(
            viejos.map(m => ({
                id: m.id,
                creadoEl: m.createdAt,
                residente: m.patient.name,
                autor: m.author.name,
                statusAnterior: 'PENDING',
            })), null, 2));
        console.log(`\nRespaldo escrito en ${RESPALDO}`);
    }

    const r = await prisma.zendiFamilyMoment.updateMany({
        where: { id: { in: viejos.map(m => m.id) } },
        data: { status: 'DECLINED' },
    });
    console.log(`Declinados: ${r.count}`);

    const quedanViejos = await prisma.zendiFamilyMoment.count({
        where: { status: 'PENDING', createdAt: { lt: CORTE } },
    });
    const quedanRecientes = await prisma.zendiFamilyMoment.count({
        where: { status: 'PENDING', createdAt: { gte: CORTE } },
    });
    console.log(`Viejos que quedan (debe ser 0) ......... ${quedanViejos}`);
    console.log(`Recientes intactos (debe seguir igual) . ${quedanRecientes}`);
}

main()
    .catch(e => { console.error('Error:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
