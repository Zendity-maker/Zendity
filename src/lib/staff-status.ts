import { Prisma } from '@prisma/client';

/**
 * Estado de un empleado — fuente única de verdad.
 *
 * Contexto (19-ago-2026). El sistema tenía TRES banderas solapadas y una
 * definición distinta en cada pantalla:
 *
 *   isShiftBlocked  no bloqueaba nada — solo pintaba la fila de rosa
 *   isActive        la puerta real del login (src/lib/auth.ts)
 *   isDeleted       "baja definitiva", también verificada en el login
 *
 * Consecuencia concreta: dos cuidadoras quedaron con isDeleted:true pero
 * isActive:true. No podían entrar (auth mira las dos), pero toda query que
 * filtrara solo por isActive las devolvía como si trabajaran — aparecían en
 * conteos, en reportes, y el backfill de la certificación les asignó cursos
 * y les mandó notificaciones a gente que ya no estaba.
 *
 * Definición del dueño, que es la que manda:
 *
 *   SUSPENDIDO DE TURNO (isShiftBlocked)
 *     Sigue siendo empleado activo. Conserva su login y entra a Zendity.
 *     No poncha ni se le asignan turnos nuevos. Es temporal.
 *
 *   DE BAJA (isActive:false)
 *     No vuelve. No necesita login ni acceso. Su historial se conserva
 *     completo — es expediente.
 *
 * `isDeleted` no aporta un tercer estado: es la baja con otro nombre. Se
 * mantiene escrita EN SINCRONÍA con isActive para no romper los ~40 sitios
 * que todavía la leen, pero deja de ser un discriminador independiente.
 *
 * INVARIANTE que todo el código debe preservar:
 *
 *     isDeleted === !isActive
 *
 * Escribe siempre con `datosBaja()` / `datosAlta()` en vez de tocar los
 * campos sueltos.
 */

/** Empleados que trabajan hoy. */
export function staffActivoWhere(hqId: string): Prisma.UserWhereInput {
    return { headquartersId: hqId, isActive: true, isDeleted: false };
}

/** Empleados que trabajan hoy Y pueden tomar turno. */
export function staffDisponibleWhere(hqId: string): Prisma.UserWhereInput {
    return { ...staffActivoWhere(hqId), isShiftBlocked: false };
}

/** Dar de baja: ambas banderas juntas, siempre. */
export function datosBaja(): Prisma.UserUpdateInput {
    return { isActive: false, isDeleted: true };
}

/** Reactivar: ambas banderas juntas, siempre. */
export function datosAlta(): Prisma.UserUpdateInput {
    return { isActive: true, isDeleted: false };
}

/** ¿Está de baja? Tolera el desfase histórico: cualquiera de las dos basta. */
export function estaDeBaja(u: { isActive?: boolean | null; isDeleted?: boolean | null }): boolean {
    return u.isActive === false || u.isDeleted === true;
}
