/**
 * Busca consultas que pueden mezclar datos entre sedes.
 *
 * Hecho el 21-ago-2026, antes de abrir Mayagüez. Hasta hoy Zendity opera con
 * una sola sede, así que un filtro de sede ausente NO se nota: todas las filas
 * pertenecen al mismo hogar y cualquier consulta devuelve "lo correcto" por
 * accidente. El día que entra la segunda sede, esas mismas consultas empiezan a
 * mezclar — y lo hacen en silencio, devolviendo datos de más sin error alguno.
 *
 * Este script lee el código, no la base. Sirve para encontrarlas ANTES.
 *
 * QUÉ BUSCA
 *
 *   1. Consultas sobre modelos con headquartersId donde el `where` no lo
 *      menciona. Son las que devuelven filas de todas las sedes.
 *   2. Modelos sin headquartersId propio (PatientMedication, UlcerLog,
 *      MedicationAdministration…) consultados sin atravesar la relación que
 *      los aísla. Estos son los peligrosos: parecen inocentes porque el modelo
 *      "no tiene sede", pero cuelgan de un paciente que sí la tiene.
 *   3. hqId tomado del body del request en vez de la sesión — la vulnerabilidad
 *      que CLAUDE.md prohíbe explícitamente.
 *
 * QUÉ NO PUEDE VER: si un helper aplica el filtro por dentro. Por eso lo que
 * reporta son SOSPECHAS que hay que mirar, no sentencias.
 *
 * Uso: npx tsx scripts/auditar-multi-tenant.ts [--todo]
 *      --todo  incluye también las sospechas de baja confianza
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const VERBOSO = process.argv.includes('--todo');

// ── Modelos con sede propia, leídos del schema ──────────────────────
function modelosConSede(): { conSede: Set<string>; sinSede: Set<string> } {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const conSede = new Set<string>();
    const sinSede = new Set<string>();
    const re = /^model (\w+) \{([\s\S]*?)^\}/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(schema))) {
        const [, nombre, cuerpo] = m;
        const camel = nombre[0].toLowerCase() + nombre.slice(1);
        (/^\s+headquartersId\s/m.test(cuerpo) ? conSede : sinSede).add(camel);
    }
    return { conSede, sinSede };
}

/**
 * Modelos sin sede propia que SÍ contienen datos de residentes o personal.
 * Se listan a mano porque el schema no distingue "cuelga de un paciente" de
 * "es una tabla de sistema" como Session o VerificationToken.
 */
const SENSIBLES_SIN_SEDE = new Set([
    'patientMedication', 'medicationAdministration', 'pressureUlcer', 'ulcerLog',
    'posturalChangeLog', 'dailyLog', 'vitalSigns', 'familyMessage', 'intakeData',
    'wellnessDiary', 'scheduledShift', 'familyMember', 'employeeEvaluation',
]);

const OPERACIONES = ['findMany', 'findFirst', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'];

/**
 * Un filtro por clave foránea escalar aísla igual que atravesar la relación:
 * `where: { patientId }` acota tanto como `where: { patient: { headquartersId } }`,
 * porque el id ya vino acotado de arriba. Sin esto el auditor marcaba como fuga
 * cosas como getAvailableCredits(patientId), que están bien.
 */
const FK_QUE_AISLAN = /\b(patientId|userId|employeeId|authorId|caregiverId|nurseId|submittedById|invokerId|measuredById|ulcerId|patientMedicationId|shiftSessionId|scheduleId|providerId|familyMemberId)\b/;

/**
 * El `where` construido arriba y pasado por variable — `where,` o
 * `where: filtro` — es el patrón que más falsos positivos generaba: el filtro
 * existe, solo que no en la misma línea. Se busca la definición hacia atrás.
 */
function whereEnVariable(src: string, indiceConsulta: number, bloque: string): boolean {
    // Dos formas: `where: filtro` y la taquigrafía `where,` — esta última
    // dejaba pasar casos como support/tickets, donde el filtro se arma arriba
    // en una variable que se llama literalmente `where`.
    const m = bloque.match(/where:\s*(\w+)\s*[,\n}]/);
    const taquigrafia = /\bwhere\s*,/.test(bloque);
    const nombre = m ? m[1] : (taquigrafia ? 'where' : null);
    if (!nombre || ['undefined', 'null'].includes(nombre)) return false;
    // Ventana hacia atrás: la construcción suele estar a pocas líneas.
    const antes = src.slice(Math.max(0, indiceConsulta - 2500), indiceConsulta);
    const def = new RegExp(`(const|let)\\s+${nombre}\\b[\\s\\S]{0,600}`);
    const trozo = antes.match(def)?.[0] ?? '';
    return /headquartersId|hqId/.test(trozo) || FK_QUE_AISLAN.test(trozo);
}

interface Hallazgo { archivo: string; linea: number; tipo: string; detalle: string; alto: boolean }

function archivos(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e.startsWith('.')) continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) out.push(...archivos(full));
        else if (/\.tsx?$/.test(full) && !full.endsWith('.bak')) out.push(full);
    }
    return out;
}

const { conSede } = modelosConSede();
const hallazgos: Hallazgo[] = [];

for (const f of archivos('src')) {
    const src = readFileSync(f, 'utf8');
    const lineas = src.split('\n');

    // ── hqId desde el body ──────────────────────────────────────────
    lineas.forEach((l, i) => {
        if (/(const|let)\s*\{[^}]*\bhqId\b[^}]*\}\s*=\s*(await\s*)?(req|request)\.json\(\)/.test(l)
            || /headquartersId:\s*body\.\w+/.test(l)) {
            hallazgos.push({
                archivo: f, linea: i + 1, alto: true,
                tipo: 'hqId desde el body',
                detalle: l.trim().slice(0, 90),
            });
        }
    });

    // ── Consultas sin filtro de sede ────────────────────────────────
    for (const op of OPERACIONES) {
        const re = new RegExp(`prisma\\.(\\w+)\\.${op}\\(`, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
            const modelo = m[1];
            const esConSede = conSede.has(modelo);
            const esSensible = SENSIBLES_SIN_SEDE.has(modelo);
            if (!esConSede && !esSensible) continue;

            // Mirar el bloque de la consulta (hasta 1200 chars o el cierre).
            const bloque = src.slice(m.index, m.index + 1200);
            const tieneSede =
                /headquartersId|hqId|headquarters:\s*\{|patient:\s*\{|user:\s*\{|employee:\s*\{/.test(bloque)
                || FK_QUE_AISLAN.test(bloque)
                || whereEnVariable(src, m.index, bloque);
            if (tieneSede) continue;

            // deleteMany/updateMany sin sede es lo más grave que puede pasar.
            const alto = esConSede || op === 'deleteMany' || op === 'updateMany';
            hallazgos.push({
                archivo: f,
                linea: src.slice(0, m.index).split('\n').length,
                alto,
                tipo: esConSede ? `${modelo}.${op} sin filtro de sede` : `${modelo}.${op} sin atravesar la relación`,
                detalle: bloque.split('\n')[0].trim().slice(0, 90),
            });
        }
    }
}

const altos = hallazgos.filter(h => h.alto);
const bajos = hallazgos.filter(h => !h.alto);
const mostrar = VERBOSO ? hallazgos : altos;

const porArchivo = new Map<string, Hallazgo[]>();
for (const h of mostrar) {
    if (!porArchivo.has(h.archivo)) porArchivo.set(h.archivo, []);
    porArchivo.get(h.archivo)!.push(h);
}

console.log(`AUDITORÍA MULTI-SEDE — ${mostrar.length} sospechas en ${porArchivo.size} archivos\n`);
for (const [archivo, hs] of [...porArchivo.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${archivo}`);
    for (const h of hs) console.log(`   :${String(h.linea).padEnd(5)} ${h.tipo}`);
}

console.log(`\n${altos.length} de alta confianza · ${bajos.length} de baja${VERBOSO ? '' : ' (usa --todo para verlas)'}`);
console.log('\nNo son sentencias: un helper puede aplicar el filtro por dentro.');
console.log('Son los sitios que hay que mirar antes de abrir la segunda sede.');
