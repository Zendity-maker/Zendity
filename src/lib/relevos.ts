/**
 * QUÉ ES UN RELEVO PENDIENTE DE VERDAD. UNA SOLA DEFINICIÓN.
 *
 * ═══ QUÉ CONTABA MAL ═══
 *
 * El cron de las 6:00 AM crea cada día un PRÓLOGO DEL DÍA CLÍNICO, y lo guarda
 * como un `ShiftHandover` con `status: 'PENDING'` e `isDailyPrologue: true`. Es
 * un documento que Zendi escribe para que el piso lo lea — no una tarea. Nadie
 * tiene que aceptarlo, y su «enfermera saliente» es quien resulte ser
 * ADMIN/DIRECTOR de la sede, no alguien que entregó nada.
 *
 * Tres sitios lo sumaban como deuda:
 *
 *     src/lib/reporte-supervision.ts        → alimenta el reporte de dirección
 *     src/lib/reporte-enfermeria.ts         → «Relevos de turno sin aceptar»
 *     api/care/enfermeria/pendientes        → la línea RELEVOS_PENDIENTES
 *
 * Y uno lo hacía bien —`/corporate/medical/handovers`— porque allí se arregló
 * el 28-ago-2026 y solo allí. Su comentario ya decía el diagnóstico entero:
 * «el número acusaba de una deuda que no existe».
 *
 * ═══ LO MEDIDO EL 28-SEP-2026, CONTRA PRODUCCIÓN ═══
 *
 *     ShiftHandover en PENDING ............. 103
 *     de esos, prólogos del cron ........... 103
 *     relevos de personas .................. 0
 *     ninguno lleva firma, porque un prólogo no se firma
 *
 *     y mientras tanto, los relevos de verdad:
 *     1.079 de 1.080 entregados y firmados por quien salía (99,9 %)
 *
 * O sea que el dashboard decía «Relevos escritos que nadie aceptó» y
 * recomendaba «averiguar por qué no se aceptan — a este volumen no es olvido,
 * es que algo del flujo no funciona», señalando a un piso que estaba
 * entregando el turno todos los días.
 *
 * ═══ Y POR QUÉ NO ES SIEMPRE CERO ═══
 *
 * Con el filtro puesto hoy da 0, y eso es verdad. Pero puede moverse:
 * `/api/medical/handovers` crea relevos en PENDING desde la pantalla
 * corporativa —enfermera que entrega a enfermera que recibe— y esos sí esperan
 * a alguien. Una métrica que no puede moverse está rota (CLAUDE.md); ésta puede.
 */

import type { Prisma } from '@prisma/client';

/**
 * El `where` de «este relevo espera a alguien».
 *
 * `isDailyPrologue: false` y no `{ not: true }` a propósito: el campo tiene
 * `@default(false)`, así que las filas viejas también traen false.
 */
export function relevoPendienteDeVerdad(sedeId: string): Prisma.ShiftHandoverWhereInput {
    return {
        headquartersId: sedeId,
        status: 'PENDING',
        isDailyPrologue: false,
    };
}
