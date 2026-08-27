/**
 * Corrige la plantilla de evaluación psicosocial en la base.
 *
 * EL BUG
 *
 * "Evaluación Psicosocial Inicial" tenía la clave `observations` repetida ONCE
 * veces — una por cada sección de la IV a la XVII. El formulario guarda los
 * valores en un objeto plano indexado por `field.key`, asi que los once campos
 * escribian en la MISMA casilla: la trabajadora social tecleaba las
 * observaciones de Salud Mental y aparecian identicas en Comunicacion,
 * Educacion, Datos Economicos y ocho secciones mas.
 *
 * Nada fallaba. El formulario cargaba, guardaba y no daba error — solo hacia
 * algo distinto de lo que aparentaba. Con 46 campos, se abandona a los dos
 * minutos, y eso explica el uso del modulo: UNA evaluacion en toda su historia.
 *
 * QUE HACE ESTO
 *
 * 1. Reemplaza el schema de la plantilla por el corregido, donde cada
 *    observacion lleva la clave de su seccion (observations_salud_mental_dx…).
 * 2. Reubica el dato de las evaluaciones existentes: el valor que habia bajo
 *    `observations` pasa a `observations_salud_mental_dx`, que es la PRIMERA
 *    seccion donde aparecia el campo y por tanto la unica atribucion honesta
 *    que se puede hacer. No se puede saber en cual de las once lo escribio.
 *
 * Ensayo (no escribe):
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/corregir-plantilla-sw.ts
 *
 * Aplicar:
 *   ... --aplicar --respaldo ~/Desktop/respaldo-plantilla-sw.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { INITIAL_MFR_TEMPLATE_V1, INITIAL_MFR_TEMPLATE_NAME } from '../src/lib/sw-evaluation/templates/initial-mfr-v1';
import { exigirPlantillaValida } from '../src/lib/sw-evaluation/validar-plantilla';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const RESPALDO = process.argv[process.argv.indexOf('--respaldo') + 1];
const DESTINO = 'observations_salud_mental_dx';

async function main() {
    // Lo primero: que la plantilla que vamos a escribir esté sana.
    exigirPlantillaValida(INITIAL_MFR_TEMPLATE_V1, INITIAL_MFR_TEMPLATE_NAME);
    console.log('Plantilla corregida: 0 claves duplicadas ✓\n');

    const plantillas = await prisma.sWFormTemplate.findMany({
        where: { name: INITIAL_MFR_TEMPLATE_NAME },
        select: { id: true, name: true, version: true, schema: true },
    });
    console.log(`Plantillas a reemplazar: ${plantillas.length}`);

    for (const t of plantillas) {
        const sc: any = typeof t.schema === 'string' ? JSON.parse(t.schema as any) : t.schema;
        const claves: string[] = [];
        (sc?.sections ?? []).forEach((s: any) => (s.fields ?? []).forEach((f: any) => claves.push(f.key)));
        const dup = claves.filter((k, i) => claves.indexOf(k) !== i);
        console.log(`   v${t.version} — ${claves.length} campos · ${new Set(dup).size} clave(s) duplicada(s)`);
    }

    const evals = await prisma.sWEvaluation.findMany({ select: { id: true, data: true, status: true } });
    const conDato = evals.filter(e => {
        const d: any = typeof e.data === 'string' ? JSON.parse(e.data as any) : (e.data ?? {});
        return d && Object.prototype.hasOwnProperty.call(d, 'observations');
    });
    console.log(`\nEvaluaciones: ${evals.length} · con dato en "observations": ${conDato.length}`);
    console.log(`   ese valor se movera a "${DESTINO}"`);

    if (!APLICAR) {
        console.log('\nENSAYO — no se escribio nada. Anade --aplicar para ejecutar.');
        return;
    }

    if (RESPALDO) {
        writeFileSync(RESPALDO, JSON.stringify({ plantillas, evaluaciones: conDato }, null, 2));
        console.log(`\nRespaldo escrito en ${RESPALDO}`);
    }

    for (const t of plantillas) {
        await prisma.sWFormTemplate.update({
            where: { id: t.id },
            data: { schema: INITIAL_MFR_TEMPLATE_V1 as any },
        });
    }
    console.log(`Plantillas actualizadas: ${plantillas.length}`);

    let movidos = 0;
    for (const e of conDato) {
        const d: any = typeof e.data === 'string' ? JSON.parse(e.data as any) : { ...(e.data as any) };
        const valor = d.observations;
        delete d.observations;
        if (valor !== undefined && valor !== null && valor !== '') d[DESTINO] = valor;
        await prisma.sWEvaluation.update({ where: { id: e.id }, data: { data: d } });
        movidos++;
    }
    console.log(`Evaluaciones migradas: ${movidos}`);

    // Control: que no quede ninguna con la clave vieja.
    const restantes = (await prisma.sWEvaluation.findMany({ select: { data: true } })).filter(e => {
        const d: any = typeof e.data === 'string' ? JSON.parse(e.data as any) : (e.data ?? {});
        return d && Object.prototype.hasOwnProperty.call(d, 'observations');
    }).length;
    console.log(`Quedan con "observations" (debe ser 0): ${restantes}`);
}

main()
    .catch(e => { console.error('Error:', e.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
