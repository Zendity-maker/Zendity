/**
 * QUIÉN ABRE UN TURNO EN EL PISO. UNA SOLA DEFINICIÓN.
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * Esta lista estaba escrita dos veces, y las dos copias decidían lo mismo
 * desde lados opuestos:
 *
 *     src/app/api/care/shift/start/route.ts   CAREGIVER_ROLES = ['CAREGIVER','NURSE']
 *     src/app/care/page.tsx                   CLINICAL_ROLES  = ['CAREGIVER','NURSE']
 *
 * Una decide si el servidor acepta; la otra, lo que la pantalla enseña. El día
 * que se añada un rol a una y no a la otra, el resultado no es un error: es una
 * pantalla que invita a hacer algo que el servidor va a negar, o al revés, una
 * persona con permiso a la que la pantalla no le enseña el camino.
 *
 * ═══ POR QUÉ MIRA TAMBIÉN LOS SECUNDARIOS ═══
 *
 * En este hogar el rol primario no dice quién hace el trabajo. La enfermería la
 * hace Celia, que es DIRECTOR con NURSE de secundario; Zuleyka era SUPERVISOR
 * con CAREGIVER. Gatear solo por el primario no alcanza a nadie.
 */

/** Los roles que de verdad abren turno y firman en el piso. */
export const ROLES_DE_PISO = ['CAREGIVER', 'NURSE'] as const;

/** ¿Esta persona abre turno? Cuenta el rol primario Y los secundarios. */
export function puedeAbrirTurno(
    rol: string | null | undefined,
    secundarios: readonly string[] | null | undefined,
): boolean {
    const lista = ROLES_DE_PISO as readonly string[];
    if (rol && lista.includes(rol)) return true;
    return (secundarios ?? []).some(r => lista.includes(r));
}

/**
 * QUIÉN PUEDE VER LA PANTALLA DEL PISO — y por tanto la cara de un residente.
 *
 * Vivía dentro de /api/care/route.ts. Se muda aquí porque desde hoy la usa
 * también /api/care/foto/[patientId]: si las dos listas se separan, una ruta
 * enseña la foto de un residente a quien la otra no deja ver su nombre.
 */
export const QUIEN_VE_EL_PISO = [
    // El piso. /api/care ES su tableta: eligen color, firman dosis y registran
    // el cambio de apósito sobre esa misma respuesta.
    'CAREGIVER', 'NURSE', 'SUPERVISOR',
    // Responden por el cuidado y aterrizan en "/", que pide esa ruta con
    // ?color=ALL para el widget de estado de residentes.
    'DIRECTOR', 'ADMIN', 'CLINICAL_DIRECTOR', 'HQ_OWNER', 'SUPER_ADMIN',
    // Trabajo social: dos cuentas activas, con contacto directo con el
    // residente, y AuthContext no las rebota de "/".
    'SOCIAL_WORKER',
];
