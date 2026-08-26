/**
 * Retira la gift card y el saldo prepagado de Concierge.
 *
 * Concierge pasa de prepago a post-pago (26-ago-2026): la familia pide,
 * direccion aprueba, y se cobra en la factura del mes al entregar. Con eso, la
 * recarga de saldo deja de tener funcion — solo anade un concepto que la
 * familia tiene que entender antes de poder pedir nada.
 *
 * Limpia dos cosas:
 *
 *   1. El producto "Gift Card". Se BORRA si nadie lo pidio nunca; si hay algun
 *      pedido historico se desactiva en vez de borrarse, para no romper el
 *      registro de ese pedido.
 *
 *   2. Los saldos prepagados que queden. En Cupey hay uno solo: $20 de Natalia
 *      Diaz Rios, que es la abuela de Andres y fue una prueba del modulo.
 *
 * Ensayo (no escribe):
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/limpiar-concierge-prepago.ts
 *
 * Aplicar:
 *   ... --aplicar --respaldo ~/Desktop/respaldo-concierge.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const RESPALDO = process.argv[process.argv.indexOf('--respaldo') + 1];

async function main() {
    const giftCards = await prisma.conciergeProduct.findMany({
        where: { category: 'GiftCards' },
        select: { id: true, name: true, price: true, isActive: true },
    });

    const conSaldo = await prisma.patient.findMany({
        where: { conciergeBalance: { gt: 0 } },
        select: { id: true, name: true, conciergeBalance: true },
    });

    console.log(`Productos "Gift Card": ${giftCards.length}`);
    for (const g of giftCards) {
        const pedidos = await prisma.conciergeOrder.count({ where: { productId: g.id } });
        console.log(`   ${g.name} — $${g.price} — ${pedidos} pedido(s) historico(s) → ${pedidos === 0 ? 'SE BORRA' : 'se desactiva'}`);
    }

    console.log(`\nResidentes con saldo prepagado: ${conSaldo.length}`);
    conSaldo.forEach(p => console.log(`   $${p.conciergeBalance}  ${p.name.trim()}`));

    if (giftCards.length === 0 && conSaldo.length === 0) {
        console.log('\nNada que limpiar.');
        return;
    }

    if (!APLICAR) {
        console.log('\nENSAYO — no se escribio nada. Anade --aplicar para ejecutar.');
        return;
    }

    if (RESPALDO) {
        writeFileSync(RESPALDO, JSON.stringify({ giftCards, saldos: conSaldo }, null, 2));
        console.log(`\nRespaldo escrito en ${RESPALDO}`);
    }

    let borrados = 0, desactivados = 0;
    for (const g of giftCards) {
        const pedidos = await prisma.conciergeOrder.count({ where: { productId: g.id } });
        if (pedidos === 0) {
            await prisma.conciergeProduct.delete({ where: { id: g.id } });
            borrados++;
        } else {
            await prisma.conciergeProduct.update({ where: { id: g.id }, data: { isActive: false } });
            desactivados++;
        }
    }

    const r = await prisma.patient.updateMany({
        where: { conciergeBalance: { gt: 0 } },
        data: { conciergeBalance: 0 },
    });

    console.log(`\nGift cards borradas: ${borrados} · desactivadas: ${desactivados}`);
    console.log(`Saldos puestos a cero: ${r.count}`);

    const quedan = await prisma.conciergeProduct.count({ where: { category: 'GiftCards', isActive: true } });
    const saldos = await prisma.patient.count({ where: { conciergeBalance: { gt: 0 } } });
    console.log(`\nGift cards activas (debe ser 0): ${quedan}`);
    console.log(`Saldos > 0 (debe ser 0): ${saldos}`);
}

main()
    .catch(e => { console.error('Error:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
