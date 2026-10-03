/**
 * MARCAR LAS FICHAS QUE NUNCA FUERON UN RESIDENTE.
 *
 * ═══ QUÉ PASÓ ═══
 *
 * El resumen ejecutivo del director contaba las fichas duplicadas como altas y
 * como egresos reales. Medido el 03-oct-2026 en Cupey: «Admisiones 7» de la
 * semana eran **3 residentes**, y «Egresos 10» del mes eran **2 altas de
 * verdad** (lo demás: fallecimientos y fichas duplicadas).
 *
 * El campo `Patient.fichaAnulada` ya existe y el alta lo pone desde hoy. Esto
 * rellena las siete que quedaron escritas antes.
 *
 * ═══ QUIÉN IDENTIFICÓ EL DUPLICADO: UNA PERSONA, NO ESTE SCRIPT ═══
 *
 * Esto se escribe porque dos intentos anteriores se equivocaron, y los dos
 * parecían razonables:
 *
 *   1. **Casar nombres.** «otra ficha viva con el mismo nombre» encontró 3 de 7.
 *      Falló con «Milagros Ortiz Marquez» vs «Milagros J. Ortiz Marquez» (una
 *      inicial), con los gemelos que ya no están ACTIVE porque se fueron o
 *      fallecieron DESPUÉS, y con «Jesus Mar», truncado al escribirlo, cuyo
 *      gemelo es «Jesus M. Martínes Crespo».
 *   2. **Buscar una ficha trabajada creada en la misma ventana de minutos.** Da
 *      7 de 7, pero por casualidad: el 21-may hubo una carga inicial y TODAS las
 *      fichas de ese día caen en la misma ventana. El rastro de auditoría iba a
 *      escribir «el expediente bueno de Maria T. Gonzalez Avila es Jose J.
 *      Hernandez Castro». Una inferencia presentada como hecho, que es justo lo
 *      que este trabajo viene a quitar.
 *
 * Y el dato duro no existe: **seis de las siete fichas vacías no tienen fecha
 * de nacimiento ni SSN.** Tiene sentido — el doble envío aborta antes de llenar
 * nada, así que la ficha que sobra está vacía también en identificadores. No
 * hay campo con el que emparejarlas.
 *
 * Lo que de verdad identificó cada duplicado fue **una persona** del hogar
 * abriendo las dos fichas y cerrando una a mano con «Perfil Duplicado». Esa
 * decisión ya está tomada y escrita en `dischargeReason`. Este script no la
 * repite: la CONFIRMA contra un hecho que sí puede medir —que la ficha no tiene
 * ningún registro— y marca. El rastro guarda el motivo literal y el conteo, y
 * **no nombra al gemelo**, porque no lo sabe.
 *
 * ═══ EL CRITERIO ═══
 *
 *   · `status: DISCHARGED` y el motivo, escrito a mano, dice que es duplicada;
 *   · la ficha está a CERO en las ocho tablas donde queda rastro de trabajo.
 *
 * Las dos. Una ficha CON contenido no se anula nunca, diga lo que diga el
 * motivo: hay trabajo clínico hecho sobre ella y anularla lo borraría del
 * expediente. Medido: las siete están a 0 de 8, y la que más vivió fueron 3.1 h.
 * Un residente real de tres horas deja al menos una nota de relevo.
 *
 * `fichaAnulada` no borra nada: quita la ficha de los conteos de admisión y
 * egreso. El expediente sigue abriéndose, como debe ser.
 *
 *     npx tsx scripts/marcar-fichas-duplicadas.ts            # dry-run
 *     APLICAR=SI npx tsx scripts/marcar-fichas-duplicadas.ts # escribe
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.OBJETIVO } } });
const APLICAR = process.env.APLICAR === 'SI';

/**
 * Lo que una persona escribe al cerrar una ficha que sobra. PROPONE candidatas;
 * lo que decide es el conteo de abajo.
 */
const HUELE_A_DUPLICADO = /duplic|doble perfil|perfil doble|doble envi|por error/i;

/** Las ocho tablas donde queda rastro de que alguien trabajó sobre la ficha. */
const CUENTAS = {
    medications: true, vitalSigns: true, dailyLogs: true,
    familyMembers: true, fallIncidents: true, handoverNotes: true,
    documents: true, invoices: true,
} as const;

const SELECT = {
    id: true, name: true, headquartersId: true, fichaAnulada: true,
    status: true, createdAt: true, dischargeDate: true, dischargeReason: true,
    _count: { select: CUENTAS },
} as const;

type Ficha = Awaited<ReturnType<typeof prisma.patient.findMany<{ select: typeof SELECT }>>>[number];

const total = (f: Ficha) => Object.values(f._count).reduce((a, b) => a + b, 0);
const resumen = (f: Ficha) =>
    Object.entries(f._count).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(' ') || '0 de 8';
const horas = (f: Ficha) =>
    f.dischargeDate ? `${((+f.dischargeDate - +f.createdAt) / 3_600_000).toFixed(1)} h` : '—';

async function main() {
    if (!process.env.OBJETIVO) { console.error('Falta OBJETIVO con la URL de la base.'); process.exit(1); }
    console.log(`host : ${new URL(process.env.OBJETIVO).host}`);
    console.log(`modo : ${APLICAR ? '⚠️  APLICAR' : 'dry-run (no escribe nada)'}\n`);

    const todas = await prisma.patient.findMany({ select: SELECT, orderBy: { createdAt: 'asc' } });

    const aMarcar: Ficha[] = [];
    const conContenido: Ficha[] = [];
    /** Vacías y cerradas, pero SIN motivo que hable de duplicado. Informativo. */
    const vaciasSinMotivo: Ficha[] = [];

    for (const f of todas) {
        if (f.status !== 'DISCHARGED') continue;
        if (f.fichaAnulada) continue;   // ya marcada: el script se puede repetir

        const sospechosa = HUELE_A_DUPLICADO.test(f.dischargeReason ?? '');
        if (total(f) === 0 && sospechosa) aMarcar.push(f);
        else if (total(f) === 0) vaciasSinMotivo.push(f);
        else if (sospechosa) conContenido.push(f);
    }

    console.log(`═══ SE MARCAN — cerradas a mano como duplicadas y SIN ningún registro — ${aMarcar.length} ═══\n`);
    for (const f of aMarcar) {
        console.log(`   ${f.name.trim().slice(0, 30).padEnd(31)} ${resumen(f).padEnd(9)} vivió ${horas(f).padStart(6)}   creada ${f.createdAt.toISOString().slice(0, 16)}`);
        console.log(`      lo escribió una persona: «${(f.dischargeReason ?? '').slice(0, 72)}»`);
    }

    const pinta = (t: string, l: Ficha[], nota: string) => {
        if (!l.length) return;
        console.log(`\n═══ ${t} — ${l.length} ═══`);
        console.log(`    ${nota}\n`);
        for (const f of l) {
            console.log(`   ${f.name.trim().slice(0, 30).padEnd(31)} ${resumen(f).slice(0, 52).padEnd(53)} vivió ${horas(f)}`);
            console.log(`      motivo: «${(f.dischargeReason ?? '(sin motivo escrito)').slice(0, 72)}»`);
        }
    };

    pinta('NO se tocan — dicen duplicado pero la ficha TIENE registros', conContenido,
        'Hay trabajo clínico hecho sobre ella: el egreso es real aunque el motivo\n    esté mal redactado. Anularla lo borraría de los conteos.');
    pinta('AVISO — vacías, pero el motivo no habla de duplicado', vaciasSinMotivo,
        'Ni se marcan ni se descartan: una ficha sin un solo registro tampoco fue\n    nunca un residente, pero quien la cerró no dijo que sobrara. A mano.');

    console.log(`\n───────────────────────────────────────────────────────────`);
    console.log(`  fichas en la base            : ${todas.length}`);
    console.log(`  → se marcan                  : ${aMarcar.length}`);
    console.log(`  → dicen duplicado y tienen datos: ${conContenido.length}`);
    console.log(`  → vacías sin ese motivo      : ${vaciasSinMotivo.length}`);

    if (!APLICAR) { console.log('\n(dry-run: no se escribió nada)'); await prisma.$disconnect(); return; }
    if (!aMarcar.length) { console.log('\nNada que marcar.'); await prisma.$disconnect(); return; }

    await prisma.$transaction([
        prisma.patient.updateMany({
            where: { id: { in: aMarcar.map(f => f.id) } },
            data: { fichaAnulada: true },
        }),
        prisma.systemAuditLog.createMany({
            data: aMarcar.map(f => ({
                headquartersId: f.headquartersId,
                entityName: 'Patient',
                entityId: f.id,
                action: 'VOIDED' as const,
                payloadChanges: {
                    campo: 'fichaAnulada', de: false, a: true,
                    motivo: 'Ficha cerrada a mano como duplicada y sin un solo registro en ocho tablas. Deja de contar como admisión y como egreso; el expediente sigue accesible.',
                    residente: f.name,
                    motivoQueEscribioLaPersona: f.dischargeReason,
                    registros: f._count,
                    horasEntreCreacionYCierre: f.dischargeDate
                        ? Number(((+f.dischargeDate - +f.createdAt) / 3_600_000).toFixed(2))
                        : null,
                    // A propósito NO se nombra el expediente bueno: en seis de los
                    // siete casos la ficha vacía no tiene ni fecha de nacimiento,
                    // así que el emparejamiento lo hizo una persona, no esto.
                },
            })),
        }),
    ]);

    const quedan = await prisma.patient.count({ where: { status: 'DISCHARGED', fichaAnulada: false } });
    console.log(`\n✅ ${aMarcar.length} fichas marcadas, con su rastro en SystemAuditLog`);
    console.log(`   egresos que siguen contando: ${quedan}`);
    await prisma.$disconnect();
}

main();
