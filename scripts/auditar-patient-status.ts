/**
 * ¿QUÉ CONSULTAS DE RESIDENTES NO FILTRAN A QUIEN YA NO ESTÁ?
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * Es el antipatrón que CLAUDE.md llama «el segundo que más se repite»: una
 * consulta de personas sin `status: 'ACTIVE'` le pide trabajo a alguien sobre
 * gente que se fue. Las úlceras de Wilfredo, fallecido hacía 84 días. Eiby
 * Caraballo, inactiva, en el «Top 5» de la pared. Diecisiete de veinticuatro
 * ausencias de gente que ya no trabaja aquí.
 *
 * CLAUDE.md dice que al 10-sep-2026 quedaban **83** consultas por revisar «una
 * por una» y que **no se tocan en bloque**. Ese número venía de un conteo a
 * mano que nadie puede repetir, así que envejece sin que nada avise. Esto lo
 * vuelve a contar.
 *
 * ═══ LO QUE NO HACE, Y ES LO IMPORTANTE ═══
 *
 * **No dice cuáles están mal.** No puede: la regla no depende de la forma de la
 * consulta sino de para qué sirve la respuesta.
 *
 *   · Lista o conteo para trabajo pendiente, una pantalla o una métrica → filtra
 *   · UN registro por id, un historial, una auditoría → **NO** filtra
 *
 * Y el error contrario es peor que el original: poner `status: 'ACTIVE'` en la
 * búsqueda de un expediente esconde el de alguien que falleció, que es
 * exactamente lo que no se puede hacer en un sistema clínico. Por eso esto
 * SEÑALA y no arregla, y por eso cada hallazgo lleva su contexto: lo que decide
 * es leer para qué se usa.
 *
 *     npx tsx scripts/auditar-patient-status.ts          # resumen
 *     npx tsx scripts/auditar-patient-status.ts --json   # para otra herramienta
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..', 'src');

/** Operaciones que devuelven o cuentan VARIAS filas: aquí la regla suele aplicar. */
const OPS_PLURALES = ['findMany', 'count', 'groupBy', 'aggregate', 'updateMany', 'deleteMany'];
/** Operaciones de UNA fila: normalmente un expediente por id, que NO debe filtrar. */
const OPS_SINGULARES = ['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow'];

/**
 * Formas de decir «solo los que están» que NO son la palabra `status`.
 * Sin esto, las consultas ya arregladas salen como pendientes y el conteo
 * crece solo — que es como se pierde la confianza en un auditor.
 */
const EQUIVALE_A_STATUS = [
    'status',
    'ENROLLED_PATIENT_STATUSES',
    'soloLosQueEstan',
    'presenciaDeHoy',
    'PACIENTES_ACTIVOS',
    'estadosDeAlta',
];

interface Hallazgo {
    fichero: string;
    linea: number;
    operacion: string;
    plural: boolean;
    porSede: boolean;
    conStatus: boolean;
    porId: boolean;
    fragmento: string;
}

function ficherosDeCodigo(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
            if (e === 'node_modules' || e === '.next') continue;
            ficherosDeCodigo(p, acc);
        } else if (/\.tsx?$/.test(e)) acc.push(p);
    }
    return acc;
}

/** Desde `desde`, devuelve el bloque entre llaves equilibradas. */
function bloqueEquilibrado(texto: string, desde: number): string {
    const abre = texto.indexOf('{', desde);
    if (abre === -1) return '';
    let n = 0;
    for (let i = abre; i < texto.length && i < abre + 6000; i++) {
        if (texto[i] === '{') n++;
        else if (texto[i] === '}') {
            n--;
            if (n === 0) return texto.slice(abre, i + 1);
        }
    }
    return texto.slice(abre, Math.min(texto.length, abre + 6000));
}

const hallazgos: Hallazgo[] = [];

for (const fichero of ficherosDeCodigo(RAIZ)) {
    const texto = readFileSync(fichero, 'utf8');
    const rel = relative(join(__dirname, '..'), fichero);

    // Las dos formas de preguntar por residentes: directa, y por la relación.
    const patrones = [
        new RegExp(`prisma\\.patient\\.(${[...OPS_PLURALES, ...OPS_SINGULARES].join('|')})\\s*\\(`, 'g'),
        /patient:\s*\{/g,
    ];

    for (const [idx, re] of patrones.entries()) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(texto)) !== null) {
            const bloque = bloqueEquilibrado(texto, m.index);
            if (!bloque) continue;

            const operacion = idx === 0 ? m[1] : 'relación patient';
            const plural = idx === 0 ? OPS_PLURALES.includes(m[1]) : true;

            /**
             * LAS DOS FORMAS NO SE MIRAN IGUAL, Y CONFUNDIRLAS CUESTA EN LOS DOS
             * SENTIDOS. Me paso en los dos en la misma tarde:
             *
             *   · `prisma.patient.findMany({...})` — el filtro esta DENTRO de
             *     `where`. Mirar el bloque entero cuenta un `select` con
             *     `headquartersId: true` como si filtrara: diez falsos de cien.
             *   · `patient: { headquartersId }` — este bloque YA es el filtro,
             *     porque vive dentro del `where` del padre. Exigirle la palabra
             *     `where` lo descarta entero: de cien quedaban nueve.
             *
             * Un auditor que señala de mas se deja de leer igual que uno que
             * señala de menos.
             */
            let soloWhere: string;
            if (idx === 0) {
                const iWhere = bloque.indexOf('where');
                if (iWhere === -1) continue;              // la consulta no filtra
                soloWhere = bloqueEquilibrado(bloque, iWhere);
            } else {
                // `patient: { select: ... }` / `{ include: ... }` es leer, no filtrar.
                if (/^\{\s*(select|include|omit)\b/.test(bloque.replace(/\s+/g, ' '))) continue;
                soloWhere = bloque;
            }

            const porSede = /headquartersId/.test(soloWhere);
            const conStatus = EQUIVALE_A_STATUS.some(k => new RegExp(`\\b${k}\\b`).test(soloWhere));
            // `id:` y tambien la forma abreviada `{ id, ... }`.
            const porId = /\bid:\s/.test(soloWhere) || /\{\s*id\s*,/.test(soloWhere) || /\bpatientId\b/.test(soloWhere);

            if (!porSede) continue;      // sin sede no es el caso que se cuenta
            if (conStatus) continue;      // ya filtra, de alguna de las formas

            const linea = texto.slice(0, m.index).split('\n').length;
            hallazgos.push({
                fichero: rel, linea, operacion, plural, porSede, conStatus, porId,
                fragmento: soloWhere.replace(/\s+/g, ' ').slice(0, 150),
            });
        }
    }
}

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(hallazgos, null, 2));
} else {
    const plurales = hallazgos.filter(h => h.plural && !h.porId);
    const porId = hallazgos.filter(h => h.porId);
    const singulares = hallazgos.filter(h => !h.plural && !h.porId);

    console.log('┌──────────────────────────────────────────────────────────────');
    console.log('│ Consultas de residentes POR SEDE que no filtran por estado');
    console.log('└──────────────────────────────────────────────────────────────\n');

    const pinta = (titulo: string, lista: Hallazgo[], nota: string) => {
        console.log(`\n═══ ${titulo} — ${lista.length} ═══`);
        console.log(`    ${nota}\n`);
        const porFichero = new Map<string, Hallazgo[]>();
        for (const h of lista) {
            if (!porFichero.has(h.fichero)) porFichero.set(h.fichero, []);
            porFichero.get(h.fichero)!.push(h);
        }
        for (const [f, hs] of [...porFichero].sort()) {
            console.log(`  ${f}`);
            for (const h of hs) console.log(`      :${String(h.linea).padEnd(5)} ${h.operacion}`);
        }
    };

    pinta('LISTAS Y CONTEOS', plurales,
        'Son los que la regla señala: si alimentan una pantalla, una alerta o\n    una métrica, deben filtrar. Hay que leer para qué se usa cada uno.');
    pinta('CON id / patientId EN EL WHERE', porId,
        'Normalmente un expediente concreto. La regla dice que estos NO filtran:\n    hay que poder abrir el de alguien que falleció.');
    pinta('UNA SOLA FILA (findFirst / findUnique)', singulares,
        'Una fila por otra clave. Caso por caso.');

    console.log(`\n───────────────────────────────────────────────────────────────`);
    console.log(`TOTAL señalado: ${hallazgos.length}`);
    console.log(`   listas y conteos : ${plurales.length}   ← los que piden revisión`);
    console.log(`   por id           : ${porId.length}   ← casi seguro correctos así`);
    console.log(`   una fila, otra clave: ${singulares.length}`);
    console.log(`\nEsto SEÑALA, no juzga: la regla depende de para qué sirve la respuesta.`);
}
