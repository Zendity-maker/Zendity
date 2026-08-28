/**
 * Rutas que se abren SIN sesión. Fuente única.
 *
 * Existía la misma lista en dos sitios —AppLayout, para no envolverlas en el
 * marco de la app, y AuthContext, para no rebotarlas al login— y añadir una
 * ruta pública exigía acordarse de los dos.
 *
 * No me acordé. Al publicar /verificar arregle AppLayout y olvide AuthContext:
 * la pagina se renderizaba bien en el servidor y el navegador la echaba al
 * login un instante despues. Lo corregi. Al publicar /encuesta volvi a hacer
 * exactamente lo mismo.
 *
 * Dos veces el mismo error no es descuido, es que la lista estaba en el sitio
 * equivocado. Ahora vive aqui y ambos la importan.
 */
export const RUTAS_PUBLICAS = [
    '/login',
    /** Kiosko de servicios externos — opera con device-token, no con sesión. */
    '/external-kiosk',
    /** Registro de un familiar recién invitado: aún no tiene cuenta. */
    '/family/register',
    /** Verificación de certificados de Academy: quien comprueba viene de fuera. */
    '/verificar',
    /** Encuesta de servicio: llega por correo y se responde sin iniciar sesión. */
    '/encuesta',
] as const;

/** ¿Esta ruta se abre sin sesión? */
export function esRutaPublica(pathname: string): boolean {
    return RUTAS_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + '/'));
}
