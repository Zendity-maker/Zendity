/**
 * Comprueba que cada dato de cuidado se lea de donde se escribe.
 *
 * Hallazgo del 24-ago-2026: baño e ingesta existían en dos modelos a la vez.
 * La cuidadora registraba en BathLog y MealLog desde su pantalla, pero varios
 * lectores —el portal familiar, el detector de señales clínicas, la regla de
 * alerta del supervisor— miraban DailyLog.bathCompleted y DailyLog.foodIntake,
 * campos que ninguna pantalla llena.
 *
 * Consecuencia medida: las 33 familias veían "sin dato" de alimentación
 * mientras el hogar había registrado las comidas de los 33 ese mismo día.
 *
 * Este script vuelve a comparar las dos fuentes. Si la abandonada se llena de
 * golpe, o la viva se vacía, algo cambió de sitio y hay que mirarlo.
 *
 * Uso: DATABASE_URL="..." npx tsx scripts/verificar-fuentes-cuidado.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DIAS = 7;

async function main() {
    const desde = new Date(Date.now() - DIAS * 24 * 3600 * 1000);
    // La ventana de 7 días arrastra datos anteriores a la corrección del
    // 24-ago-2026. Para saber si el problema SIGUE ocurriendo se mira solo el
    // último día — si no, el chequeo grita por algo ya resuelto y se ignora.
    const ayer = new Date(Date.now() - 24 * 3600 * 1000);

    const [dailyLogs, bathLogs, mealLogs, conBath, conFood] = await Promise.all([
        prisma.dailyLog.count({ where: { createdAt: { gte: desde } } }),
        prisma.bathLog.count({ where: { timeLogged: { gte: desde } } }),
        prisma.mealLog.count({ where: { timeLogged: { gte: desde } } }),
        prisma.dailyLog.count({ where: { createdAt: { gte: desde }, bathCompleted: true } }),
        prisma.dailyLog.count({ where: { createdAt: { gte: desde }, foodIntake: { gt: 0 } } }),
    ]);

    console.log(`FUENTES DE CUIDADO — últimos ${DIAS} días\n`);
    console.log(`  Baño    · BathLog ${String(bathLogs).padStart(5)}   · DailyLog.bathCompleted ${String(conBath).padStart(5)}`);
    console.log(`  Comida  · MealLog ${String(mealLogs).padStart(5)}   · DailyLog.foodIntake    ${String(conFood).padStart(5)}`);
    console.log(`  Bitácora (DailyLog en total): ${dailyLogs}`);

    const [bathHoy, foodHoy] = await Promise.all([
        prisma.dailyLog.count({ where: { createdAt: { gte: ayer }, bathCompleted: true } }),
        prisma.dailyLog.count({ where: { createdAt: { gte: ayer }, foodIntake: { not: null } } }),
    ]);
    console.log(`\n  En las últimas 24h, DailyLog con baño: ${bathHoy} · con ingesta: ${foodHoy}`);
    if (conBath > 0 || conFood > 0) {
        console.log(`  (${conBath + conFood} registros de la semana son anteriores a la corrección)`);
    }

    const problemas: string[] = [];
    if (bathHoy > 0) problemas.push('El baño se está escribiendo en LOS DOS sitios.');
    if (foodHoy > 0) problemas.push('La ingesta se está escribiendo en LOS DOS sitios.');
    if (bathLogs === 0 && conBath > 0) problemas.push('El baño se movió a DailyLog — hay lectores que ya no lo verán.');
    if (mealLogs === 0 && conFood > 0) problemas.push('La ingesta se movió a DailyLog — hay lectores que ya no la verán.');

    if (problemas.length === 0) {
        console.log('\n✅ Una sola fuente por dato: BathLog y MealLog.');
    } else {
        console.log('\n⚠️  Revisar:');
        for (const p of problemas) console.log(`   · ${p}`);
        process.exit(1);
    }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
