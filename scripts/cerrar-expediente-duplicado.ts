/**
 * Cierra un expediente creado por error (duplicado de doble envío).
 *
 * CASO. Carlos Sergio Torres Matos tiene dos expedientes creados el 28-ago-2026
 * con UN SEGUNDO de diferencia — 15:18:40 y 15:18:41. Es un doble envío del
 * asistente de admisión, no dos personas.
 *
 *   94449daa…  15:18:40  sin cuarto, 0 familiares, 0 de todo lo clínico  ← el huérfano
 *   db5435af…  15:18:41  cuarto 1-06, 3 familiares, PAI creado           ← el bueno
 *
 * NO BORRA. Marca DISCHARGED con razón "Creado por error", que es exactamente
 * lo que ya se hizo en esta casa con el duplicado de María T. González Ávila.
 * Razones para no borrar de verdad:
 *   - Es reversible. Un DELETE sobre producción no lo es, y esta base ya se
 *     perdió entera una vez.
 *   - Deja rastro de que el doble envío ocurrió, que es lo que hay que arreglar
 *     en el asistente para que no se repita.
 *   - Sale de todas las listas igual: el directorio, el censo y los conteos
 *     filtran por status.
 *
 * Antes de tocar nada verifica que el expediente esté REALMENTE vacío. Si
 * tuviera una sola bitácora, medicamento o factura, aborta: entonces no es un
 * huérfano y hay que mirarlo a mano.
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-expediente-duplicado.ts <id>
 *
 * Aplicar (deja respaldo JSON):
 *   DATABASE_URL="..." npx tsx scripts/cerrar-expediente-duplicado.ts <id> \
 *     --aplicar --respaldo ~/Desktop/respaldo-duplicado.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const ID = process.argv[2];
const APLICAR = process.argv.includes('--aplicar');
const ri = process.argv.indexOf('--respaldo');
const RESPALDO = ri > -1 ? process.argv[ri + 1] : null;

async function main() {
    if (!ID || ID.startsWith('--')) {
        console.error('Uso: npx tsx scripts/cerrar-expediente-duplicado.ts <patientId> [--aplicar --respaldo <ruta>]');
        process.exit(1);
    }
    if (APLICAR && !RESPALDO) {
        console.error('✘ --aplicar exige --respaldo <ruta>. No se escribe sin respaldo.');
        process.exit(1);
    }

    const p = await prisma.patient.findUnique({
        where: { id: ID },
        select: {
            id: true, name: true, status: true, roomNumber: true, createdAt: true,
            familyMembers: { select: { id: true } },
            medications: { select: { id: true } },
            dailyLogs: { select: { id: true } },
            vitalSigns: { select: { id: true } },
            invoices: { select: { id: true } },
            pressureUlcers: { select: { id: true } },
            lifePlans: { select: { id: true } },
            intakeData: { select: { id: true, status: true } },
        },
    });
    if (!p) { console.error('✘ No existe ese expediente.'); process.exit(1); }

    console.log(`Expediente: ${p.name.trim()}`);
    console.log(`  creado ${p.createdAt.toISOString().slice(0,19)} · estatus ${p.status} · cuarto ${p.roomNumber ?? '—'}`);

    const adjuntos = {
        familiares: p.familyMembers.length,
        medicamentos: p.medications.length,
        bitacoras: p.dailyLogs.length,
        vitales: p.vitalSigns.length,
        facturas: p.invoices.length,
        upp: p.pressureUlcers.length,
        pai: p.lifePlans.length,
    };
    console.log('  adjuntos: ' + Object.entries(adjuntos).map(([k,v]) => `${k}=${v}`).join(' · '));

    const total = Object.values(adjuntos).reduce((a, b) => a + b, 0);
    if (total > 0) {
        console.error(`\n✘ ABORTA: el expediente tiene ${total} elementos adjuntos.`);
        console.error('   No es un huérfano de doble envío. Revísalo a mano antes de cerrar nada.');
        process.exit(1);
    }
    console.log('\n✔ Expediente vacío — es un huérfano de doble envío.');

    if (!APLICAR) {
        console.log('\n── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify({ ...p, cerradoAt: new Date().toISOString() }, null, 2));
    console.log(`Respaldo escrito en ${RESPALDO}`);

    await prisma.patient.update({
        where: { id: ID },
        data: {
            status: 'DISCHARGED',
            dischargeDate: new Date(),
            dischargeReason: 'Creado por error — duplicado de doble envío del asistente de admisión',
        },
    });
    console.log('✔ Expediente cerrado como creado por error. Sale de todas las listas activas.');
    console.log('  Es reversible: volver a status ACTIVE lo restaura.');
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
