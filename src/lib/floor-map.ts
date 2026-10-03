/**
 * Sprint floor-map — derivación de piso a partir del color.
 *
 * MODELO: el PISO es un contenedor, los COLORES viven dentro. Un piso puede
 * tener uno o más colores, y la asignación color→piso es configurable por
 * sede (multi-tenant). El builder de pauta trabaja por color, no por piso;
 * el piso de una cuidadora o de un residente se DERIVA de su color via el
 * mapa de su sede.
 *
 * Single source of truth: `Headquarters.colorFloorMap` (Json?, nullable).
 * Shape esperado: { "RED": "Piso 1", "YELLOW": "Piso 1", "GREEN": "Piso 2" }
 *
 * REGLAS DEFENSIVAS (críticas para evitar crash de UI en producción):
 *   1. Map null / undefined / vacío   → comportamiento legacy (un solo piso).
 *   2. Map malformado (no objeto, valores no-string, claves vacías) → vacío.
 *   3. Color sin mapear / UNASSIGNED   → sentinel `null` (la UI lo agrupa
 *      bajo el bucket ámbar "Sin piso asignado", nunca inventa un piso).
 *   4. Color en mayúsculas y mapa case-insensitive: el caller normalmente
 *      pasa 'RED' (enum), pero defensivo si llega 'red' / 'Red'.
 */

import { CODIGOS_DE_COLOR, nombreDeColor } from '@/lib/colores-de-grupo';

// ── Tipos públicos ──────────────────────────────────────────────────────────

export type ColorFloorMap = Map<string, string>;

/** Etiqueta UX del sentinel cuando un color no está mapeado a piso. */
export const UNMAPPED_FLOOR_LABEL = 'Sin piso asignado';

/** Sentinel para el agrupador del wall/picker — distingue "huérfano" de un piso real. */
export const UNMAPPED_FLOOR_KEY = '__unmapped__';

// ── Parser defensivo ────────────────────────────────────────────────────────

/**
 * Parsea el campo `Headquarters.colorFloorMap` (Json? de Prisma) a una Map
 * case-insensitive. Cualquier basura → Map vacío (modo legacy).
 *
 * Acepta:
 *   - null / undefined                    → Map() vacío
 *   - {}                                  → Map() vacío
 *   - { "RED": "Piso 1", "GREEN": "..." } → Map normalizada
 *   - String JSON (defensivo)             → intenta parsear
 *
 * Rechaza silenciosamente:
 *   - Arrays, primitivos, claves vacías, valores no-string, valores vacíos.
 */
export function parseColorFloorMap(raw: unknown): ColorFloorMap {
    const out: ColorFloorMap = new Map();

    if (raw === null || raw === undefined) return out;

    let obj: unknown = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        } catch {
            return out;
        }
    }

    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return out;

    for (const [k, v] of Object.entries(obj)) {
        if (typeof k !== 'string' || k.trim().length === 0) continue;
        if (typeof v !== 'string' || v.trim().length === 0) continue;
        out.set(k.trim().toUpperCase(), v.trim());
    }

    return out;
}

// ── Lookups ─────────────────────────────────────────────────────────────────

/**
 * Piso del color, o `null` si no está mapeado / map vacío / color UNASSIGNED.
 * UNASSIGNED siempre cae al sentinel — nunca a un piso "real" aunque alguien
 * lo mapee por accidente.
 */
export function floorOf(color: string | null | undefined, map: ColorFloorMap): string | null {
    if (!color) return null;
    const key = color.trim().toUpperCase();
    if (key === 'UNASSIGNED' || key === '') return null;
    return map.get(key) ?? null;
}

/**
 * Pisos distintos derivados de N colores de una cuidadora (puede tener
 * múltiples si la pauta del turno mezcla colores o si hay overrides activos).
 * Caller pasa el array que ya viene de `resolveCaregiverColors`.
 *
 * Devuelve string[] ordenado y deduplicado. Si la cuidadora tiene un color
 * sin mapear, ese piso "no aparece" — el caller decide si renderiza el
 * sentinel `null` por separado (vía `hasUnmappedFloor` abajo).
 */
export function floorsForCaregiver(colors: string[], map: ColorFloorMap): string[] {
    const set = new Set<string>();
    for (const c of colors) {
        const f = floorOf(c, map);
        if (f) set.add(f);
    }
    return Array.from(set).sort();
}

/** ¿La cuidadora tiene al menos un color sin piso mapeado? */
export function hasUnmappedFloor(colors: string[], map: ColorFloorMap): boolean {
    if (colors.length === 0) return false;
    return colors.some(c => floorOf(c, map) === null);
}

/** Piso de un residente — su color es estable (`Patient.colorGroup`). */
export function floorOfPatient(
    patient: { colorGroup: string | null | undefined },
    map: ColorFloorMap,
): string | null {
    return floorOf(patient.colorGroup, map);
}

// ── Agrupador para wall y picker ────────────────────────────────────────────

/**
 * Sección de UI: un piso (string real) o el sentinel (`UNMAPPED_FLOOR_KEY`).
 * El caller renderiza ámbar para `key === UNMAPPED_FLOOR_KEY`.
 */
export interface FloorSection<T> {
    /** Clave estable para el bucket: nombre del piso o sentinel. */
    key: string;
    /** Etiqueta visible. `UNMAPPED_FLOOR_LABEL` para el sentinel. */
    label: string;
    /** True para el bucket ámbar (sin piso). */
    isUnmapped: boolean;
    /** Items que cayeron en este piso. */
    items: T[];
}

/**
 * Agrupa items por piso derivado. Items con color sin mapear / UNASSIGNED
 * caen al sentinel ámbar. Si el map está vacío (modo legacy), todos los
 * items van al sentinel — el caller puede detectar esto y renderizar plano
 * sin secciones.
 *
 * @param items     Cualquier shape con un campo color resoluble.
 * @param colorOf   Cómo extraer el color del item (RED/YELLOW/...).
 * @param map       El colorFloorMap parseado del HQ.
 */
export function groupItemsByFloor<T>(
    items: T[],
    colorOf: (item: T) => string | null | undefined,
    map: ColorFloorMap,
): FloorSection<T>[] {
    const buckets = new Map<string, T[]>();

    for (const item of items) {
        const floor = floorOf(colorOf(item), map);
        const key = floor ?? UNMAPPED_FLOOR_KEY;
        const arr = buckets.get(key);
        if (arr) arr.push(item);
        else buckets.set(key, [item]);
    }

    // Pisos reales ordenados alfabéticamente; sentinel al final.
    const realKeys = Array.from(buckets.keys()).filter(k => k !== UNMAPPED_FLOOR_KEY).sort();
    const sections: FloorSection<T>[] = realKeys.map(k => ({
        key: k,
        label: k,
        isUnmapped: false,
        items: buckets.get(k)!,
    }));
    if (buckets.has(UNMAPPED_FLOOR_KEY)) {
        sections.push({
            key: UNMAPPED_FLOOR_KEY,
            label: UNMAPPED_FLOOR_LABEL,
            isUnmapped: true,
            items: buckets.get(UNMAPPED_FLOOR_KEY)!,
        });
    }
    return sections;
}

/**
 * ¿La sede tiene pisos configurados? Si false, el caller debe renderizar
 * lista plana sin secciones (no inventar "Piso único").
 */
export function hasFloorsConfigured(map: ColorFloorMap): boolean {
    return map.size > 0;
}

// ── Escritura ───────────────────────────────────────────────────────────────

/**
 * VALIDA Y NORMALIZA UN MAPA QUE VIENE DE UNA PANTALLA.
 *
 * El parser de arriba es DEFENSIVO: ante basura devuelve un mapa vacío, que es
 * lo correcto al LEER —una pantalla no debe reventar por un dato malo— pero es
 * exactamente lo que no se quiere al ESCRIBIR. Guardar basura en silencio y
 * descubrirlo al leer significa que el mapa queda vacío, que `floorOf` devuelve
 * null para todos, y que el hogar entero cae en «Sin piso asignado» sin que
 * nadie haya visto un error. Por eso guardar tiene su propia puerta y esta
 * explica qué está mal.
 *
 * Qué hace, y por qué cada cosa:
 *
 *   · **Solo acepta colores que existen.** Una clave inventada —un typo como
 *     `PURPEL`, o un `ALL`, que no es un color— se queda ahí para siempre sin
 *     corresponder a nadie, y nada la señala. La lista sale de
 *     `colores-de-grupo.ts`: abrir un color lo habilita aquí solo.
 *
 *   · **Unifica la ortografía del piso.** El valor es texto libre («Piso 2»), y
 *     el parser respeta mayúsculas y minúsculas. Sin esto, escribir «piso 2»
 *     en un color y «Piso 2» en otro parte el hogar en dos plantas que son la
 *     misma: el wall las agrupa por separado y la cobertura cuenta de más.
 *     Gana la primera ortografía que aparece.
 *
 *   · **Un mapa sin ninguna entrada se guarda como `null`.** No es lo mismo que
 *     un mapa roto: `null` significa «esta sede es de una sola planta», que es
 *     un estado legítimo y es el de Mayagüez. Dejarlo como `{}` diría lo mismo
 *     al leer, pero `null` es lo que ya hay escrito y dos representaciones de
 *     la misma cosa acaban divergiendo.
 */
export function validarColorFloorMap(
    raw: unknown,
): { ok: true; mapa: Record<string, string> | null } | { ok: false; error: string } {
    if (raw === null || raw === undefined) return { ok: true, mapa: null };
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: 'El mapa de pisos tiene que ser un objeto color → piso.' };
    }

    const permitidos = new Set(CODIGOS_DE_COLOR);
    const salida: Record<string, string> = {};
    /** ortografía en minúsculas → la que gana. */
    const vistos = new Map<string, string>();

    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const color = String(k ?? '').trim().toUpperCase();
        if (!color) continue;
        if (!permitidos.has(color)) {
            return { ok: false, error: `«${k}» no es un grupo de color.` };
        }

        if (v === null || v === undefined) continue; // sin piso: se omite

        // El `typeof` ANTES de tocar el valor: `String(v)` sobre un objeto llama
        // a su `toString`, que puede lanzar, y entonces esta funcion —que existe
        // para decir que algo esta mal— revienta en vez de decirlo.
        if (typeof v !== 'string') {
            return { ok: false, error: `El piso de ${nombreDeColor(color)} tiene que ser texto.` };
        }

        /**
         * Se colapsa el espacio INTERIOR, no solo las puntas.
         *
         * `trim()` deja «Piso  2» (dos espacios) distinto de «Piso 2», y
         * `toLowerCase()` tampoco los junta: se guardarian como dos plantas. Y
         * no se notaria mirando la pantalla, porque HTML colapsa los espacios
         * seguidos y las dos cabeceras se leen «Piso 2» — el wall enseñaria la
         * misma planta dos veces y la cobertura la contaria de mas. Es el mismo
         * daño que la diferencia de mayusculas, por una puerta que no se ve.
         * De paso mata los saltos de linea.
         */
        const piso = v.replace(/\s+/g, ' ').trim();
        if (!piso) continue; // era solo espacios: sin piso

        if (piso.length > 40) {
            return { ok: false, error: `El piso de ${nombreDeColor(color)} es demasiado largo.` };
        }

        const llave = piso.toLowerCase();
        if (!vistos.has(llave)) vistos.set(llave, piso);
        salida[color] = vistos.get(llave)!;
    }

    return { ok: true, mapa: Object.keys(salida).length > 0 ? salida : null };
}
