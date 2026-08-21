/**
 * Simula cuántas dosis materializaría el cron y qué haría con el cumplimiento.
 *
 * Sirve para saber ANTES de encenderlo que el "100%" de hoy va a bajar, y a
 * cuánto. No escribe nada.
 *
 * Uso: DATABASE_URL="..." npx tsx scripts/simular-emar-dosis.ts
 */
import { PrismaClient, MedActiveStatus } from '@prisma/client';
import { parseTimeOfDay } from '../src/lib/dates';

/** Mismo criterio que src/lib/emar-schedule.ts. */
const NO_PROGRAMABLE = /\b(PRN|semanal|weekly|mensual|monthly)\b/i;

const prisma = new PrismaClient();

async function main() {
    const meds = await prisma.patientMedication.findMany({
        where: { status: MedActiveStatus.ACTIVE, isActive: true },
        select: { scheduleTimes: true },
    });

    let porDia = 0, sinHorario = 0, noParsea = 0, noProgramable = 0;
    for (const m of meds) {
        if (!m.scheduleTimes) { sinHorario++; continue; }
        for (const raw of m.scheduleTimes.split(',')) {
            const t = raw.trim();
            if (!t) continue;
            if (NO_PROGRAMABLE.test(t)) { noProgramable++; continue; }
            try { parseTimeOfDay(t); porDia++; } catch { noParsea++; }
        }
    }

    console.log(`Medicamentos activos      : ${meds.length}`);
    console.log(`  sin horario definido    : ${sinHorario}`);
    console.log(`  PRN o semanales (fuera) : ${noProgramable}`);
    console.log(`  formato inesperado      : ${noParsea}`);
    console.log(`\nDosis que se crearán por día: ${porDia}`);

    const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [adm30, giv30] = await Promise.all([
        prisma.medicationAdministration.count({ where: { createdAt: { gte: desde } } }),
        prisma.medicationAdministration.count({ where: { createdAt: { gte: desde }, status: 'ADMINISTERED' } }),
    ]);
    const esperadas30 = porDia * 30;
    console.log(`\nÚltimos 30 días:`);
    console.log(`  filas que existen hoy   : ${adm30.toLocaleString()}`);
    console.log(`  dosis que debieron ser  : ~${esperadas30.toLocaleString()}`);
    console.log(`\n  Cumplimiento que muestra hoy : ${adm30 ? Math.round(giv30 / adm30 * 100) : 0}%`);
    console.log(`  Cumplimiento con denominador real: ~${esperadas30 ? Math.round(giv30 / esperadas30 * 100) : 0}%`);
    console.log(`\n  Ese segundo número es el que empezará a verse. No es que el`);
    console.log(`  hogar empeore: es que por fin se cuenta lo que no se hizo.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
