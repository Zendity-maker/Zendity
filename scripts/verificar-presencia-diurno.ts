/**
 * ¿DICEN LO MISMO LAS DOS COPIAS DE LA REGLA?
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * «¿Está el diurno en el edificio ahora?» se responde en DOS sitios de
 * `src/lib/residente-diurno.ts`, y tiene que ser a la fuerza:
 *
 *   · `estaEnElEdificioConMarcas()` — en memoria, cuando ya tienes la fila.
 *   · `presenciaDeHoy()` — un `where` de Prisma, para no traer miles de filas
 *     y tirarlas.
 *
 * Son la misma regla escrita en dos idiomas. Y una regla escrita dos veces y
 * arreglada en una es la causa raíz que este repo lleva pagando todo
 * septiembre: la copia que se queda atrás no da error, da una respuesta
 * tranquilizadora.
 *
 * Aquí se enfrentan sobre TODAS las combinaciones posibles: las 24 horas del
 * día contra cada forma que puede tener una jornada. Si divergen en una sola,
 * el script falla y dice exactamente cuál.
 *
 * ═══ CÓMO ═══
 *
 * La semántica de `some` / `none` de Prisma se simula en JavaScript: `none`
 * sobre una lista de cero o una fila es «ninguna fila cumple», `some` es
 * «alguna cumple». No hace falta base de datos — lo que se verifica es la
 * LÓGICA, que es donde está el riesgo.
 *
 *     npx tsx scripts/verificar-presencia-diurno.ts
 *
 * Debe decir 0 divergencias.
 */
import { astDateTime } from '../src/lib/dates';
import {
    HORARIO_DIURNO,
    estaEnElEdificioConMarcas,
    estuvoEnElEdificioDurante,
    jornadaEfectiva,
    marcasCuadran,
    fechaDeLaJornada,
    presenciaDeHoy,
    type MarcasDeJornada,
} from '../src/lib/residente-diurno';

/**
 * Un día cualquiera que no sea hoy, para que el resultado no dependa de cuándo
 * se corra. Es un INSTANTE (11:00 AST del 2-oct), no una medianoche: a
 * `astDateTime` hay que darle algo cuyo día de pared AST sea el que se quiere.
 * Pasarle `fechaCalendarioAST(...)` compone el día anterior — ver la nota de
 * `jornadaEfectiva`.
 */
const DIA = new Date('2026-10-02T15:00:00.000Z');

/** Compone un instante de ese día a la hora de pared de PR que se pida. */
const aLas = (hora: number, minuto = 0) => astDateTime(DIA, hora, minuto);

/**
 * Evalúa a mano el `where` que devuelve `presenciaDeHoy`, sobre un residente
 * diurno con cero o una jornada. Es la traducción de `some`/`none` de Prisma.
 */
function loQueDiriaElWhere(instante: Date, marcas: MarcasDeJornada | null): boolean {
    const where = presenciaDeHoy(instante) as any;
    const ramaDeLaJornada = where.AND[0].OR[1].jornadasDiurnas;
    const fecha = fechaDeLaJornada(instante);

    // Sin fila, `none` se cumple siempre y `some` no se cumple nunca.
    const filas = marcas ? [{ fecha, ...marcas }] : [];

    /**
     * Traduce una condición de Prisma a un sí/no sobre una fila.
     * Soporta lo que usa `presenciaDeHoy`: igualdad con `fecha`, `OR`,
     * `{ campo: null }` (que en Prisma es «ese campo ES NULL») y los
     * comparadores `lte` / `gt`. Un comparador sobre un campo null NO casa,
     * que es justo como se comporta SQL.
     */
    const cumple = (f: any, cond: any): boolean =>
        Object.entries(cond).every(([clave, valor]: [string, any]) => {
            if (clave === 'fecha') return f.fecha.getTime() === valor.getTime();
            if (clave === 'OR') return valor.some((c: any) => cumple(f, c));
            const campo = f[clave] ?? null;
            if (valor === null) return campo === null;
            if (campo === null) return false;
            if (valor.lte !== undefined) return campo <= valor.lte;
            if (valor.gt !== undefined) return campo > valor.gt;
            throw new Error(`comparador no soportado en el simulador: ${JSON.stringify(valor)}`);
        });

    if (ramaDeLaJornada.none) return !filas.some(f => cumple(f, ramaDeLaJornada.none));
    return filas.some(f => cumple(f, ramaDeLaJornada.some));
}

/** Las formas que puede tener una jornada en la vida real. */
const CASOS: Array<{ nombre: string; marcas: MarcasDeJornada | null }> = [
    { nombre: 'sin marcar nada (lo normal)', marcas: null },
    { nombre: 'llegó puntual, sin marcar salida', marcas: { llegadaAt: aLas(7, 2), salidaAt: null } },
    { nombre: 'llegó tarde (9:30), sin salida', marcas: { llegadaAt: aLas(9, 30), salidaAt: null } },
    { nombre: 'llegó temprano (6:15), sin salida', marcas: { llegadaAt: aLas(6, 15), salidaAt: null } },
    { nombre: 'jornada completa marcada', marcas: { llegadaAt: aLas(7, 5), salidaAt: aLas(17, 50) } },
    { nombre: 'se fue temprano (14:00)', marcas: { llegadaAt: aLas(7, 0), salidaAt: aLas(14, 0) } },
    { nombre: 'se quedó tarde (20:30)', marcas: { llegadaAt: aLas(7, 0), salidaAt: aLas(20, 30) } },
    { nombre: 'solo salida, sin llegada', marcas: { llegadaAt: null, salidaAt: aLas(16, 0) } },
    { nombre: 'fila vacía (no debería existir)', marcas: { llegadaAt: null, salidaAt: null } },
];

const residente = { esDiurno: true };
let divergencias = 0;
let comprobaciones = 0;

console.log('┌──────────────────────────────────────────────────────────────────');
console.log('│ ¿coinciden estaEnElEdificioConMarcas() y presenciaDeHoy()?');
console.log(`│ horario por defecto: ${HORARIO_DIURNO.entra}:00–${HORARIO_DIURNO.sale}:00 AST`);
console.log('└──────────────────────────────────────────────────────────────────\n');

for (const caso of CASOS) {
    const fila: string[] = [];
    for (let h = 0; h < 24; h++) {
        for (const m of [0, 30]) {
            const instante = aLas(h, m);
            const enMemoria = estaEnElEdificioConMarcas(residente, instante, caso.marcas);
            const enLaConsulta = loQueDiriaElWhere(instante, caso.marcas);
            comprobaciones++;
            if (enMemoria !== enLaConsulta) {
                divergencias++;
                console.log(
                    `  ✗ DIVERGEN  ${caso.nombre}  a las ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} AST` +
                    `  → memoria=${enMemoria}  consulta=${enLaConsulta}`,
                );
            }
            if (m === 0) fila.push(enMemoria ? '█' : '·');
        }
    }
    console.log(`  ${fila.join('')}  ${caso.nombre}`);
}

console.log('\n  (cada carácter es una hora, de 00 a 23. █ = está, · = no está)\n');

// Lo que de verdad importa, dicho como afirmaciones y no como dibujo.
const esperado: Array<[string, boolean, string]> = [
    ['sin marcas, a las 12:00 está',
        estaEnElEdificioConMarcas(residente, aLas(12), null), true + ''],
    ['sin marcas, a las 22:00 no está',
        estaEnElEdificioConMarcas(residente, aLas(22), null), false + ''],
    ['llegó a las 9:30; a las 8:00 todavía NO está',
        estaEnElEdificioConMarcas(residente, aLas(8), { llegadaAt: aLas(9, 30) }), false + ''],
    ['se fue a las 14:00; a las 15:00 ya no está',
        estaEnElEdificioConMarcas(residente, aLas(15), { llegadaAt: aLas(7), salidaAt: aLas(14) }), false + ''],
    ['se quedó hasta las 20:30; a las 19:00 SÍ está',
        estaEnElEdificioConMarcas(residente, aLas(19), { llegadaAt: aLas(7), salidaAt: aLas(20, 30) }), true + ''],
    ['llegó y nadie marcó salida; a las 19:00 NO está (vuelve al horario)',
        estaEnElEdificioConMarcas(residente, aLas(19), { llegadaAt: aLas(7), salidaAt: null }), false + ''],
    ['un residente REGULAR está a las 3 de la mañana',
        estaEnElEdificioConMarcas({ esDiurno: false }, aLas(3), null), true + ''],
];

let fallos = 0;
for (const [frase, real, esp] of esperado) {
    const ok = String(real) === esp;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✓' : '✗'} ${frase}`);
}

// ── LA TERCERA FORMA: «¿estuvo DURANTE este turno?» ────────────────────────
//
// No es la misma pregunta que «¿está ahora?», y la auditoria se abre a
// cualquier hora. Lo que se comprueba aqui es que la respuesta NO dependa de
// cuando se mire.
console.log('\n  Ventanas de turno (la pregunta de la auditoria):\n');

const turnos: Array<[string, Date, Date, MarcasDeJornada | null, boolean]> = [
    ['noche 22:00–06:00, sin marcas        → NO estuvo',
        aLas(22), astDateTime(new Date('2026-10-03T15:00:00.000Z'), 6, 0), null, false],
    ['manana 06:00–14:00, sin marcas       → SI estuvo',
        aLas(6), aLas(14), null, true],
    ['tarde 14:00–22:00, sin marcas        → SI estuvo (solapa 14–18)',
        aLas(14), aLas(22), null, true],
    ['tarde 14:00–22:00, se fue a las 13:00 → NO estuvo',
        aLas(14), aLas(22), { llegadaAt: aLas(7), salidaAt: aLas(13) }, false],
    ['tarde 14:00–22:00, se quedo a las 20:30 → SI estuvo',
        aLas(14), aLas(22), { llegadaAt: aLas(7), salidaAt: aLas(20, 30) }, true],
    ['noche 22:00–06:00, se quedo a las 23:00 → SI estuvo',
        aLas(22), astDateTime(new Date('2026-10-03T15:00:00.000Z'), 6, 0),
        { llegadaAt: aLas(7), salidaAt: aLas(23) }, true],
];

for (const [frase, desde, hasta, marcas, esp] of turnos) {
    const mapa = marcas ? new Map([[fechaDeLaJornada(DIA).getTime(), marcas]]) : null;
    const real = estuvoEnElEdificioDurante(residente, desde, hasta, mapa);
    const ok = real === esp;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✓' : '✗'} ${frase}`);
}

// Y lo esencial: la respuesta no puede cambiar segun la hora a la que se mire.
// (`estuvoEnElEdificioDurante` no lee el reloj; esto lo deja escrito.)
const noche: [Date, Date] = [aLas(22), astDateTime(new Date('2026-10-03T15:00:00.000Z'), 6, 0)];
const respuestas = new Set(
    Array.from({ length: 24 }, () => estuvoEnElEdificioDurante(residente, noche[0], noche[1], null)),
);
const estable = respuestas.size === 1 && !respuestas.has(true);
if (!estable) fallos++;
console.log(`  ${estable ? '✓' : '✗'} la respuesta sobre el turno de noche no depende de cuando se mire`);

// ── LA VENTANA LARGA: ¿se miran los dias de EN MEDIO? ─────────────────────
//
// `estuvoEnElEdificioDurante` recorria solo los dias de los DOS extremos, asi
// que una ventana de mas de un dia se saltaba lo de en medio y contestaba «no
// estuvo» sobre alguien que si estuvo. Se alcanza con una sesion de turno sin
// cerrar o cerrada a la fuerza dias despues.
//
// Aqui se enfrenta contra la verdad calculada minuto a minuto: ¿hay ALGUN
// instante de la ventana en el que `estaEnElEdificioConMarcas` diga que si?
console.log('\n  Ventanas largas (la sesion de turno que nadie cerro):\n');

function verdadMinutoAMinuto(desde: Date, hasta: Date): boolean {
    const PASO = 15 * 60 * 1000;
    for (let t = desde.getTime(); t < hasta.getTime(); t += PASO) {
        if (estaEnElEdificioConMarcas(residente, new Date(t), null)) return true;
    }
    return false;
}

let largas = 0, fallanLargas = 0;
const BASE = new Date('2026-10-02T15:00:00.000Z');
for (let inicioH = 0; inicioH < 24; inicioH++) {
    for (const horas of [8, 12, 18, 24, 26, 28, 31, 36, 48, 50]) {
        const desde = astDateTime(BASE, inicioH, 0);
        const hasta = new Date(desde.getTime() + horas * 3600 * 1000);
        const dice = estuvoEnElEdificioDurante(residente, desde, hasta, null);
        const verdad = verdadMinutoAMinuto(desde, hasta);
        largas++;
        if (dice !== verdad) {
            fallanLargas++; fallos++;
            console.log(`  ✗ inicio ${String(inicioH).padStart(2,'0')}:00 AST · ${horas}h → dice=${dice} verdad=${verdad}`);
        }
    }
}
console.log(`  ${fallanLargas === 0 ? '✓' : '✗'} ${largas} ventanas de 8 a 50 h · ${fallanLargas} divergencias`);

// ── MARCAS QUE NO CUADRAN ─────────────────────────────────────────────────
//
// Una salida marcada antes de la llegada efectiva deja la ventana invertida, y
// una ventana invertida leida a secas dice «no esta» las 24 horas: el residente
// desaparece del cuidado por un toque. Debe valer el horario, no la ausencia.
console.log('\n  Marcas que no cuadran:\n');
const incoherentes: Array<[string, MarcasDeJornada]> = [
    ['«Se fue» a las 6:30 sin haber marcado llegada', { llegadaAt: null, salidaAt: aLas(6, 30) }],
    ['salida ANTES que la llegada', { llegadaAt: aLas(14, 0), salidaAt: aLas(9, 0) }],
];
for (const [frase, marcas] of incoherentes) {
    const cuadra = marcasCuadran(aLas(12), marcas);
    const j = jornadaEfectiva(aLas(12), marcas);
    const porHorario = jornadaEfectiva(aLas(12), null);
    const vuelveAlHorario = j.desde.getTime() === porHorario.desde.getTime()
        && j.hasta.getTime() === porHorario.hasta.getTime();
    const presenteAlMediodia = estaEnElEdificioConMarcas(residente, aLas(12), marcas);
    const ok = !cuadra && vuelveAlHorario && presenteAlMediodia;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✓' : '✗'} ${frase} → no cuadran, vale el horario, sigue presente`);
}

// Y lo que NO se puede arreglar adivinando. Una jornada de 7:00 a 7:02 —tocar
// «Se fue» por error a las 7:02— es coherente: corta, pero posible. El sistema
// no puede saber que fue un error sin inventarse un umbral, asi que la marca se
// respeta y el residente consta ausente. Lo que hace falta ahi no es una
// heuristica, es poder DESHACER, y eso vive en la tarjeta y en la ficha.
const cortaPeroPosible: MarcasDeJornada = { llegadaAt: null, salidaAt: aLas(7, 2) };
const esCoherente = marcasCuadran(aLas(12), cortaPeroPosible);
const quedaAusente = !estaEnElEdificioConMarcas(residente, aLas(12), cortaPeroPosible);
if (!(esCoherente && quedaAusente)) fallos++;
console.log(`  ${esCoherente && quedaAusente ? '✓' : '✗'} una jornada de 2 minutos se respeta (no se adivina): el arreglo es deshacer, no un umbral`);

console.log(`\n  ${comprobaciones} comprobaciones · ${divergencias} divergencias · ${fallos} afirmaciones falladas`);
if (divergencias > 0 || fallos > 0) process.exit(1);
console.log('  Las dos copias de la regla dicen lo mismo.\n');
