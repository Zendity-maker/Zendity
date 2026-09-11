/**
 * Pone en su estado real las recetas descontinuadas.
 *
 * Hasta el 11-sep-2026, descontinuar una receta escribía la palabra
 * "DESCONTINUADO" DENTRO de `scheduleTimes` —el campo de los horarios— y dejaba
 * `status` en ACTIVE. La receta quedaba diciendo tres cosas a la vez:
 *
 *     status        = ACTIVE          (mentira)
 *     isActive      = false           (verdad)
 *     scheduleTimes = DESCONTINUADO   (un estado metido en una hora)
 *
 * El enum MedActiveStatus ya tenía DISCONTINUED. Este script lo aplica a las
 * filas que quedaron así.
 *
 * NO toca `scheduleTimes`: los horarios reales de esas recetas se perdieron
 * cuando se pisaron, y no se pueden inventar. Se deja la palabra como rastro de
 * lo que pasó.
 *
 * No cambia lo que ve nadie: la tableta ya filtraba por `isActive: true`, así
 * que estas recetas no salían. Lo que cambia es que ahora el expediente dice la
 * verdad sobre por qué.
 *
 *   npx tsx scripts/migrar-descontinuadas.ts             (simula)
 *   npx tsx scripts/migrar-descontinuadas.ts --aplicar
 */
import { writeFileSync } from 'fs';
import { prisma } from '../src/lib/prisma';

const APLICAR = process.argv.includes('--aplicar');

async function main() {
    const afectadas = await prisma.patientMedication.findMany({
        where: { scheduleTimes: 'DESCONTINUADO', status: { not: 'DISCONTINUED' } },
        select: {
            id: true, status: true, isActive: true,
            patient: { select: { name: true, headquarters: { select: { name: true } } } },
            medication: { select: { name: true } },
        },
    });

    console.log(`recetas con "DESCONTINUADO" en el campo de horarios y estado distinto de DISCONTINUED: ${afectadas.length}\n`);
    for (const m of afectadas.slice(0, 10)) {
        console.log(`   ${m.patient.name.trim().slice(0, 24).padEnd(24)} ${m.medication.name.slice(0, 26).padEnd(26)} status=${m.status} activo=${m.isActive}`);
    }
    if (afectadas.length > 10) console.log(`   … y ${afectadas.length - 10} más`);

    // ¿Alguna está activa? Eso sería una receta descontinuada que SÍ sale en la
    // tableta, y habría que mirarla una por una antes de tocar nada.
    const vivas = afectadas.filter(m => m.isActive);
    if (vivas.length > 0) {
        console.log(`\n⚠️  ${vivas.length} están con isActive=true. NO se tocan: revísalas a mano.`);
    }

    const seguras = afectadas.filter(m => !m.isActive);
    if (seguras.length === 0) { console.log('\nNada que migrar.'); return; }

    if (!APLICAR) { console.log(`\n[SIMULACIÓN] Se pondrían ${seguras.length} en DISCONTINUED. Para aplicar: --aplicar`); return; }

    const respaldo = `scripts/respaldo-descontinuadas-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    writeFileSync(respaldo, JSON.stringify(seguras, null, 1));
    console.log(`\nRespaldo: ${respaldo}`);

    const r = await prisma.patientMedication.updateMany({
        where: { id: { in: seguras.map(m => m.id) } },
        data: { status: 'DISCONTINUED' },
    });
    console.log(`Actualizadas: ${r.count}`);

    const quedan = await prisma.patientMedication.count({
        where: { scheduleTimes: 'DESCONTINUADO', status: { not: 'DISCONTINUED' }, isActive: false },
    });
    console.log(`VERIFICACIÓN — quedan sin migrar: ${quedan}${quedan === 0 ? '  OK' : '  REVISAR'}`);
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
