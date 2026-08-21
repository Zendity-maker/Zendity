/**
 * Simula los umbrales aprobados contra las lecturas reales, sin escribir nada.
 *
 * Sirve para saber cuánta carga operativa genera un umbral ANTES de encenderlo.
 * El protocolo de observación agenda una revisión obligatoria a los 45 minutos,
 * así que cada alerta de nivel LLAMAR es trabajo real para el turno.
 *
 * Uso: DATABASE_URL="..." npx tsx scripts/simular-umbrales-vitales.ts
 */
import { PrismaClient } from '@prisma/client';
import { evaluarVitales, nivelDe, aCelsius } from '../src/lib/vitals-thresholds';

const prisma = new PrismaClient();

async function main() {
    const vs = await prisma.vitalSigns.findMany({
        select: { systolic: true, diastolic: true, heartRate: true, temperature: true, spo2: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 6000,
    });
    console.log(`Lecturas analizadas: ${vs.length}\n`);

    let llamar = 0, anotar = 0, limpias = 0, ilegibles = 0;
    const porSigno: Record<string, number> = {};

    for (const v of vs) {
        if (aCelsius(v.temperature) === null) ilegibles++;
        const h = evaluarVitales(v);
        const n = nivelDe(h);
        if (n === 'LLAMAR') llamar++; else if (n === 'ANOTAR') anotar++; else limpias++;
        for (const x of h.filter(x => x.nivel === 'LLAMAR')) {
            porSigno[x.signo] = (porSigno[x.signo] ?? 0) + 1;
        }
    }

    const pc = (x: number) => `${Math.round(x / vs.length * 100)}%`;
    console.log(`LLAMAR  (observación a 45 min): ${llamar}  ${pc(llamar)}`);
    for (const [k, n] of Object.entries(porSigno).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${String(n).padStart(5)}  ${k}`);
    }
    console.log(`\nANOTAR  (solo al reporte):      ${anotar}  ${pc(anotar)}`);
    console.log(`Sin hallazgos:                  ${limpias}  ${pc(limpias)}`);
    console.log(`\n⚠️  Temperaturas ilegibles (banda 45–95): ${ilegibles}`);

    // Ritmo diario, que es lo que de verdad importa para el turno
    const dias = new Set(vs.map(v => v.createdAt.toISOString().slice(0, 10))).size;
    if (dias > 0) {
        console.log(`\nRitmo: ${(llamar / dias).toFixed(1)} observaciones de 45 min por día (${dias} días de datos).`);
    }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
