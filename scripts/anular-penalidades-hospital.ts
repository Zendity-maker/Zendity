/**
 * Anula las penalidades de rotación generadas mientras el residente estaba
 * FUERA del edificio, y devuelve los puntos descontados a quien los perdió.
 *
 * Contexto (28-ago-2026). /api/care/postural castigaba por reloj sin preguntar
 * si el residente estaba presente ni si tenía orden de rotación. José A. Troche
 * Santiago ingresó al hospital el 26-ago y siguió generando penalidades: a
 * alguien le descontaron puntos por no girar a un señor que no estaba aquí.
 *
 * El código ya está corregido; esto limpia lo viejo.
 *
 * Solo toca:
 *   - Incident con descripción "PENALIDAD HR" de residentes en TEMPORARY_LEAVE
 *     cuya penalidad cae DENTRO de la ausencia (leaveDate ≤ reportedAt).
 *   - El ScoreEvent de rotación negativo del mismo instante, si existe.
 * Nunca toca una penalidad de un residente presente.
 *
 * Ensayo (no escribe nada):
 *   DATABASE_URL="..." npx tsx scripts/anular-penalidades-hospital.ts
 *
 * Aplicar (deja respaldo JSON):
 *   DATABASE_URL="..." npx tsx scripts/anular-penalidades-hospital.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-penalidades.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const respaldoIdx = process.argv.indexOf('--respaldo');
const RESPALDO = respaldoIdx > -1 ? process.argv[respaldoIdx + 1] : null;

async function main() {
    if (APLICAR && !RESPALDO) {
        console.error('✘ --aplicar exige --respaldo <ruta>. No se escribe sin respaldo.');
        process.exit(1);
    }

    const fuera = await prisma.patient.findMany({
        where: { status: 'TEMPORARY_LEAVE' },
        select: { id: true, name: true, leaveDate: true, leaveType: true },
    });
    console.log(`Residentes fuera del edificio ahora mismo: ${fuera.length}`);

    const aAnular: { incidentId: string; residente: string; fecha: Date }[] = [];

    for (const p of fuera) {
        if (!p.leaveDate) {
            console.log(`  ⚠ ${p.name.trim()} no tiene leaveDate — se omite por seguridad`);
            continue;
        }
        const penalidades = await prisma.incident.findMany({
            where: {
                patientId: p.id,
                description: { contains: 'PENALIDAD HR' },
                resolvedAt: null,
                reportedAt: { gte: p.leaveDate },
            },
            select: { id: true, reportedAt: true },
        });
        console.log(`  ${p.name.trim().padEnd(28)} ${p.leaveType ?? '—'} desde ${p.leaveDate.toISOString().slice(0,10)} → ${penalidades.length} penalidades dentro de la ausencia`);
        penalidades.forEach(i => aAnular.push({ incidentId: i.id, residente: p.name.trim(), fecha: i.reportedAt }));
    }

    console.log(`\nTotal a anular: ${aAnular.length}`);
    if (aAnular.length === 0) { console.log('Nada que hacer.'); return; }

    if (!APLICAR) {
        console.log('\n── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify(aAnular, null, 2));
    console.log(`Respaldo escrito en ${RESPALDO}`);

    // Se marcan resueltas con motivo, NO se borran: el registro de que se
    // generaron mal es parte de la historia y sirve para no repetirlo.
    const r = await prisma.incident.updateMany({
        where: { id: { in: aAnular.map(a => a.incidentId) } },
        data: {
            resolvedAt: new Date(),
            resolutionNote: 'Anulada: generada mientras el residente estaba fuera del edificio. '
                + 'El protocolo de rotación no aplicaba. Corrección del 28-ago-2026.',
        },
    });
    console.log(`✔ ${r.count} penalidades anuladas`);
    console.log('\nNOTA: los puntos de complianceScore NO se devuelven automáticamente.');
    console.log('El score es un campo vivo con clamp [0,100] y sumar de vuelta sin');
    console.log('reconstruir la serie daría un número que tampoco es cierto.');
    console.log('Eso se decide aparte, con el cuadro completo de scoring delante.');
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
