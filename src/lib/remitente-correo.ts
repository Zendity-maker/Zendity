/**
 * QUIÉN FIRMA CADA CORREO QUE SALE DE ZÉNDITY.
 *
 * Hasta el 14-sep-2026 todos llegaban igual. Los tres resúmenes del lunes
 * —enfermería, supervisión y dirección— salían con `from: <dirección>` a secas,
 * sin nombre de remitente: tres correos distintos, la misma cara en la bandeja.
 * Y donde sí había nombre era el del hogar, así que una amonestación
 * disciplinaria y una circular general llegaban las dos como "Vivid Senior
 * Living Cupey".
 *
 * El empleado no podía saber, sin abrir, si lo que le llega es de su expediente
 * o es una circular — ni a quién contestarle.
 *
 * A partir de aquí el NOMBRE del remitente dice el área y el asunto lo
 * confirma. En la bandeja se lee de un vistazo quién escribe.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EL CORREO DE SALIDA ES UNO SOLO, A PROPÓSITO
 *
 * Todas las áreas comparten `SENDGRID_FROM_EMAIL` porque es la única dirección
 * verificada en SendGrid: inventar `rrhh@…` sin verificarlo deja el correo
 * saliendo y sin llegar. Lo que cambia es el NOMBRE, que es lo que la persona
 * lee. Cuando haya un dominio propio verificado, cada área puede tener su
 * buzón y este módulo es el único sitio que hay que tocar.
 *
 * Y no hay valor de reserva escrito a mano. El antipatrón 4 de CLAUDE.md dice
 * que el remitente sale SIEMPRE de la variable de entorno; un fallback como
 * 'notificaciones@zendity.com' —hoy repetido en 23 archivos— es un buzón que
 * puede no estar verificado, y entonces el envío falla justo el día que falta
 * la variable. Aquí, si no hay variable, `remitenteDe()` devuelve null y quien
 * llama tiene que decidir qué hacer sabiéndolo.
 */

/** Las áreas que le escriben a alguien. */
export type AreaQueEscribe =
    | 'RRHH'
    | 'DIRECCION'
    | 'ENFERMERIA'
    | 'SUPERVISION'
    /** El hogar hablándole a una familia. No es un área interna. */
    | 'HOGAR';

const NOMBRE_DE_AREA: Record<AreaQueEscribe, string> = {
    RRHH: 'Recursos Humanos',
    DIRECCION: 'Dirección',
    ENFERMERIA: 'Enfermería',
    SUPERVISION: 'Supervisión',
    HOGAR: '',
};

/** La etiqueta que abre el asunto. Vacía para el hogar: a una familia no se le habla por departamentos. */
const ETIQUETA_DE_AREA: Record<AreaQueEscribe, string> = {
    RRHH: '[RRHH]',
    DIRECCION: '[Dirección]',
    ENFERMERIA: '[Enfermería]',
    SUPERVISION: '[Supervisión]',
    HOGAR: '',
};

export interface Remitente {
    email: string;
    name: string;
}

/**
 * El remitente de un área, con el nombre de la sede detrás.
 *
 * Devuelve null si no hay `SENDGRID_FROM_EMAIL`. No inventa una dirección:
 * mandar desde un buzón sin verificar es peor que no mandar, porque el fallo
 * ocurre en el servidor de destino y aquí parece que salió bien.
 */
export function remitenteDe(area: AreaQueEscribe, nombreSede: string): Remitente | null {
    const email = process.env.SENDGRID_FROM_EMAIL;
    if (!email) return null;

    const areaTexto = NOMBRE_DE_AREA[area];
    // "Recursos Humanos · Vivid Senior Living Cupey" — el área primero, que es
    // lo que se lee truncado en la bandeja del móvil.
    const name = areaTexto ? `${areaTexto} · ${nombreSede}` : nombreSede;
    return { email, name };
}

/**
 * El asunto con su etiqueta delante, sin duplicarla si ya está.
 *
 * La etiqueta va en el asunto ADEMÁS del nombre del remitente porque los dos se
 * pierden en sitios distintos: el nombre no se ve en algunos clientes al
 * responder o al reenviar, y el asunto sobrevive a las dos cosas.
 */
export function asuntoDe(area: AreaQueEscribe, asunto: string): string {
    const etiqueta = ETIQUETA_DE_AREA[area];
    if (!etiqueta) return asunto;
    if (asunto.startsWith(etiqueta)) return asunto;
    return `${etiqueta} ${asunto}`;
}

/**
 * A dónde va la respuesta.
 *
 * Ningún correo lo ponía, así que contestar a una observación disciplinaria
 * mandaba la respuesta al buzón general en vez de a quien la emitió. Se pasa el
 * correo de la persona real cuando la hay; si no, se omite y la respuesta cae
 * en el buzón de siempre, que es el comportamiento de hoy.
 */
export function responderA(email: string | null | undefined): { replyTo: string } | Record<string, never> {
    return email && email.includes('@') ? { replyTo: email } : {};
}
