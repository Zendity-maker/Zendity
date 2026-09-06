/**
 * LAS ALERTAS DE PIEL QUE SE PERDIERON ANTES DE QUE EL CANAL EXISTIERA
 *
 *     npx tsx scripts/rescatar-alertas-de-piel.ts            (en seco)
 *     npx tsx scripts/rescatar-alertas-de-piel.ts --escribir
 *
 * Desde el 06-sep-2026 el boton "Alerta Piel / UPP" abre un cambio de
 * condicion que enfermeria tiene que cerrar. Lo que se reporto ANTES quedo solo
 * como nota de turno: once residentes con ulceras escritas y cero fichas,
 * mientras el modulo enseñaba dos.
 *
 * Esto NO inventa nada. El reporte existio: lo escribio una persona, con fecha
 * y con nombre. Lo unico que hace es mandarlo a la cola a la que deberia haber
 * ido, conservando SU fecha y SU autor — no los de hoy. Si pusiera la fecha de
 * hoy, la lista diria que el piso reporto esto esta semana, y no es cierto.
 *
 * SOLO RESIDENTES ACTIVOS. Los que ya no estan no generan trabajo: su nota se
 * queda donde esta, que es donde tiene que estar.
 *
 * NO DECIDE SI ES ULCERA. Eso es de Celia, con el residente delante. Esto solo
 * pone la pregunta donde alguien la vea.
 */
import { prisma } from '../src/lib/prisma';

const HQ = 'a792f420-07a5-4088-8097-5ef47ca05ac8';
const HABLA_DE_PIEL = /(úlcera|ulcera|upp|escara|llaga|dec[uú]bito|punto de presi[oó]n|piel rota|lesi[oó]n en (la )?piel)/i;
const ESCRIBIR = process.argv.includes('--escribir');

async function main() {
    const logs = await prisma.dailyLog.findMany({
        where: { patient: { headquartersId: HQ } },
        select: {
            id: true, createdAt: true, notes: true, authorId: true,
            patient: { select: { id: true, name: true, status: true, pressureUlcers: { select: { id: true } } } },
        },
        orderBy: { createdAt: 'asc' },
    });

    const candidatos = logs.filter(l =>
        HABLA_DE_PIEL.test(l.notes ?? '')
        && l.patient.status === 'ACTIVE'
        && l.patient.pressureUlcers.length === 0
        && !!l.authorId,
    );

    // Uno por residente: la nota MAS RECIENTE. Abrir cuatro colas del mismo
    // residente es darle a Celia el mismo trabajo cuatro veces.
    const porResidente = new Map<string, typeof candidatos[number]>();
    for (const l of candidatos) porResidente.set(l.patient.id, l);

    // Si ya hay un cambio de PIEL sin revisar de ese residente, no se duplica.
    const yaEnCola = await prisma.cambioDeCondicion.findMany({
        where: { headquartersId: HQ, area: 'PIEL', revisadoAt: null },
        select: { patientId: true },
    });
    const enCola = new Set(yaEnCola.map(c => c.patientId));

    const aCrear = [...porResidente.values()].filter(l => !enCola.has(l.patient.id));

    console.log(`Notas que hablan de piel: ${candidatos.length}`);
    console.log(`Residentes activos sin ficha: ${porResidente.size}`);
    console.log(`Ya en cola (no se duplican): ${porResidente.size - aCrear.length}`);
    console.log(`\nA ABRIR EN LA COLA DE ENFERMERIA: ${aCrear.length}\n`);

    const autores = await prisma.user.findMany({
        where: { id: { in: [...new Set(aCrear.map(l => l.authorId!))] } },
        select: { id: true, name: true },
    });
    const nombre = new Map(autores.map(a => [a.id, a.name]));

    for (const l of aCrear) {
        const texto = (l.notes ?? '').replace(/^\[[^\]]+\]\s*/, '').trim();
        console.log(`  ${l.patient.name.trim().padEnd(26)} ${l.createdAt.toISOString().slice(0, 10)} · ${nombre.get(l.authorId!) ?? 'personal'}`);
        console.log(`     "${texto.slice(0, 100)}"`);
        if (ESCRIBIR) {
            await prisma.cambioDeCondicion.create({
                data: {
                    headquartersId: HQ,
                    patientId: l.patient.id,
                    reportadoPorId: l.authorId!,
                    reportadoAt: l.createdAt,
                    area: 'PIEL',
                    descripcion: texto.slice(0, 4000),
                },
            });
        }
    }

    console.log(ESCRIBIR
        ? `\nESCRITO: ${aCrear.length} cambios de condicion de area PIEL, con su fecha y su autor originales.`
        : `\nEN SECO — no se escribio nada. Para hacerlo: --escribir`);
}
main().finally(() => prisma.$disconnect());
