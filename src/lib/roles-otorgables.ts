import type { Role } from '@prisma/client';

/**
 * QUÉ ROL PUEDE OTORGAR QUIÉN — la única copia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ VIVE EN /lib Y NO EN LA RUTA NI EN UN MODAL
 *
 * El bug que motivó toda esta tanda fue exactamente el contrario: listas de
 * roles escritas a mano por el repo, y dos de ellas con valores que NO EXISTEN
 * en el enum `Role`:
 *
 *   · `'HR'` en `api/hr/comms/send` y `send-broadcast` — la lista funcionaba de
 *     hecho como `['DIRECTOR','ADMIN']`, así que Recursos Humanos no podía
 *     despachar un solo correo al personal. Esa tercera opción no alcanzó a
 *     nadie nunca.
 *   · `'SUPERADMIN'` sin guion bajo en la pantalla de Relevos de Guardia — la
 *     única cuenta SUPER_ADMIN del sistema veía el cartel de "no tienes
 *     permiso".
 *
 * Ninguno de los dos daba error: un string suelto que no coincide con nada
 * simplemente no coincide nunca. Compilaban, se desplegaban, y cerraban una
 * puerta en silencio durante meses.
 *
 * Por eso esto está tipado `satisfies readonly Role[]` contra el enum de
 * Prisma. El `as const` solo conserva el literal; es el `satisfies` el que hace
 * que un nombre inventado NO COMPILE.
 *
 * Y por eso hay una sola copia. Al 19-sep-2026 hay CUATRO consumidores —la
 * ruta que valida y tres pantallas que ofrecen— y una copia por consumidor se
 * desincroniza sola. El servidor manda; las pantallas leen de aquí para no
 * ofrecer lo que el servidor va a rechazar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ ES UNA LISTA BLANCA Y NO UNA NEGRA
 *
 * Hasta el 16-sep-2026 el alta de personal escribía `role: role` crudo del
 * body, sin validar, y el desplegable ofrecía DIRECTOR, ADMIN e INVESTOR. La
 * persona de Recursos Humanos podía darse de alta a sí misma —o a un
 * cómplice— como DIRECTOR, con un correo que controla y un PIN que acababa de
 * escribir. DIRECTOR tiene acceso clínico completo: el rol diseñado
 * precisamente para NO ver PHI era el que podía fabricarse acceso a toda la
 * PHI, en un sistema HIPAA.
 *
 * Con lista blanca, un rol nuevo en el enum queda FUERA hasta que alguien lo
 * escriba aquí a propósito. Por eso `CLINICAL_DIRECTOR` no aparece: existe en
 * el enum y nadie decidió todavía quién lo reparte.
 */
export const ROLES_DE_PISO = [
    'CAREGIVER', 'NURSE', 'KITCHEN', 'CLEANING',
    'MAINTENANCE', 'SOCIAL_WORKER', 'THERAPIST', 'BEAUTY_SPECIALIST',
] as const satisfies readonly Role[];

/** Mando intermedio: solo Dirección los reparte. */
export const ROLES_DE_MANDO = ['SUPERVISOR', 'COORDINATOR', 'HR_MANAGER'] as const satisfies readonly Role[];

// DIRECTOR, ADMIN, SUPER_ADMIN, INVESTOR, HQ_OWNER y CLINICAL_DIRECTOR no los
// otorga NADIE desde la app, ni Dirección: se crean fuera. Por eso no están en
// ninguna de las dos listas.

export type RolOtorgable = (typeof ROLES_DE_PISO)[number] | (typeof ROLES_DE_MANDO)[number];

export const ETIQUETA_ROL: Record<RolOtorgable, string> = {
    CAREGIVER: 'Cuidador(a)',
    NURSE: 'Enfermería',
    KITCHEN: 'Cocina',
    CLEANING: 'Limpieza',
    MAINTENANCE: 'Mantenimiento',
    SOCIAL_WORKER: 'Trabajo Social',
    THERAPIST: 'Terapeuta',
    BEAUTY_SPECIALIST: 'Especialista (Belleza)',
    SUPERVISOR: 'Supervisor(a)',
    COORDINATOR: 'Coordinador(a)',
    HR_MANAGER: 'Recursos Humanos',
};

/**
 * Nombre legible para un rol CUALQUIERA, incluidos los que no se otorgan
 * (DIRECTOR, INVESTOR…): esos se siguen MOSTRANDO en fichas y avisos aunque no
 * se puedan repartir.
 */
export function etiquetaDeRol(rol: string): string {
    return ETIQUETA_ROL[rol as RolOtorgable] ?? rol;
}

/**
 * Lo mínimo que hace falta saber de alguien para decidir qué puede otorgar.
 * Sirve igual para el `SessionUser` del servidor que para el `AuthUser` del
 * cliente, que no tienen la misma forma.
 */
export type QuienOtorga = { role?: string | null; secondaryRoles?: string[] | null } | null | undefined;

/**
 * Dirección = DIRECTOR o ADMIN, sea rol PRINCIPAL O SECUNDARIO.
 *
 * El secundario cuenta igual porque `requireRole` mira los dos
 * (src/lib/api-auth.ts:126-127): alguien puede ser SUPERVISOR con DIRECTOR
 * secundario y el servidor le deja otorgar mando. Si la pantalla mirara solo
 * `role`, le escondería opciones que el servidor sí le acepta — el error
 * simétrico del que se arregló.
 */
export function esDireccion(quien: QuienOtorga): boolean {
    const suyos = [quien?.role, ...(quien?.secondaryRoles || [])];
    return suyos.includes('DIRECTOR') || suyos.includes('ADMIN');
}

export function rolesOtorgablesPor(quien: QuienOtorga): RolOtorgable[] {
    return esDireccion(quien)
        ? [...ROLES_DE_PISO, ...ROLES_DE_MANDO]
        : [...ROLES_DE_PISO];
}
