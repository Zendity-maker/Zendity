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
