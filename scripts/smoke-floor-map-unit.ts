/**
 * Smoke unit-test del helper lib/floor-map.ts.
 *
 * Cubre los escenarios PUROS (sin DB):
 *   1.  floorOf por color (lookup directo)
 *   2.  floorsForCaregiver por unión de colores
 *   3.  parseColorFloorMap defensivo (basura → vacío)
 *   4.  fallback empty-map = modo legacy (un solo grupo)
 *   5.  UNASSIGNED siempre cae al sentinel (aunque alguien lo mapee)
 *   6.  hasUnmappedFloor para alertar UI ámbar
 *   7.  groupItemsByFloor con sentinel ámbar al final
 *   8.  Case-insensitivity defensiva ('red' / 'Red' / 'RED')
 *   9.  hasFloorsConfigured booleano
 *
 * Multi-tenant (item 5 del brief) NO se prueba aquí — es un test
 * de DB / endpoint que vive en smoke-floor-map-e2e.ts.
 *
 * Run:  npx tsx scripts/smoke-floor-map-unit.ts
 */

import {
    parseColorFloorMap,
    floorOf,
    floorsForCaregiver,
    floorOfPatient,
    hasUnmappedFloor,
    groupItemsByFloor,
    hasFloorsConfigured,
    UNMAPPED_FLOOR_KEY,
    UNMAPPED_FLOOR_LABEL,
} from '../src/lib/floor-map';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function eq<T>(label: string, actual: T, expected: T) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        pass++;
        console.log(`  ✓ ${label}`);
    } else {
        fail++;
        failures.push(`${label}\n    expected: ${e}\n    actual:   ${a}`);
        console.log(`  ✗ ${label}\n      expected: ${e}\n      actual:   ${a}`);
    }
}

console.log('\n═══ Smoke 1: parseColorFloorMap defensivo ═══');
{
    eq('null → vacío', parseColorFloorMap(null).size, 0);
    eq('undefined → vacío', parseColorFloorMap(undefined).size, 0);
    eq('{} → vacío', parseColorFloorMap({}).size, 0);
    eq('array → vacío', parseColorFloorMap(['RED']).size, 0);
    eq('string no-JSON → vacío', parseColorFloorMap('abc').size, 0);
    eq('JSON string válido → parseado', parseColorFloorMap('{"RED":"Piso 1"}').size, 1);
    eq('valor no-string → ignorado', parseColorFloorMap({ RED: 1 } as any).size, 0);
    eq('clave vacía → ignorada', parseColorFloorMap({ '': 'X' }).size, 0);
    eq('valor vacío → ignorado', parseColorFloorMap({ RED: '   ' }).size, 0);
    eq('mezclado válido + basura → solo lo válido',
        parseColorFloorMap({ RED: 'Piso 1', YELLOW: 0, GREEN: '   ', BLUE: 'Piso 2' } as any).size,
        2,
    );
}

console.log('\n═══ Smoke 2: floorOf básico ═══');
{
    const map = parseColorFloorMap({ RED: 'Piso 1', YELLOW: 'Piso 1', GREEN: 'Piso 2', BLUE: 'Piso 3' });
    eq('RED → Piso 1', floorOf('RED', map), 'Piso 1');
    eq('YELLOW → Piso 1', floorOf('YELLOW', map), 'Piso 1');
    eq('BLUE → Piso 3', floorOf('BLUE', map), 'Piso 3');
    eq('UNASSIGNED → null (sentinel)', floorOf('UNASSIGNED', map), null);
    eq('null → null', floorOf(null, map), null);
    eq('undefined → null', floorOf(undefined, map), null);
    eq('color desconocido → null', floorOf('PURPLE', map), null);
}

console.log('\n═══ Smoke 3: case-insensitivity defensiva ═══');
{
    const map = parseColorFloorMap({ RED: 'Piso 1' });
    eq('"red" → Piso 1', floorOf('red', map), 'Piso 1');
    eq('"Red" → Piso 1', floorOf('Red', map), 'Piso 1');
    eq('"  RED  " → Piso 1', floorOf('  RED  ', map), 'Piso 1');
    // En el parser también: claves del map se normalizan a UPPER.
    const map2 = parseColorFloorMap({ red: 'Piso 1', YeLLoW: 'Piso 2' });
    eq('parser uppercase keys', floorOf('RED', map2), 'Piso 1');
    eq('parser mixed-case keys', floorOf('yellow', map2), 'Piso 2');
}

console.log('\n═══ Smoke 4: UNASSIGNED siempre cae al sentinel ═══');
{
    // Aunque alguien mapee UNASSIGNED a un piso "real" en el JSON, el helper
    // SIEMPRE lo trata como sentinel — defensa explícita en floorOf.
    const map = parseColorFloorMap({ UNASSIGNED: 'Piso 99', RED: 'Piso 1' });
    eq('UNASSIGNED → null aunque mapeado', floorOf('UNASSIGNED', map), null);
    eq('RED del mismo map sigue funcionando', floorOf('RED', map), 'Piso 1');
}

console.log('\n═══ Smoke 5: floorsForCaregiver (unión de colores) ═══');
{
    const map = parseColorFloorMap({ RED: 'Piso 1', YELLOW: 'Piso 1', GREEN: 'Piso 2', BLUE: 'Piso 3' });
    eq('un color → un piso', floorsForCaregiver(['RED'], map), ['Piso 1']);
    eq('mismo piso, distintos colores → un piso',
        floorsForCaregiver(['RED', 'YELLOW'], map),
        ['Piso 1'],
    );
    eq('distintos pisos → varios pisos ordenados',
        floorsForCaregiver(['BLUE', 'RED'], map),
        ['Piso 1', 'Piso 3'],
    );
    eq('cuidadora sin colores → []', floorsForCaregiver([], map), []);
    eq('todos los colores sin mapear → []',
        floorsForCaregiver(['PURPLE', 'UNASSIGNED'], map),
        [],
    );
    eq('uno mapeado + uno huérfano → solo el mapeado',
        floorsForCaregiver(['RED', 'PURPLE'], map),
        ['Piso 1'],
    );
}

console.log('\n═══ Smoke 6: hasUnmappedFloor (señal UI ámbar) ═══');
{
    const map = parseColorFloorMap({ RED: 'Piso 1', BLUE: 'Piso 3' });
    eq('todos mapeados → false', hasUnmappedFloor(['RED', 'BLUE'], map), false);
    eq('uno no mapeado → true', hasUnmappedFloor(['RED', 'PURPLE'], map), true);
    eq('UNASSIGNED → true', hasUnmappedFloor(['UNASSIGNED'], map), true);
    eq('lista vacía → false (no es huérfana, es 0 turnos)',
        hasUnmappedFloor([], map),
        false,
    );
}

console.log('\n═══ Smoke 7: fallback empty-map = modo legacy ═══');
{
    const empty = new Map<string, string>();
    eq('floorOf con map vacío → null', floorOf('RED', empty), null);
    eq('floorsForCaregiver con map vacío → []',
        floorsForCaregiver(['RED', 'BLUE'], empty),
        [],
    );
    eq('hasFloorsConfigured vacío → false', hasFloorsConfigured(empty), false);
    // El caller usa hasFloorsConfigured para decidir si renderiza secciones
    // o cae a layout plano legacy. CERO crash con map nulo/vacío/basura.
}

console.log('\n═══ Smoke 8: floorOfPatient (azúcar sintáctica) ═══');
{
    const map = parseColorFloorMap({ RED: 'Piso 1' });
    eq('paciente con color mapeado',
        floorOfPatient({ colorGroup: 'RED' }, map),
        'Piso 1',
    );
    eq('paciente UNASSIGNED → null',
        floorOfPatient({ colorGroup: 'UNASSIGNED' }, map),
        null,
    );
    eq('paciente con colorGroup null → null',
        floorOfPatient({ colorGroup: null }, map),
        null,
    );
}

console.log('\n═══ Smoke 9: groupItemsByFloor con sentinel ámbar ═══');
{
    const map = parseColorFloorMap({ RED: 'Piso 1', YELLOW: 'Piso 1', GREEN: 'Piso 2' });
    const items = [
        { name: 'A', color: 'RED' },
        { name: 'B', color: 'YELLOW' },
        { name: 'C', color: 'GREEN' },
        { name: 'D', color: 'UNASSIGNED' },
        { name: 'E', color: 'PURPLE' },
    ];
    const sections = groupItemsByFloor(items, (i) => i.color, map);

    eq('número de secciones = 3 (Piso 1, Piso 2, sentinel)', sections.length, 3);
    eq('primera sección = Piso 1', sections[0].key, 'Piso 1');
    eq('Piso 1 contiene A + B', sections[0].items.map(i => i.name).sort(), ['A', 'B']);
    eq('segunda sección = Piso 2', sections[1].key, 'Piso 2');
    eq('Piso 2 contiene C', sections[1].items.map(i => i.name), ['C']);
    eq('tercera sección = sentinel', sections[2].key, UNMAPPED_FLOOR_KEY);
    eq('sentinel.isUnmapped = true', sections[2].isUnmapped, true);
    eq('sentinel.label = "Sin piso asignado"', sections[2].label, UNMAPPED_FLOOR_LABEL);
    eq('sentinel contiene D + E', sections[2].items.map(i => i.name).sort(), ['D', 'E']);
    eq('orden: pisos reales alfabético, sentinel al final',
        sections.map(s => s.key),
        ['Piso 1', 'Piso 2', UNMAPPED_FLOOR_KEY],
    );
}

console.log('\n═══ Smoke 10: groupItemsByFloor con map vacío ═══');
{
    // Modo legacy: todos los items caen al sentinel (el caller usa
    // hasFloorsConfigured para decidir si renderiza plano vs secciones).
    const map = new Map<string, string>();
    const items = [
        { color: 'RED' },
        { color: 'GREEN' },
    ];
    const sections = groupItemsByFloor(items, (i) => i.color, map);
    eq('una sola sección (sentinel) cuando map vacío', sections.length, 1);
    eq('todos en sentinel', sections[0].items.length, 2);
    eq('sentinel marcado isUnmapped', sections[0].isUnmapped, true);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`Resultado: ${pass} pass / ${fail} fail`);
if (fail > 0) {
    console.log('\nFallas:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
    process.exit(1);
}
console.log('✓ Todos los smokes unit verdes — helper listo para deploy.\n');
