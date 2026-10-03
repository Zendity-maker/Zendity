/**
 * LAS DOSIS QUE EL SISTEMA ACUSÓ DE NO DARSE A GENTE QUE YA NO ESTABA.
 *
 * ═══ QUÉ PASÓ ═══
 *
 * El cron que MATERIALIZA las dosis solo las crea para residentes `ACTIVE`,
 * pero el barrido que las vence —`marcarDosisVencidas`— no miraba al residente:
 * convertía en MISSED por la hora y nada más. Esa asimetría fabricó omisiones
 * de personas que ya se habían ido o habían fallecido.
 *
 * Medido el 03-oct-2026 en producción: de las **273 MISSED de toda la
 * historia**, 109 son de residentes DISCHARGED o DECEASED. El 40%. Ninguna de
 * las 109 tiene hora de administración, o sea que ninguna se dio.
 *
 * El agujero ya está tapado (el barrido manda esas a VOIDED, y el alta cierra
 * las PENDING del día en la misma transacción). Esto limpia lo que quedó
 * escrito antes.
 *
 * ═══ LA DIVISIÓN QUE DECIDE TODO ═══
 *
 * **No se anulan las 109.** Hay dos grupos y solo uno es falso:
 *
 *   · Dosis pautadas DESPUÉS de la salida → el residente no estaba. Nadie pudo
 *     dársela y nadie falló. La fila sobra: va a VOIDED.
 *   · Dosis pautadas ANTES de la salida → el residente ESTABA aquí, la dosis
 *     tocaba, y no consta que se diera. **Eso es una omisión de verdad y se
 *     queda como MISSED.** Anularla sería borrar un hecho clínico para que un
 *     número salga mejor, que es justo lo contrario de lo que se viene haciendo.
 *
 * Y si de un residente no consta fecha de salida, no se toca ninguna: sin esa
 * fecha no se puede saber de qué lado cae, y ante la duda no se escribe.
 *
 *     npx tsx scripts/anular-dosis-de-residentes-idos.ts            # dry-run
 *     APLICAR=SI npx tsx scripts/anular-dosis-de-residentes-idos.ts # escribe
 *
 * Requiere `OBJETIVO` con la URL de la base. Deja rastro en `SystemAuditLog`
 * con action VOIDED, que es el precedente que ya usa el enum.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.OBJETIVO } } });
const APLICAR = process.env.APLICAR === 'SI';
const IDOS = ['DISCHARGED', 'DECEASED'] as const;

interface Fila {
    id: string;
    scheduledTime: Date | null;
    createdAt: Date;
    administeredAt: Date | null;
    nombre: string;
    estado: string;
    salida: Date | null;
    hqId: string;
    medicamento: string;
}

const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—');

async function main() {
    if (!process.env.OBJETIVO) {
        console.error('Falta OBJETIVO con la URL de la base.');
        process.exit(1);
    }
    console.log(`host : ${new URL(process.env.OBJETIVO).host}`);
    console.log(`modo : ${APLICAR ? '⚠️  APLICAR' : 'dry-run (no escribe nada)'}\n`);

    const crudas = await prisma.medicationAdministration.findMany({
        where: {
            status: 'MISSED',
            patientMedication: { patient: { status: { in: IDOS as any } } },
        },
        select: {
            id: true, scheduledTime: true, createdAt: true, administeredAt: true,
            patientMedication: {
                select: {
                    medication: { select: { name: true } },
                    patient: {
                        select: {
                            name: true, status: true, headquartersId: true,
                            dischargeDate: true, leaveDate: true,
                        },
                    },
                },
            },
        },
    });

    const filas: Fila[] = crudas.map(f => {
        const pa = f.patientMedication.patient;
        return {
            id: f.id,
            scheduledTime: f.scheduledTime,
            createdAt: f.createdAt,
            administeredAt: f.administeredAt,
            nombre: pa.name,
            estado: pa.status,
            // La de alta manda; si no hay, la de permiso, que es la que se pone
            // al reportar un fallecimiento antes de cerrar el expediente.
            salida: pa.dischargeDate ?? pa.leaveDate ?? null,
            hqId: pa.headquartersId,
            medicamento: f.patientMedication.medication?.name ?? '—',
        };
    });

    /**
     * Un `administeredAt` con valor querría decir que SÍ se dio, y entonces no
     * es ni una omisión ni una fila que sobre: sería otra cosa y habría que
     * mirarla a mano. Medido: las 109 lo tienen nulo. La comprobación se queda
     * igual, porque el día que no sea cierto hay que enterarse.
     */
    const firmadas = filas.filter(f => f.administeredAt);
    if (firmadas.length > 0) {
        console.log(`⚠️  ${firmadas.length} tienen hora de administración — NO se tocan, revisar a mano:`);
        for (const f of firmadas) console.log(`     ${f.nombre} · ${f.medicamento} · ${fmt(f.administeredAt)}`);
        console.log();
    }

    const candidatas = filas.filter(f => !f.administeredAt);
    const sinFecha = candidatas.filter(f => !f.salida || !f.scheduledTime);
    const conFecha = candidatas.filter(f => f.salida && f.scheduledTime);

    const despues = conFecha.filter(f => f.scheduledTime! > f.salida!);
    const antes = conFecha.filter(f => f.scheduledTime! <= f.salida!);

    // ── El detalle, residente por residente ─────────────────────────────────
    const porResidente = new Map<string, { estado: string; salida: Date | null; anular: Fila[]; quedan: Fila[]; dudosas: Fila[] }>();
    const mete = (f: Fila, cubo: 'anular' | 'quedan' | 'dudosas') => {
        if (!porResidente.has(f.nombre)) {
            porResidente.set(f.nombre, { estado: f.estado, salida: f.salida, anular: [], quedan: [], dudosas: [] });
        }
        porResidente.get(f.nombre)![cubo].push(f);
    };
    despues.forEach(f => mete(f, 'anular'));
    antes.forEach(f => mete(f, 'quedan'));
    sinFecha.forEach(f => mete(f, 'dudosas'));

    console.log('┌──────────────────────────────────────────────────────────────────────');
    console.log('│ residente · estado · salida        ANULAR   se quedan MISSED   sin fecha');
    console.log('└──────────────────────────────────────────────────────────────────────');
    for (const [nombre, v] of [...porResidente].sort((a, b) => b[1].anular.length - a[1].anular.length)) {
        console.log(
            `  ${nombre.slice(0, 30).padEnd(31)} ${v.estado.padEnd(11)} ${String(v.salida?.toISOString().slice(0, 10) ?? '—').padEnd(11)}` +
            `${String(v.anular.length).padStart(6)}${String(v.quedan.length).padStart(18)}${String(v.dudosas.length).padStart(11)}`,
        );
        for (const f of v.quedan.slice(0, 3)) {
            console.log(`        ↳ se queda: ${f.medicamento.slice(0, 22).padEnd(23)} pautada ${fmt(f.scheduledTime)} (estaba aquí)`);
        }
        if (v.quedan.length > 3) console.log(`        ↳ … y ${v.quedan.length - 3} más que se quedan`);
    }

    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log(`  MISSED de residentes idos            : ${filas.length}`);
    console.log(`  → se ANULAN (pautadas tras la salida): ${despues.length}`);
    console.log(`  → se QUEDAN (estaba aquí, omisión real): ${antes.length}`);
    console.log(`  → sin fecha de salida, no se tocan   : ${sinFecha.length}`);
    console.log(`  → con hora de administración         : ${firmadas.length}`);

    if (!APLICAR) {
        console.log('\n(dry-run: no se escribió nada)');
        await prisma.$disconnect();
        return;
    }

    if (despues.length === 0) {
        console.log('\nNada que anular.');
        await prisma.$disconnect();
        return;
    }

    // Todo o nada, y con su rastro: el enum dice que quien anula deja registro
    // en SystemAuditLog, igual que los tickets del supervisor.
    await prisma.$transaction([
        prisma.medicationAdministration.updateMany({
            where: { id: { in: despues.map(f => f.id) } },
            data: { status: 'VOIDED' },
        }),
        prisma.systemAuditLog.createMany({
            data: despues.map(f => ({
                headquartersId: f.hqId,
                entityName: 'MedicationAdministration',
                entityId: f.id,
                action: 'VOIDED' as const,
                payloadChanges: {
                    de: 'MISSED', a: 'VOIDED',
                    motivo: 'La dosis estaba pautada después de la salida del residente: no pudo administrarse y no es una omisión.',
                    residente: f.nombre,
                    estadoDelResidente: f.estado,
                    salida: f.salida?.toISOString() ?? null,
                    pautada: f.scheduledTime?.toISOString() ?? null,
                },
            })),
        }),
    ]);

    const quedan = await prisma.medicationAdministration.count({
        where: { status: 'MISSED', patientMedication: { patient: { status: { in: IDOS as any } } } },
    });
    const total = await prisma.medicationAdministration.count({ where: { status: 'MISSED' } });
    console.log(`\n✅ ${despues.length} anuladas, con su rastro en SystemAuditLog`);
    console.log(`   MISSED de residentes idos que quedan: ${quedan} (las que sí estaban aquí)`);
    console.log(`   MISSED en total ahora               : ${total}`);
    await prisma.$disconnect();
}

main();
