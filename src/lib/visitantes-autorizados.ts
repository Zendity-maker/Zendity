/**
 * LISTA DE VISITANTES AUTORIZADOS
 * ───────────────────────────────
 * Caso que lo motivó: Óscar López solo puede recibir a personas de una lista
 * concreta. En un hogar de envejecientes esto pasa —órdenes de protección,
 * conflictos de familia, tutelas— y hasta sep-2026 el kiosco registraba a
 * cualquiera y lo mandaba para adentro.
 *
 * DOS DECISIONES QUE IMPORTAN MÁS QUE EL CÓDIGO:
 *
 * 1. LA TABLET NO DICE QUE NO. Un "usted no está autorizado" en la pantalla es
 *    confrontar a alguien en el lobby y revelar delante de quien pase que ese
 *    residente tiene una restricción. El kiosco pide esperar y avisa al
 *    personal; quién entra lo decide una persona.
 *
 * 2. UN NOMBRE PARECIDO NO ES UN SÍ. El emparejamiento sirve para AYUDAR a
 *    quien atiende —"esta persona parece estar en la lista"— no para abrir la
 *    puerta. Por eso `resultado` distingue COINCIDE de NO_COINCIDE y en los dos
 *    casos la visita a un residente restringido queda en espera: la diferencia
 *    es lo que se le dice al personal, no lo que se le permite al visitante.
 *
 * El emparejamiento normaliza acentos y mayúsculas porque nadie escribe
 * "Nydia L. Ortiz Santiago" igual dos veces, y compara por palabras: basta que
 * el nombre escrito contenga todas las palabras de largo>2 de un autorizado, o
 * al revés. Es generoso a propósito — un falso positivo aquí solo hace que el
 * personal reciba un aviso más tranquilo, no que alguien entre.
 */
import { prisma } from '@/lib/prisma';

export type ResultadoLista = 'SIN_RESTRICCION' | 'COINCIDE' | 'NO_COINCIDE';

export interface ChequeoVisitante {
    resultado: ResultadoLista;
    /** true cuando hay que retener al visitante y avisar al personal. */
    requiereAprobacion: boolean;
    /** Nombre del autorizado con el que coincidió, si coincidió. */
    coincidencia?: string;
    motivo?: string | null;
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
    // dejaría entrar a nadie de más (la aprobación se pide igual), pero sí
    // haría más difícil decidir bien, que es justo lo contrario de para lo que
    // está esta función.
    if (Math.min(pa.length, pb.length) < 2) return false;

    const contieneTodas = (todas: string[], donde: string[]) => todas.every(w => donde.includes(w));
    return contieneTodas(pb, pa) || contieneTodas(pa, pb);
}

export async function chequearVisitante(
    hqId: string,
    patientId: string,
    nombreVisitante: string,
): Promise<ChequeoVisitante> {
    const paciente = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: hqId },
        select: { visitasRestringidas: true, visitasRestringidasMotivo: true },
    });

    if (!paciente?.visitasRestringidas) {
        return { resultado: 'SIN_RESTRICCION', requiereAprobacion: false };
    }

    const lista = await prisma.visitanteAutorizado.findMany({
        where: { patientId, activo: true, revocadoAt: null },
        select: { nombre: true },
    });

    const hit = lista.find(v => nombresCoinciden(nombreVisitante, v.nombre));

    // Ojo: `requiereAprobacion` es true en los DOS casos. Un residente con
    // visitas restringidas no recibe a nadie sin que una persona lo mire, esté
    // o no en la lista. Lo que cambia es el aviso que recibe el personal.
    return hit
        ? { resultado: 'COINCIDE', requiereAprobacion: true, coincidencia: hit.nombre, motivo: paciente.visitasRestringidasMotivo }
        : { resultado: 'NO_COINCIDE', requiereAprobacion: true, motivo: paciente.visitasRestringidasMotivo };
}
