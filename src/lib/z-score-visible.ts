/**
 * ¿SE LE ENSEÑA A ALGUIEN EL complianceScore?
 *
 * No, desde el 09-sep-2026. Decisión de Andrés: "quítalo de la pantalla hasta
 * que tenga un solo dueño."
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ
 *
 * El número está invertido respecto a la realidad. Medido ese día contra
 * producción, al lado de lo que esas personas hacen de verdad en el turno:
 *
 *     Yedaira Gonzalez ....   0    la que MÁS reporta de su turno (17 notas)
 *     Neylianne Torres ...   15    de las que más reporta del hogar (19)
 *     Joaneliz Rosario ...   43    2,959 administraciones de medicamento
 *     Mileska Aviles ..... 100    cero notas en 25 turnos
 *     Jediel Rosario .....  99    el que menos reporta (6 en 76 turnos)
 *
 * Y no cumple su propia fórmula. La documentada en /api/care/compliance-score
 * da 46 para Yedaira y 32 para Jediel; guardados están 0 y 99.
 *
 * La causa es que NO TIENE DUEÑO. Ocho sitios lo escriben con lógicas
 * distintas y gana el último que corrió:
 *
 *     /api/cron/sync-compliance              ventana rodante de 7 días
 *     /api/cron/apply-pending-observations   resta puntos de observaciones
 *     /api/hr/evaluations                    lo reemplaza por el score global
 *     /api/hr/audit-report                   Math.round(finalScore)
 *     /api/corporate/hr                      su propio cálculo
 *     /api/corporate/hr/staff/[id]           su propio cálculo
 *     /api/admin/sedes                       lo pone en 100 fijo
 *     src/lib/score-event.ts                 increment/decrement directo
 *
 * Y encima hay DOS scores que conviven, cosa que el propio score-event.ts ya
 * documentaba como deuda: el RAW de `User.complianceScore` —que es el que ven
 * RRHH y dirección— y el DINÁMICO que calcula /api/care/compliance-score, que
 * es el que ve la cuidadora en su propio perfil. Pueden dar números
 * distintos para la misma persona el mismo día.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUÉ NO SE HIZO, A PROPÓSITO
 *
 * No se borra el campo, ni se tocan los ocho escritores, ni se pierde el
 * historial de ScoreEvent. Todo sigue calculándose y guardándose. Lo único
 * que se apaga es enseñárselo a una persona, porque un número que señala a
 * alguien tiene que ser verdad antes que útil.
 *
 * Ver [veracidad-no-puntuacion]: ante un problema de registro, hacer el dato
 * veraz — no crear una métrica que castigue la conducta. Aquí la métrica ya
 * existía y castigaba justo a quien mejor lo hacía.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PARA VOLVER A ENCENDERLO
 *
 * Poner `Z_SCORE_VISIBLE = true`. Pero antes hace falta lo que le falta:
 *
 *   1. UN dueño. Un solo sitio que escriba, y los otros siete que lean.
 *   2. UNA fórmula, la misma para el RAW y para el dinámico.
 *   3. Que lo que mide se parezca a lo que el hogar quiere premiar. Hoy
 *      documentar bien no sube el score y a veces lo baja.
 *
 * Mientras falte cualquiera de las tres, esto se queda en false.
 */
export const Z_SCORE_VISIBLE = false;

/** Lo que se enseña en su lugar, para no dejar un hueco sin explicación. */
export const Z_SCORE_OCULTO_MOTIVO =
    'En revisión — el score no se muestra hasta que tenga una sola fórmula.';
