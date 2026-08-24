/**
 * Comprueba que HR_MANAGER llega a lo suyo y NO a lo clínico.
 *
 * Un rol se define tanto por lo que abre como por lo que deja cerrado. Este
 * script lee las puertas de cada endpoint y confirma las dos mitades, para que
 * si alguien mañana agrega HR_MANAGER a una ruta de residentes, se note.
 *
 * Uso: npx tsx scripts/verificar-rol-rrhh.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROL = 'HR_MANAGER';

/** Debe tener acceso. */
const DEBE_ABRIR = [
    'src/app/api/hr/incidents/route.ts',
    'src/app/api/hr/incidents/[id]/route.ts',
    'src/app/api/hr/incidents/[id]/decide/route.ts',
    'src/app/api/hr/incidents/[id]/resolver-apelacion/route.ts',
    'src/app/api/hr/staff/route.ts',
    'src/app/api/hr/staff/[id]/route.ts',
    'src/app/api/hr/staff/[id]/attendance/route.ts',
    'src/app/api/hr/evaluate/route.ts',
    'src/app/api/hr/evaluations/route.ts',
    'src/app/api/hr/schedule/absent/route.ts',
];

/** NO debe tener acceso: es la razón de que sea un rol propio. */
const DEBE_CERRAR_PREFIJOS = [
    'src/app/api/care/',        // piso, eMAR, vitales, residentes
    'src/app/api/corporate/patients/',
    'src/app/api/corporate/medical/',
    'src/app/api/family/',
    'src/app/api/corporate/billing/',
];

function archivos(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) out.push(...archivos(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

let fallos = 0;

console.log('DEBE ABRIR\n');
for (const f of DEBE_ABRIR) {
    let ok = false;
    try { ok = readFileSync(f, 'utf8').includes(ROL); } catch { /* no existe */ }
    console.log(`  ${ok ? '✅' : '❌'} ${f.replace('src/app/api/', '')}`);
    if (!ok) fallos++;
}

console.log('\nDEBE QUEDAR CERRADO\n');
for (const pref of DEBE_CERRAR_PREFIJOS) {
    let filtrados: string[] = [];
    try { filtrados = archivos(pref).filter(f => readFileSync(f, 'utf8').includes(ROL)); } catch { /* no existe */ }
    console.log(`  ${filtrados.length === 0 ? '✅' : '❌'} ${pref}`);
    for (const f of filtrados) { console.log(`        ${f}`); fallos++; }
}

console.log(fallos === 0
    ? '\n✅ El rol llega a personal y no a lo clínico.'
    : `\n❌ ${fallos} desviaciones.`);
process.exit(fallos === 0 ? 0 : 1);
