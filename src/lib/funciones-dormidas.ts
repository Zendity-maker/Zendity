/**
 * Por qué un módulo de Zendity no tiene datos.
 *
 * Hay tres respuestas posibles y desde fuera se ven idénticas: un módulo vacío
 * porque está roto, uno vacío porque el hogar decidió no usarlo, y uno vacío
 * porque falta la tableta que llega el lunes. Este archivo distingue las dos
 * últimas para que nadie —ni una auditoría futura, ni un escáner, ni yo dentro
 * de tres meses— proponga retirar algo que solo estaba esperando.
 *
 * DORMIDAS: existen, funcionan, y están apagadas a propósito.
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

/**
 * ESPERANDO: no están apagadas ni rotas. Funcionan y siguen visibles — lo que
 * falta es la persona, el equipo o el hábito que las pone en marcha.
 *
 * La diferencia con una función dormida importa: una dormida se decidió no
 * usar; una que espera va a usarse en cuanto llegue lo que le falta. Retirar
 * una de estas sería tirar trabajo que está a días de servir.
 *
 * Cada entrada dice qué falta. Cuando llegue, se borra de aquí.
 */
export const FUNCIONES_ESPERANDO = {
    /**
     * Concierge — pedidos de las familias.
     *
     * Cero órdenes. No es abandono: se surte de lo que las familias pidan desde
     * su app, y todavía no han empezado. La cola está vacía porque nadie ha
     * pedido, no porque nadie la atienda.
     *
     * Se activa solo, en cuanto llegue el primer pedido.
     */
    concierge: 'Que las familias empiecen a pedir desde el portal familiar.',

    /**
     * Bitácora de Llamadas — registro de contactos con familias.
     *
     * Cero registros. Es del puesto de coordinación, que aún no está cubierto.
     */
    bitacoraDeLlamadas: 'Contratar a la persona de coordinación que la va a trabajar.',

    /**
     * Registro de Visitas — entrada y salida de visitantes.
     *
     * Cero visitas registradas. Funciona sobre una tableta en recepción que
     * todavía no está.
     */
    registroDeVisitas: 'La tableta de recepción. Prevista para la semana del 31-ago-2026.',

    /**
     * Servicios Externos — visitas de proveedores de fuera.
     *
     * El catálogo SÍ está cargado (19 proveedores en Cupey), pero cero visitas
     * registradas. Ese contraste es lo que delata que espera equipo y no
     * decisión: nadie carga 19 proveedores para no usarlos.
     *
     * Funciona sobre el kiosko externo, que va en tableta propia.
     */
    serviciosExternos: 'La tableta del kiosko externo. Prevista para la semana del 31-ago-2026.',
} as const;

export function estaEsperando(f: string): boolean {
    return f in FUNCIONES_ESPERANDO;
}

/**
 * Por qué este módulo no tiene datos, si es que hay una razón registrada.
 *
 * Pensada para que una auditoría pregunte antes de proponer retirar algo.
 * Devuelve null si el módulo no está ni dormido ni esperando — y entonces sí
 * vale la pena mirarlo.
 */
export function porQueSinDatos(f: string): { estado: 'dormida' | 'esperando'; motivo: string } | null {
    if (f in FUNCIONES_DORMIDAS) {
        return { estado: 'dormida', motivo: 'Apagada a propósito. Ver FUNCIONES_DORMIDAS.' };
    }
    if (f in FUNCIONES_ESPERANDO) {
        return { estado: 'esperando', motivo: (FUNCIONES_ESPERANDO as Record<string, string>)[f] };
    }
    return null;
}
