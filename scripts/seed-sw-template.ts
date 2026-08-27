/**
 * scripts/seed-sw-template.ts
 *
 * Siembra un SWFormTemplate desde un JSON literal del repo.
 * Parameterizable por --template=<key>: en Fase 1 solo "inicial-mfr-v1";
 * Seguimiento y Cierre vendrán como entries adicionales después.
 *
 * MODOS:
 *   DRY-RUN (default):
 *     npx tsx scripts/seed-sw-template.ts --template=inicial-mfr-v1 --hq-id=<uuid>
 *   APPLY (branch desechable):
 *     SEED_CONFIRM=YES npx tsx scripts/seed-sw-template.ts --template=inicial-mfr-v1 --hq-id=<uuid> --apply
 *   APPLY (PROD — requiere doble confirm):
 *     SEED_PROD=YES_EXPLICIT SEED_CONFIRM=YES \
 *       npx tsx scripts/seed-sw-template.ts --template=inicial-mfr-v1 --hq-id=<uuid prod> --apply
 *
 * 🛑 Guard de prod:
 *   Si el host es prod (ep-wispy-queen-ae20881h), EXIGE SEED_PROD=YES_EXPLICIT
 *   además de SEED_CONFIRM=YES. Sin SEED_PROD, aborta.
 *
 * Idempotente: si ya existe un SWFormTemplate con (headquartersId, name, version),
 * NO inserta de nuevo. Reporta y sale OK.
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

import {
    INITIAL_MFR_TEMPLATE_NAME,
    INITIAL_MFR_TEMPLATE_VERSION,
    INITIAL_MFR_TEMPLATE_V1,
} from '../src/lib/sw-evaluation/templates/initial-mfr-v1';
import { exigirPlantillaValida } from '../src/lib/sw-evaluation/validar-plantilla';
import type { SWFormTemplateSchema } from '../src/lib/sw-evaluation/template-types';

// ─── Registry de plantillas seedeables ───────────────────────────────────
interface TemplateEntry {
    key: string;
    name: string;
    description: string;
    version: number;
    schema: SWFormTemplateSchema;
}

const TEMPLATES: Record<string, TemplateEntry> = {
    'inicial-mfr-v1': {
        key: 'inicial-mfr-v1',
        name: INITIAL_MFR_TEMPLATE_NAME,
        description: 'Form MFR9873-ESI — 17 secciones. Seed Paso 3 SW Eval Fase 1.',
        version: INITIAL_MFR_TEMPLATE_VERSION,
        schema: INITIAL_MFR_TEMPLATE_V1,
    },
    // Aquí entrarán seguimiento-mfr-v1 y cierre-mfr-v1 cuando sus JSONs estén listos.
};

const PROD_HOST_PATTERN = 'ep-wispy-queen-ae20881h';

function argValue(flag: string): string | undefined {
    const arg = process.argv.find(a => a.startsWith(`${flag}=`));
    return arg?.split('=', 2)[1];
}

async function confirmApply(): Promise<boolean> {
    if (process.env.SEED_CONFIRM === 'YES') return true;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question('Escribe SI para aplicar: ', (a) => { rl.close(); resolve(a.trim().toUpperCase() === 'SI'); });
    });
}

async function main() {
    const url = process.env.DATABASE_URL ?? '';
    if (!url) { console.error('❌ DATABASE_URL no definido'); process.exit(1); }

    const templateKey = argValue('--template');
    // hq-id ahora es OPCIONAL — sin él, se siembra como PLATAFORMA (hqId=null,
    // todas las sedes heredan). Con --hq-id=<uuid> se siembra como override
    // per-sede para casos donde una sede necesita variante local.
    const hqId = argValue('--hq-id');
    const platform = !hqId;
    const APPLY = process.argv.includes('--apply');

    if (!templateKey) {
        console.error('❌ Falta --template=<key>. Opciones:', Object.keys(TEMPLATES).join(', '));
        process.exit(1);
    }
    const tpl = TEMPLATES[templateKey];
    if (!tpl) {
        console.error(`❌ Template "${templateKey}" no existe. Opciones:`, Object.keys(TEMPLATES).join(', '));
        process.exit(1);
    }

    const host = url.match(/@([^/]+)/)?.[1] ?? '???';
    const isProd = host.includes(PROD_HOST_PATTERN);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🎯 seed-sw-template target`);
    console.log(`   host:     ${host}`);
    console.log(`   prod?:    ${isProd}`);
    console.log(`   template: ${tpl.key} (${tpl.name} v${tpl.version})`);
    console.log(`   scope:    ${platform ? 'PLATAFORMA (hqId=null)' : `PER-SEDE (hqId=${hqId})`}`);
    console.log(`   mode:     ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (APPLY && isProd && process.env.SEED_PROD !== 'YES_EXPLICIT') {
        console.error('🛑 BLOQUEADO — apply a prod exige SEED_PROD=YES_EXPLICIT además de SEED_CONFIRM=YES.');
        process.exit(1);
    }

    const prisma = new PrismaClient({ datasources: { db: { url } } });

    // Si scope=per-sede, verificar que el HQ existe
    if (!platform) {
        const hq = await prisma.headquarters.findUnique({ where: { id: hqId! }, select: { id: true, name: true } });
        if (!hq) {
            console.error(`❌ Headquarters ${hqId} no existe en este host.`);
            console.error('   En branch vacío: corre antes seed-sw-eval-test-data.ts para crear el HQ stub.');
            await prisma.$disconnect();
            process.exit(1);
        }
        console.log(`✓ HQ encontrado: ${hq.name}`);
    } else {
        console.log(`✓ Modo PLATAFORMA — la row insertada tendrá headquartersId=null y será heredada por TODAS las sedes existentes y futuras.`);
    }

    // Idempotencia: ¿ya existe ese mismo (scope, name, version)?
    const existing = await prisma.sWFormTemplate.findFirst({
        where: {
            headquartersId: platform ? null : hqId!,
            name: tpl.name,
            version: tpl.version,
        },
        select: { id: true },
    });
    if (existing) {
        console.log(`⏭️  Template ya existe (id=${existing.id.slice(0,8)}). Skip — idempotente.`);
        await prisma.$disconnect();
        return;
    }

    if (!APPLY) {
        console.log('DRY-RUN — habría insertado:');
        console.log(`  SWFormTemplate { name: "${tpl.name}", version: ${tpl.version}, sections: ${tpl.schema.sections.length}, scope: ${platform ? 'PLATAFORMA' : 'PER-SEDE'} }`);
        const exampleCmd = platform
            ? `SEED_CONFIRM=YES npx tsx scripts/seed-sw-template.ts --template=${tpl.key} --apply`
            : `SEED_CONFIRM=YES npx tsx scripts/seed-sw-template.ts --template=${tpl.key} --hq-id=${hqId} --apply`;
        console.log(`  Para aplicar: ${exampleCmd}`);
        await prisma.$disconnect();
        return;
    }

    if (!(await confirmApply())) { console.log('Abortado.'); await prisma.$disconnect(); process.exit(1); }

    // Una plantilla con claves repetidas NO llega a la base.
    //
    // "Evaluación Psicosocial Inicial" tenía `observations` once veces, una por
    // sección. Los once campos escribían en la misma casilla: lo que la
    // trabajadora social tecleaba en una sección aparecía en las otras diez.
    // Nada fallaba —cargaba, guardaba, no daba error— y por eso llegó a
    // producción y se quedó ahí. Una evaluación en toda la historia del módulo.
    exigirPlantillaValida(tpl.schema, tpl.name);

    const created = await prisma.sWFormTemplate.create({
        data: {
            headquartersId: platform ? null : hqId!,
            name: tpl.name,
            description: tpl.description,
            version: tpl.version,
            isActive: true,
            schema: tpl.schema as any, // Prisma Json
        },
        select: { id: true, name: true, version: true, headquartersId: true, createdAt: true },
    });

    console.log('✅ Template sembrado.');
    console.log(JSON.stringify(created, null, 2));

    await prisma.$disconnect();
}

main().catch(async (e) => { console.error('❌ FATAL:', e); process.exit(1); });
