/**
 * LA VISTA CONSOLIDADA DEL GRUPO — construida, apagada a propósito.
 *
 * Andrés la pidió el 19-sep-2026 —"una vista consolidada de ambas me gusta"— y
 * ese mismo día pidió que no se enseñara todavía: *"desarrolla la vista de
 * consolidacion pero no la pongas a la vista aun."*
 *
 * Así que está entera y funcionando: la API la calcula y la manda en
 * `consolidado`, y la pantalla sabe pintarla. Lo único que falta es que este
 * booleano diga `true`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ UN INTERRUPTOR Y NO CÓDIGO COMENTADO O SIN ESCRIBIR
 *
 * Es el mismo patrón de `src/lib/z-score-visible.ts`: lo que se apaga
 * comentando se pudre —deja de compilar, deja de cuadrar con el payload, y
 * cuando alguien lo quiere encender descubre que hay que rehacerlo—. Apagado
 * con un booleano sigue tipado, sigue compilando y sigue viajando en el
 * payload, así que encenderlo es cambiar esta línea y nada más.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUÉ ENSEÑA CUANDO SE ENCIENDA, PARA QUE NADIE SE LLEVE UNA SORPRESA
 *
 * La suma de las sedes que el invocador puede ver. Dos decisiones que van
 * dentro y conviene saber antes de encenderla:
 *
 *   · Los porcentajes se RECALCULAN sobre los totales, nunca se promedian. Un
 *     margen consolidado es (ingresos totales − gastos totales) / ingresos
 *     totales.
 *   · Una sede sin meses cerrados no aporta al margen consolidado, y su gasto
 *     tampoco. Hoy Mayagüez tiene $16.666,66/mes de renta y cero facturado
 *     porque abre en octubre: meterla sin su ingreso hundiría el margen del
 *     grupo con un mes que no es comparable. Cuando Mayagüez cierre su primer
 *     mes, entra sola.
 *
 * Y una que NO va dentro: la renta de Mayagüez la pagan fondos de Cupey y se
 * contabiliza en Mayagüez, a petición de los socios, que quieren medir Cupey
 * limpio. Eso no se toca ni se compensa en el consolidado.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CUÁNDO ENCENDERLA
 *
 * Lo decide Andrés. El momento natural es cuando Mayagüez cierre su primer mes
 * —octubre-2026—, porque hasta entonces "el grupo" es Cupey y una sede que
 * todavía no factura: el consolidado sería Cupey con otro nombre.
 */
export const CONSOLIDADO_VISIBLE = false;
