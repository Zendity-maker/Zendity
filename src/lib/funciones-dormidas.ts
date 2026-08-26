/**
 * Funciones que existen, funcionan, y están apagadas a propósito.
 *
 * No es lo mismo una función rota que una que el hogar decidió no usar todavía.
 * Borrarla pierde el trabajo; dejarla visible sin que nadie la use enseña a
 * ignorar la pantalla. Dormirla es la tercera opción: el código y los datos
 * quedan intactos, el punto de entrada desaparece, y despertarla es cambiar
 * false por true aquí.
 *
 * Cada entrada lleva por qué se durmió y qué haría falta para volver.
 */

export const FUNCIONES_DORMIDAS = {
    /**
     * Rondas de inspección por zona — supervisión.
     *
     * El supervisor recorre por piso y zona en tres momentos del turno con una
     * lista de limpieza, seguridad, residentes y equipo.
     *
     * Dormida el 24-ago-2026 por decisión de Andrés: "se probó, pero no se han
     * impuesto hacerlo". 75 registros en total, ninguno desde el 24 de julio.
     * No está rota — nunca se volvió costumbre.
     *
     * Para despertarla: poner `rondasDeInspeccion: true`. La pantalla, el
     * endpoint y los 75 registros siguen donde estaban.
     */
    rondasDeInspeccion: false,

    /**
     * CRM y Ventas — captación y seguimiento de prospectos.
     *
     * Dormida el 26-ago-2026 por decisión de Andrés: "no se está usando,
     * podemos dormirlo". CERO leads registrados desde que existe el sistema.
     * No se probó y se abandonó: nunca se empezó.
     *
     * Para despertarla: `crm: true`. La pantalla, los endpoints y el webhook
     * de VAPI siguen donde están.
     */
    crm: false,

    /**
     * Documentos Legales — repositorio de contratos y documentación del hogar.
     *
     * Dormida el 26-ago-2026 por decisión de Andrés. CERO documentos cargados.
     *
     * Para despertarla: `documentosLegales: true`.
     */
    documentosLegales: false,
} as const;

export function estaDormida(f: keyof typeof FUNCIONES_DORMIDAS): boolean {
    return FUNCIONES_DORMIDAS[f] === false;
}
