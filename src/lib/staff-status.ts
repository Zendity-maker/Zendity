import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { clinicalDayCalendarUTCRange } from '@/lib/dates';

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

/**
 * CERRAR O REABRIR UNA CUENTA, DEJANDO RASTRO.
 *
 * La bitacora SI registra usuarios —26 USER_CREATED y 61 USER_UPDATED sobre
 * 2.787 filas—, pero medido el 21-sep-2026: **USER_DELETED = 0**, y las
 * diecinueve cuentas cerradas que hay en el sistema no tienen ni una. El enum
 * `SystemAuditAction` declara esa accion y nadie la emite nunca.
 *
 * El motivo estaba en el reparto: de los TRES caminos que cierran una cuenta,
 * solo el PATCH de `hr/staff` escribia auditoria, y la baja no se hace por ahi
 * —se hace por el boton del perfil (`hr/staff/[id]`) o por el de la lista (el
 * DELETE), que no escribian nada—. Tres puertas a la misma escritura y solo una
 * con registro es como se pierde un rastro sin que nadie lo decida.
 *
 * (Una primera version de esta nota decia "cero entradas sobre un usuario,
 * nunca". Era falso: la consulta que lo midio pidio `entityType`, un campo que
 * no existe —se llama `entityName`—, y el error se lo trago un `.catch` que
 * devolvia lista vacia. Un campo que no pediste se lee igual que "no hay
 * ninguno". Es el anti-patron nº9 del proyecto, cometido midiendo.)
 *
 * QUE SE PIERDE SIN ESTO, en concreto: `User` no tiene `updatedAt` ni
 * `deletedAt`, asi que la fecha de una baja no esta escrita en ningun sitio.
 * Hoy hubo que DEDUCIRLA del ultimo turno que la persona cerro. Eso hizo que
 * una nota de este mismo repo afirmara que Joaneliz Rosario estaba "borrada
 * desde hace meses" cuando en realidad habia cerrado turno el dia anterior.
 * La entrada de auditoria es la unica fecha fiable que va a haber.
 *
 * Y LLEVA EL CONTEO DE LO QUE QUEDA COLGANDO. Al cerrar la cuenta se cuentan
 * los turnos futuros que esa persona tiene en horarios PUBLICADOS y el numero
 * va dentro del payload. No se tocan las filas a proposito —ver abajo—, pero
 * queda dicho cuantas eran y que dia. Joaneliz dejo cuatro turnos de trabajo
 * reales (22, 25, 26 y 27-sep) que nadie sabia que estaban huerfanos.
 *
 * POR QUE NO SE MARCAN AUSENTES ESOS TURNOS. Seria lo primero que uno piensa y
 * es una trampa: marcar una ausencia dispara el detector de patron de ausencias
 * (`api/hr/schedule/absent/route.ts`), que abre un IncidentReport y descuenta
 * 5 puntos de `complianceScore` si nadie contesta en 72 horas — y quien acaba
 * de irse no puede contestar, porque el login ya no le deja entrar. Seria
 * abrirle un expediente disciplinario a una persona por no presentarse a un
 * turno que ya no le corresponde. La regla del proyecto es "veracidad, no
 * puntuacion": el turno huerfano se arregla haciendo que las consultas de
 * cobertura MIREN si la persona sigue de alta, no escribiendo un castigo.
 */
/**
 * TURNOS DE TRABAJO PUBLICADOS QUE NO CUBRE NADIE.
 *
 * Misma definicion exacta que usa `registrarBaja` para su aviso: turnos de
 * TRABAJO (un OFF no deja hueco), en horario PUBLICADO (un borrador es un
 * ensayo del constructor), no marcados ausentes, de hoy en adelante, de gente
 * que ya no esta.
 *
 * EXISTE PORQUE EL AVISO DE LA BAJA SALTA UNA VEZ. `registrarBaja` devuelve el
 * conteo y la pantalla lo muestra en ese momento; si nadie actua, nada lo
 * vuelve a decir. Joaneliz Rosario dejo cuatro el 21-sep-2026 y al dia
 * siguiente seguian ahi — uno de ellos un FULL_DAY para HOY, con el horario
 * publicado y sin marcar ausente: el sistema creyendo que trabaja una persona
 * borrada.
 *
 * Una deuda que solo se anuncia cuando se contrae no es una deuda visible.
 */
export async function turnosHuerfanos(hqId: string): Promise<{
    total: number;
    porPersona: { nombre: string; turnos: { fecha: Date; tipo: string }[] }[];
}> {
    /**
     * EL ANCLA CORRECTA PARA `ScheduledShift.date`.
     *
     * `new Date()` con `setUTCHours(0,0,0,0)` da medianoche del dia UTC, y el
     * dia UTC adelanta al de Puerto Rico entre las 20:00 y las 23:59 AST: en
     * esas cuatro horas el turno de MAÑANA ya se considera "de ayer" y
     * desaparece de la lista. `clinicalDayCalendarUTCRange()` es la de las tres
     * anclas que corresponde a este campo, que se persiste a medianoche UTC.
     * Ver CLAUDE.md § "las tres anclas".
     *
     * Con cota superior explicita a proposito: CLAUDE.md pide gte+lt para que
     * un fallo de ancla salga como un cero visible y no como la lista de otro
     * dia. Aqui la cota de arriba es amplia —90 dias— porque lo que se busca
     * es todo lo futuro, pero acotado sigue siendo mejor que abierto.
     */
    const { start: hoy } = clinicalDayCalendarUTCRange();
    const tope = new Date(hoy.getTime() + 90 * 24 * 60 * 60 * 1000);
    const filas = await prisma.scheduledShift.findMany({
        where: {
            date: { gte: hoy, lt: tope },
            isAbsent: false,
            shiftType: { not: 'OFF' },
            schedule: { headquartersId: hqId, status: 'PUBLISHED' },
            // Quien ya no esta. Las dos banderas, que se mueven juntas.
            // Y de ESTA sede: el horario y el empleado pueden divergir.
            user: { headquartersId: hqId, OR: [{ isActive: false }, { isDeleted: true }] },
        },
        // El select lleva lo que se lee. Antipatron 9.
        select: {
            date: true, shiftType: true,
            user: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
    });

    const porId = new Map<string, { nombre: string; turnos: { fecha: Date; tipo: string }[] }>();
    for (const f of filas) {
        if (!porId.has(f.user.id)) porId.set(f.user.id, { nombre: f.user.name?.trim() || 'Sin nombre', turnos: [] });
        porId.get(f.user.id)!.turnos.push({ fecha: f.date, tipo: String(f.shiftType) });
    }
    return { total: filas.length, porPersona: [...porId.values()] };
}

export async function registrarBaja(
    tx: Prisma.TransactionClient,
    p: { userId: string; hqId: string; porQuien: string | null },
): Promise<{ turnosFuturosHuerfanos: number }> {
    await tx.user.update({ where: { id: p.userId }, data: datosBaja() });

    // Solo turnos de TRABAJO y de horarios PUBLICADOS. Un OFF no deja hueco que
    // cubrir, y un horario en BORRADOR es un ensayo del constructor.
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const turnosFuturosHuerfanos = await tx.scheduledShift.count({
        where: {
            userId: p.userId,
            date: { gte: hoy },
            isAbsent: false,
            shiftType: { not: 'OFF' },
            schedule: { headquartersId: p.hqId, status: 'PUBLISHED' },
        },
    });

    await tx.systemAuditLog.create({
        data: {
            headquartersId: p.hqId,
            entityName: 'User',
            entityId: p.userId,
            action: 'USER_DELETED',
            performedById: p.porQuien,
            clientIp: 'API',
            payloadChanges: { isActive: false, isDeleted: true, turnosFuturosHuerfanos },
        },
    });

    return { turnosFuturosHuerfanos };
}

/** Reabrir una cuenta. Mismo rastro, en el otro sentido. */
export async function registrarAlta(
    tx: Prisma.TransactionClient,
    p: { userId: string; hqId: string; porQuien: string | null },
): Promise<void> {
    await tx.user.update({ where: { id: p.userId }, data: datosAlta() });
    await tx.systemAuditLog.create({
        data: {
            headquartersId: p.hqId,
            entityName: 'User',
            entityId: p.userId,
            action: 'USER_UPDATED',
            performedById: p.porQuien,
            clientIp: 'API',
            payloadChanges: { isActive: true, isDeleted: false, reactivacion: true },
        },
    });
}

/** ¿Está de baja? Tolera el desfase histórico: cualquiera de las dos basta. */
export function estaDeBaja(u: { isActive?: boolean | null; isDeleted?: boolean | null }): boolean {
    return u.isActive === false || u.isDeleted === true;
}
