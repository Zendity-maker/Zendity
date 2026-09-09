/**
 * A QUIÉN LE HABLA UN AVISO AL PERSONAL.
 *
 * Hasta el 09-sep-2026, la difusión de /hr/staff no distinguía: mandaba a
 * TODOS los usuarios activos de la sede. En Cupey eso son 20 correos, e
 * incluyen a CG —el inversionista— y a la cuenta de Zendity Admin.
 *
 * El caso que lo destapó: un aviso al piso sobre el botón de la tarjeta del
 * residente. Le habría llegado a cocina, a mantenimiento, a las dos
 * trabajadoras sociales y al inversionista. Un memo interno en el correo de un
 * inversionista está mal, y además le quita fuerza al mensaje: si le llega a
 * todo el mundo, no es para nadie — y la próxima vez nadie lo abre.
 *
 * DOS DECISIONES QUE NO SON COSMÉTICAS:
 *
 * 1. "Todo el personal" ya NO incluye INVESTOR ni SUPER_ADMIN. No son personal
 *    del hogar: uno es socio y la otra es una cuenta de plataforma. Que
 *    estuvieran dentro de "todo el personal" era un fallo, no una opción.
 *
 * 2. La pantalla enseña los nombres antes de mandar. Un contador dice "20";
 *    una lista dice quién. La diferencia es la que hace que alguien note que
 *    ahí sobra un nombre.
 */

export type Audiencia = 'TODOS' | 'PISO' | 'CUIDADORAS' | 'CLINICO' | 'SERVICIOS';

export interface DefinicionAudiencia {
    etiqueta: string;
    explicacion: string;
    roles: string[];
    /**
     * Mirar SOLO el rol primario, ignorando los secundarios.
     *
     * Existe por un caso concreto: las dos supervisoras de Cupey tienen
     * CAREGIVER como rol secundario (para poder despachar en piso). Con la
     * regla normal, "solo cuidadoras" las incluía a ellas — y esa audiencia
     * existe justamente para lo contrario: un mensaje de supervisión HACIA las
     * cuidadoras, del que la supervisión no es destinataria.
     *
     * Para "el piso" la regla normal es la correcta y no lleva esta bandera:
     * ahí Celia —DIRECTOR con NURSE secundario— sí tiene que estar.
     */
    soloPrimario?: boolean;
}

/** Quien atiende residentes en el turno. */
const PISO = ['CAREGIVER', 'SUPERVISOR', 'NURSE'];
/** Quien decide sobre el cuidado. */
const CLINICO = ['NURSE', 'DIRECTOR', 'CLINICAL_DIRECTOR', 'ADMIN', 'SOCIAL_WORKER', 'THERAPIST'];
/** Quien sostiene la casa. */
const SERVICIOS = ['KITCHEN', 'MAINTENANCE', 'CLEANING', 'BEAUTY_SPECIALIST'];
/** Personal del hogar. Ni el socio ni la cuenta de plataforma lo son. */
const NO_SON_PERSONAL = ['INVESTOR', 'SUPER_ADMIN'];

export const AUDIENCIAS: Record<Audiencia, DefinicionAudiencia> = {
    TODOS: {
        etiqueta: 'Todo el personal',
        explicacion: 'Piso, clínico, servicios y administración. No incluye socios ni cuentas de plataforma.',
        roles: [],   // vacío = todos menos NO_SON_PERSONAL
    },
    PISO: {
        etiqueta: 'El piso',
        explicacion: 'Cuidadoras, supervisión y enfermería — quien está con los residentes en el turno.',
        roles: PISO,
    },
    CUIDADORAS: {
        etiqueta: 'Solo cuidadoras',
        explicacion: 'Sin supervisión. Para cuando el mensaje es de supervisión hacia ellas.',
        roles: ['CAREGIVER'],
        soloPrimario: true,
    },
    CLINICO: {
        etiqueta: 'Clínico y dirección',
        explicacion: 'Enfermería, dirección, trabajo social y terapia.',
        roles: CLINICO,
    },
    SERVICIOS: {
        etiqueta: 'Servicios',
        explicacion: 'Cocina, mantenimiento, limpieza y salón.',
        roles: SERVICIOS,
    },
};

/**
 * ¿Este usuario recibe el aviso?
 *
 * Se mira el rol primario Y los secundarios: en este hogar la enfermería la
 * hace una DIRECTOR con NURSE secundario, y una supervisora puede tener
 * CAREGIVER secundario. Filtrar solo por el primario deja fuera justo a quien
 * hace el trabajo del que habla el aviso.
 */
export function recibeElAviso(
    audiencia: Audiencia,
    rol: string,
    rolesSecundarios: string[] = [],
): boolean {
    if (NO_SON_PERSONAL.includes(rol)) return false;
    const def = AUDIENCIAS[audiencia];
    if (!def || def.roles.length === 0) return true;      // TODOS
    if (def.soloPrimario) return def.roles.includes(rol);
    return [rol, ...rolesSecundarios].some(r => def.roles.includes(r));
}

export const ES_AUDIENCIA = (v: unknown): v is Audiencia =>
    typeof v === 'string' && v in AUDIENCIAS;
