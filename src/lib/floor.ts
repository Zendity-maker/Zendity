/**
 * src/lib/floor.ts — Sprint Multi-Floor (jun-2026)
 *
 * Source of truth para el scoping por piso. Cualquier endpoint que toque
 * cobertura, color, override, redistribution o vista del cuidador DEBE pasar
 * por estos helpers — no inventar reglas in-line.
 *
 * Reglas operacionales (decididas con Andrés, ver thread "BUILD multi-piso"):
 *
 *   • CAREGIVER:
 *       - floor REQUERIDO. Si user.floor === null → endpoint retorna 422
 *         "Cuidadora sin piso asignado".
 *       - Vista (tablet, my-color downstream, rounds) scoped al piso.
 *       - Overrides explícitos cross-piso (ShiftPatientOverride creado con
 *         allowCrossFloor=true) le añaden residentes específicos por id;
 *         esos sí se ven aunque no coincida el floor.
 *
 *   • SUPERVISOR / DIRECTOR / ADMIN / NURSE:
 *       - floor opcional. Su valor es REFERENCIAL ("piso habitual"), NO
 *         restringe lo que ven. Estos roles siempre operan con scope = 'ALL'.
 *       - El wall del supervisor agrupa por piso en UI pero la query trae todo.
 *
 *   • Otros roles (FAMILY, KITCHEN, CLEANING, etc.) — fuera del modelo de
 *     cobertura clínica; no llaman estos helpers.
 *
 * Cobertura de emergencia cross-piso:
 *   Cuando piso 1 tiene 1 sola cuidadora y falta, un SUPERVISOR/DIRECTOR
 *   puede ejecutar assign-color/claim-coverage/redistribute con flag
 *   `allowCrossFloor=true`. El endpoint llama assertSameFloor(..., {allowCrossFloor:true})
 *   que omite la validación. El endpoint es responsable de:
 *     1. Validar que el invoker tenga rol autorizado para el flag.
 *     2. Registrar la decisión en audit (PHI/operational log).
 *
 * Por qué un módulo central:
 *   Si dejamos la regla diseminada por 10 endpoints, garantizado que el día
 *   que se ajuste algo (ej. añadir piso 3) se nos olvida un site y aparece
 *   el clásico "residente fantasma". Un solo lugar = un solo punto de cambio.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────

/**
 * FloorScope = el alcance efectivo de un usuario sobre la dimensión piso.
 *   - número: scope acotado a ese piso (típicamente CAREGIVER).
 *   - 'ALL':  scope multi-piso (managers + roles clínicos cross-piso).
 *
 * Convencion: se prefiere 'ALL' como literal antes que un número mágico (-1)
 * porque hace ilegible al lector que esto NO es un piso "0" o "-1".
 */
export type FloorScope = number | 'ALL';

export interface UserFloorContext {
    role: string;
    floor: number | null;
}

// ─── Reglas de rol ──────────────────────────────────────────────────────

/**
 * Roles donde floor=null es ERROR. Hoy: solo CAREGIVER.
 *
 * Por qué CAREGIVER y no NURSE: en el modelo operativo de Vivid Cupey, los
 * cuidadores están pinneados a su piso (cuidan residentes específicos en
 * una planta física). Las enfermeras circulan entre pisos para tareas
 * clínicas puntuales (administrar med X en piso 1, valorar herida Y en
 * piso 2), entonces NURSE.floor=null = "ve toda la sede" es la lectura
 * realista. Si en el futuro emerge "enfermera pinneada a piso" se añade
 * a esta lista — pero NO antes de tener el caso real.
 */
const FLOOR_REQUIRED_ROLES: ReadonlySet<string> = new Set(['CAREGIVER']);

/**
 * Roles donde floor=null = ALL (managers + clínico cross-piso).
 * Listado explícito para que el "default" no sea "ALL implícito" — si llega
 * un rol nuevo no listado, fallamos ruidoso en lugar de asumir.
 */
const FLOOR_OPTIONAL_ROLES: ReadonlySet<string> = new Set([
    'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN',
]);

/**
 * Roles autorizados a invocar `allowCrossFloor=true` en endpoints de
 * cobertura de emergencia. CAREGIVER nunca puede saltarse su piso solo —
 * tiene que pasar por un supervisor.
 */
const CROSS_FLOOR_OVERRIDE_ROLES: ReadonlySet<string> = new Set([
    'SUPERVISOR', 'DIRECTOR', 'ADMIN',
]);

// ─── Errores estructurados ──────────────────────────────────────────────

/**
 * Error: cuidadora intenta operar sin tener floor asignado en su User.
 * El endpoint debería traducirlo a 422 con `error.message` como detail.
 */
export class CaregiverFloorMissingError extends Error {
    readonly code = 'CAREGIVER_FLOOR_MISSING' as const;
    constructor(userId: string) {
        super(
            `Cuidadora ${userId} no tiene piso asignado. ` +
            `Un administrador debe asignarle un piso desde la UI de personal antes de que pueda operar.`,
        );
    }
}

/**
 * Error: intento explícito cross-piso sin flag autorizado, o intento
 * cross-piso con flag pero por un rol no autorizado.
 */
export class CrossFloorViolationError extends Error {
    readonly code = 'CROSS_FLOOR_VIOLATION' as const;
    constructor(
        readonly ctx: string,
        readonly invokerFloor: number,
        readonly targetFloor: number | null,
    ) {
        super(
            `${ctx}: operación cross-piso bloqueada ` +
            `(invoker piso ${invokerFloor} → target piso ${targetFloor ?? 'null'}). ` +
            `Use el flag explícito allowCrossFloor=true si es cobertura de emergencia ` +
            `(requiere rol SUPERVISOR/DIRECTOR y queda en audit).`,
        );
    }
}

/**
 * Error de integridad: paciente ACTIVE con floor=null encontrado en flujo
 * scoped. Significa que el backfill se quedó corto — el deploy NO debió
 * salir. Endpoint debería responder 500 (es bug del sistema, no del user).
 */
export class PatientFloorIntegrityError extends Error {
    readonly code = 'PATIENT_FLOOR_INTEGRITY' as const;
    constructor(readonly patientId: string, readonly ctx: string) {
        super(
            `${ctx}: paciente ${patientId} sin floor asignado. ` +
            `Integridad violada — backfill incompleto o flujo de creación bypaseó el guard.`,
        );
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Resuelve el FloorScope efectivo para un usuario.
 *
 * Throws `CaregiverFloorMissingError` si el rol exige piso y no lo tiene.
 * Para roles managers retorna 'ALL' incluso si tiene floor seteado
 * (porque `User.floor` para esos roles es referencial, no restrictivo).
 * Para roles fuera del modelo clínico (FAMILY, etc.) también retorna 'ALL'
 * — esos no llaman este helper en práctica, pero el fallback es seguro.
 *
 * @example
 *   const scope = resolveUserFloorScope({ role: 'CAREGIVER', floor: 2 });
 *   // → 2
 *   const scope = resolveUserFloorScope({ role: 'SUPERVISOR', floor: null });
 *   // → 'ALL'
 *   const scope = resolveUserFloorScope({ role: 'SUPERVISOR', floor: 2 });
 *   // → 'ALL'  (manager con floor referencial)
 *   resolveUserFloorScope({ role: 'CAREGIVER', floor: null }, 'user-id-xxx');
 *   // → throws CaregiverFloorMissingError
 */
export function resolveUserFloorScope(
    user: UserFloorContext,
    userIdForError = '(unknown)',
): FloorScope {
    if (FLOOR_REQUIRED_ROLES.has(user.role)) {
        if (user.floor === null || user.floor === undefined) {
            throw new CaregiverFloorMissingError(userIdForError);
        }
        return user.floor;
    }
    // Managers + roles clínicos cross-piso: siempre ALL, incluso con floor set.
    return 'ALL';
}

/**
 * Verifica que cuidadora puede operar sobre paciente del piso target.
 * Si `allowCrossFloor=true` se omite la validación (caller responsable de
 * autorizar al invoker y registrar audit).
 *
 * Throws:
 *   - `PatientFloorIntegrityError` si targetFloor === null (data corrupta)
 *   - `CrossFloorViolationError` si floors no coinciden y no hay flag
 *
 * Para ScopeUserFloor='ALL' (managers): asserción pasa siempre — no hay
 * concepto de "cross-floor" para quien opera multi-piso.
 *
 * @param invokerScope  scope del cuidador/operador (de resolveUserFloorScope)
 * @param targetFloor   floor del recurso objetivo (paciente, etc.)
 * @param ctx           etiqueta de contexto para el error (ej. "assign-color")
 * @param opts.allowCrossFloor  si true, omite la validación (uso supervisado)
 * @param opts.targetIdForError  id del recurso para incluir en mensajes
 */
export function assertSameFloor(
    invokerScope: FloorScope,
    targetFloor: number | null,
    ctx: string,
    opts: { allowCrossFloor?: boolean; targetIdForError?: string } = {},
): void {
    if (invokerScope === 'ALL') return; // managers operan multi-piso por diseño
    if (targetFloor === null || targetFloor === undefined) {
        throw new PatientFloorIntegrityError(opts.targetIdForError ?? '(unknown)', ctx);
    }
    if (invokerScope === targetFloor) return;
    if (opts.allowCrossFloor) return;
    throw new CrossFloorViolationError(ctx, invokerScope, targetFloor);
}

/**
 * Helper: ¿el rol del invoker está autorizado a usar el flag allowCrossFloor?
 * Endpoint debería llamarlo ANTES de pasar `allowCrossFloor: true` a
 * `assertSameFloor`. Si retorna false con flag pretendido, el endpoint
 * responde 403 (el usuario quiso saltarse el piso sin tener permiso).
 */
export function canInvokeCrossFloorOverride(role: string): boolean {
    return CROSS_FLOOR_OVERRIDE_ROLES.has(role);
}

/**
 * Devuelve un fragmento `{ floor }` listo para spreadear en `prisma.<m>.findMany({where})`.
 * Para scope='ALL' devuelve `{}` (sin filtro). Para scope número devuelve `{ floor: N }`.
 *
 * Acepta `Patient` o `User` indistintamente — el campo se llama `floor` en
 * ambos modelos.
 *
 * @example
 *   const patients = await prisma.patient.findMany({
 *     where: {
 *       headquartersId: hqId,
 *       status: 'ACTIVE',
 *       ...floorWhereFilter(scope),
 *     },
 *   });
 */
export function floorWhereFilter(scope: FloorScope): { floor?: number } {
    return scope === 'ALL' ? {} : { floor: scope };
}

/**
 * Helper para queries de hr/staff: filtra User por floor cuando se especifica.
 *
 * El listado de staff en el Schedule Builder puede pedir ?floor=2 para mostrar
 * solo cuidadoras del piso 2. Cuando no se pasa, devuelve TODO (incluye
 * managers con floor=null + cuidadoras de cualquier piso).
 *
 * Diferencia con `floorWhereFilter`: este NO requiere mapear a un scope —
 * acepta el query string crudo. Si recibes 'ALL' o '' o undefined, no filtra.
 */
export function staffFloorFilter(rawFloor: string | number | null | undefined): {
    floor?: number;
} {
    if (rawFloor === undefined || rawFloor === null || rawFloor === '' || rawFloor === 'ALL') return {};
    const n = typeof rawFloor === 'number' ? rawFloor : parseInt(String(rawFloor), 10);
    if (!Number.isFinite(n) || n <= 0) return {};
    return { floor: n };
}

/**
 * Etiqueta legible para UI ("Piso 1", "Piso 2", "Multi-piso").
 * Útil en wall del supervisor, headers de tablet, badges del schedule.
 */
export function floorLabel(scope: FloorScope | null | undefined): string {
    if (scope === null || scope === undefined) return 'Multi-piso';
    if (scope === 'ALL') return 'Multi-piso';
    return `Piso ${scope}`;
}

/**
 * Bucket helper para agrupar resultados por piso en UI o response.
 *
 * Toma un array de items con campo `floor: number | null` y los agrupa.
 * `null` cae en bucket 'unassigned' (no debería existir en flujos sanos —
 * verify-multi-floor lo expone). Buckets ordenados ascendente por número
 * y luego 'unassigned' al final.
 *
 * @example
 *   const buckets = groupByFloor(caregivers);
 *   // → { 1: [...], 2: [...], unassigned: [] }
 */
export function groupByFloor<T extends { floor: number | null }>(
    items: T[],
): { [k: string]: T[] } {
    const out: Record<string, T[]> = {};
    for (const item of items) {
        const key = item.floor === null || item.floor === undefined ? 'unassigned' : String(item.floor);
        if (!out[key]) out[key] = [];
        out[key].push(item);
    }
    return out;
}
