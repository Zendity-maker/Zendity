/**
 * ACCESO DE VISITAS DE UN RESIDENTE
 * ─────────────────────────────────
 * Caso que lo motivó: Óscar López solo puede recibir a personas de una lista
 * concreta. En un hogar de envejecientes esto pasa —órdenes de protección,
 * conflictos de familia, tutelas— y hasta sep-2026 el kiosco registraba a
 * cualquiera y lo mandaba para adentro.
 *
 * DOS LISTAS, NO UNA. La primera versión tenía solo la de autorizados más un
 * interruptor de modo estricto, y eso obliga a todo o nada: para dejar fuera a
 * UNA persona habría que listar a todas las demás. El caso común no es querer
 * una lista blanca, es querer mantener fuera a alguien en particular.
 *
 *   NO_AUTORIZADO  actúa SIEMPRE, con o sin estricto.
 *   AUTORIZADO     solo cuenta con `visitasRestringidas` en true.
 *   Sin estricto y sin lista negra, visita cualquiera — el caso de los 33
 *   residentes que no tienen ningún conflicto.
 *
 * TRES DECISIONES QUE IMPORTAN MÁS QUE EL CÓDIGO:
 *
 * 1. LA TABLET NO DICE QUE NO. Un "usted no está autorizado" en la pantalla es
 *    confrontar a alguien en el lobby y revelar delante de quien pase que ese
 *    residente tiene una restricción. Se pide esperar; quién entra lo decide
 *    una persona.
 *
 * 2. EL AVISO AL PERSONAL NO LLEVA VEREDICTO. "No autorizado" es un juicio que
 *    la tablet puede equivocar —un nombre escrito distinto, un yerno nuevo que
 *    nadie añadió— y quien camine hasta recepción llegaría con un prejuicio
 *    sobre una persona que puede estar perfectamente bien. El aviso dice que
 *    hay alguien esperando; el motivo vive en el perfil, que es donde mira
 *    quien lo maneja.
 *
 * 3. UN NOMBRE PARECIDO NO ES UN SÍ. El emparejamiento ayuda a decidir, no
 *    abre la puerta. Con modo estricto, toda visita queda en espera aunque el
 *    nombre coincida: lo que cambia es lo que se le cuenta al personal.
 */
import { prisma } from '@/lib/prisma';

export type MotivoRetencion = 'EN_LISTA_NEGRA' | 'ESTRICTO_SIN_COINCIDENCIA' | 'ESTRICTO_CON_COINCIDENCIA';

export interface AccesoVisita {
    /** false = la visita sigue su curso normal. */
    retener: boolean;
    motivo?: MotivoRetencion;
    /** Nombre de la entrada de la lista que coincidió, si coincidió. */
    coincidencia?: string;
    /** Por qué está en la lista. Solo para el personal, nunca para la tablet. */
    notaDeLista?: string | null;
    /** Por qué el residente está en modo estricto. */
    motivoRestriccion?: string | null;
}

export function normalizar(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** ¿El nombre escrito y el de la lista son plausiblemente la misma persona? */
export function nombresCoinciden(escrito: string, enLista: string): boolean {
    const a = normalizar(escrito);
    const b = normalizar(enLista);
    if (!a || !b) return false;
    if (a === b) return true;

    const pa = a.split(' ').filter(w => w.length > 2);
    const pb = b.split(' ').filter(w => w.length > 2);

    // Al menos DOS palabras del lado corto. Un nombre de pila suelto —"Ana"—
    // coincidiría con cualquier "Ana Maria Colon" de la lista, y le diría al
    // personal que esa persona está autorizada cuando puede ser otra Ana. No
    // dejaría entrar a nadie de más, pero sí haría más difícil decidir bien,
    // que es justo lo contrario de para lo que está esta función.
    if (Math.min(pa.length, pb.length) < 2) return false;

    const contieneTodas = (todas: string[], donde: string[]) => todas.every(w => donde.includes(w));
    return contieneTodas(pb, pa) || contieneTodas(pa, pb);
}

/**
 * @param soloListaNegra  El modo estricto NO se aplica.
 *
 * Se usa con los proveedores externos. Una orden de protección o un conflicto
 * de familia apunta a personas concretas, y esas quedan fuera vengan a lo que
 * vengan — por eso la lista negra sí corre. Pero aplicar el estricto dejaría
 * esperando a la enfermera de hospicio y a la terapista en cada visita, y el
 * modo estricto no se puso para eso: se puso para las visitas personales.
 */
export async function evaluarAcceso(
    hqId: string,
    patientId: string,
    nombreVisitante: string,
    soloListaNegra = false,
): Promise<AccesoVisita> {
    const paciente = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: hqId },
        select: { visitasRestringidas: true, visitasRestringidasMotivo: true },
    });
    if (!paciente) return { retener: false };

    const lista = await prisma.visitanteAutorizado.findMany({
        where: { patientId, activo: true, revocadoAt: null },
        select: { nombre: true, tipo: true, notas: true },
    });

    // La lista negra PRIMERO y siempre. Si alguien apareciera en las dos por
    // error, manda la negativa: equivocarse reteniendo se arregla en un minuto
    // con una persona; equivocarse dejando pasar, no.
    const vetado = lista.find(v => v.tipo === 'NO_AUTORIZADO' && nombresCoinciden(nombreVisitante, v.nombre));
    if (vetado) {
        return {
            retener: true,
            motivo: 'EN_LISTA_NEGRA',
            coincidencia: vetado.nombre,
            notaDeLista: vetado.notas,
            motivoRestriccion: paciente.visitasRestringidasMotivo,
        };
    }

    if (soloListaNegra || !paciente.visitasRestringidas) return { retener: false };

    const autorizado = lista.find(v => v.tipo === 'AUTORIZADO' && nombresCoinciden(nombreVisitante, v.nombre));
    return {
        retener: true,
        motivo: autorizado ? 'ESTRICTO_CON_COINCIDENCIA' : 'ESTRICTO_SIN_COINCIDENCIA',
        coincidencia: autorizado?.nombre,
        notaDeLista: autorizado?.notas,
        motivoRestriccion: paciente.visitasRestringidasMotivo,
    };
}

/** Lo que ve el personal en el aviso. Sin veredictos. */
export function resumenParaPersonal(a: AccesoVisita, visitante: string): string {
    switch (a.motivo) {
        case 'EN_LISTA_NEGRA':
            return `${visitante} aparece en la lista de acceso restringido de este residente.`;
        case 'ESTRICTO_CON_COINCIDENCIA':
            return `${visitante} parece corresponder a "${a.coincidencia}" en la lista de autorizados. Confirme antes de dar paso.`;
        case 'ESTRICTO_SIN_COINCIDENCIA':
            return `${visitante} no aparece en la lista de autorizados de este residente.`;
        default:
            return `${visitante} está esperando en recepción.`;
    }
}
