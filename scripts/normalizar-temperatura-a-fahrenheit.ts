/**
 * Convierte a Fahrenheit las lecturas de temperatura que quedaron en Celsius.
 *
 * CONTEXTO
 * --------
 * Hasta el 08-sep-2026, /api/care/vitals guardaba el numero crudo que escribia
 * la cuidadora. El hogar usa termometros que se cambian de escala, asi que
 * 1,751 de 5,994 lecturas (29%) quedaron en Celsius dentro de un campo que
 * todo el sistema lee como Fahrenheit. El commit 86c0279 arreglo la escritura
 * (ahora se normaliza al guardar) y la lectura (aFahrenheit tambien al leer).
 * Este script arregla lo que ya estaba escrito.
 *
 * POR QUE ES SEGURO
 * -----------------
 * Las bandas NO se solapan: 30-45 solo puede ser Celsius (nadie tiene 36 °F),
 * 95-113 solo puede ser Fahrenheit, y 45-95 es imposible (0 filas). No existe
 * un valor que se pueda interpretar de dos formas, asi que la conversion es
 * determinista y no hay criterio que adivinar.
 *
 * Ademas es IDEMPOTENTE: aFahrenheit(97.5) = 97.5. Correrlo dos veces no mueve
 * ningun numero.
 *
 * Se actualiza POR ID, no por igualdad de float, para no depender de como
 * Postgres compara un double.
 *
 * USO
 * ---
 *   npx tsx scripts/normalizar-temperatura-a-fahrenheit.ts             (solo mira)
 *   npx tsx scripts/normalizar-temperatura-a-fahrenheit.ts --escribir  (convierte)
 */
import { writeFileSync } from 'fs';
import { prisma } from '../src/lib/prisma';
import { aFahrenheit } from '../src/lib/vitals-thresholds';

const ESCRIBIR = process.argv.includes('--escribir');
const LOTE = 200;

type Fila = { id: string; temperature: number | null; createdAt: Date; patientId: string };

async function main() {
    const todas = await prisma.vitalSigns.findMany({
        where: { temperature: { not: null } },
        select: { id: true, temperature: true, createdAt: true, patientId: true },
        orderBy: { createdAt: 'asc' },
    }) as Fila[];

    const enCelsius = todas.filter(f => f.temperature! < 45);
    const ilegibles = todas.filter(f => aFahrenheit(f.temperature) === null);

    console.log(`Lecturas con temperatura ....... ${todas.length}`);
    console.log(`En Celsius (a convertir) ....... ${enCelsius.length}`);
    console.log(`Ilegibles (NO se tocan) ........ ${ilegibles.length}`);

    if (ilegibles.length) {
        console.log('\n  Estas quedan como estan — no son ni Celsius ni Fahrenheit:');
        ilegibles.slice(0, 20).forEach(f =>
            console.log(`    ${f.createdAt.toISOString().slice(0, 10)}  ${f.temperature}`));
    }

    if (enCelsius.length === 0) { console.log('\nNada que convertir.'); return; }

    const menor = Math.min(...enCelsius.map(f => f.temperature!));
    const mayor = Math.max(...enCelsius.map(f => f.temperature!));
    console.log(`\nRango de lo que se convierte ... ${menor} a ${mayor} °C`);
    console.log(`                                = ${aFahrenheit(menor)} a ${aFahrenheit(mayor)} °F`);

    const porMes = new Map<string, number>();
    enCelsius.forEach(f => {
        const k = f.createdAt.toISOString().slice(0, 7);
        porMes.set(k, (porMes.get(k) ?? 0) + 1);
    });
    console.log('\nPor mes:');
    [...porMes.entries()].sort().forEach(([k, n]) => console.log(`   ${k}   ${n}`));

    console.log('\nMuestra:');
    enCelsius.slice(0, 5).concat(enCelsius.slice(-5)).forEach(f =>
        console.log(`   ${f.createdAt.toISOString().slice(0, 10)}   ${String(f.temperature).padStart(5)} °C  ->  ${aFahrenheit(f.temperature)} °F`));

    if (!ESCRIBIR) {
        console.log(`\n[SOLO MIRANDO] Para convertir: --escribir`);
        return;
    }

    // Agrupar por valor destino: un updateMany por valor, filtrando por ID.
    const porDestino = new Map<number, string[]>();
    enCelsius.forEach(f => {
        const destino = aFahrenheit(f.temperature)!;
        (porDestino.get(destino) ?? porDestino.set(destino, []).get(destino)!).push(f.id);
    });

    // Respaldo local antes de tocar nada: id + valor viejo, para poder
    // deshacerlo sin depender del snapshot de Neon.
    const respaldo = `scripts/respaldo-temperatura-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    writeFileSync(respaldo, JSON.stringify(
        enCelsius.map(f => ({ id: f.id, antes: f.temperature, despues: aFahrenheit(f.temperature) })), null, 1));
    console.log(`\nRespaldo escrito: ${respaldo}`);

    console.log(`ESCRIBIENDO — ${porDestino.size} valores distintos, ${enCelsius.length} filas...`);
    let hechas = 0;
    for (const [destino, ids] of porDestino) {
        for (let i = 0; i < ids.length; i += LOTE) {
            const r = await prisma.vitalSigns.updateMany({
                where: { id: { in: ids.slice(i, i + LOTE) } },
                data: { temperature: destino },
            });
            hechas += r.count;
        }
    }
    console.log(`Filas actualizadas: ${hechas} de ${enCelsius.length}`);

    // Verificacion posterior: releer de la base, no confiar en el contador.
    const quedan = await prisma.vitalSigns.count({
        where: { temperature: { not: null, lt: 45 } },
    });
    const totalDespues = await prisma.vitalSigns.count({ where: { temperature: { not: null } } });
    console.log(`\nVERIFICACION`);
    console.log(`  Lecturas con temperatura ..... ${totalDespues}  (antes ${todas.length})`);
    console.log(`  Quedan en Celsius ............ ${quedan}  (deben ser 0)`);
    console.log(quedan === 0 && totalDespues === todas.length ? '  OK' : '  REVISAR');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
