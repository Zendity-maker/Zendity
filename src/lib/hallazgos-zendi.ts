/**
 * ZENDI LEYENDO
 * ─────────────
 * Lee el texto libre de la semana y devuelve lo que NO tiene dónde guardarse,
 * lo que CONTRADICE al expediente, y lo que DEBIÓ escalar y no escaló.
 *
 * POR QUÉ ESTO Y NO MÁS PROSA. La IA de Zéndity escribía y no leía: 2 445
 * mensajes generados para familias, 583 rechazados por una persona antes de
 * salir. Uno de cada cuatro no era publicable. Mientras tanto, todo lo que se
 * encontró en sep-2026 —los cuatro campos que faltaban, el PRN que no se
 * registraba, el Warfarin invisible, la dieta que no cuadra— salió de LEER
 * texto libre y compararlo con los campos. A mano, con consultas.
 *
 * `verificaciones.ts` hace eso mismo con once reglas escritas una a una, y cada
 * una existe porque alguien se tropezó primero. La doce necesita otro tropiezo.
 * Esto es lo que no escala, y es exactamente donde un modelo de lenguaje sirve.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * LAS CUATRO REGLAS QUE HACEN ESTO SEGURO
 *
 * 1. UN HALLAZGO NO ES UN HECHO. No cambia un expediente, no avisa a una
 *    familia, no mueve un estado. Es una pregunta esperando un sí o un no.
 *
 * 2. LA EVIDENCIA VA TEXTUAL. La frase exacta, copiada sin reformular. Es lo
 *    que permite comprobar sin fiarse del modelo: se lee la frase y se decide.
 *    Un hallazgo cuya evidencia no aparece LITERALMENTE en el texto original se
 *    descarta antes de guardarse — ver `verificarEvidencia`. Eso convierte la
 *    alucinación más común (inventar la cita) en un hallazgo que no llega.
 *
 * 3. NO SE LE PIDE QUE DIAGNOSTIQUE. Se le pide que note dónde el sistema se
 *    queda corto. "Esta señora tiene una infección" no es un hallazgo válido;
 *    "esto describe un síntoma y no hay campo donde registrarlo" sí.
 *
 * 4. NO SE REPITE. Cada hallazgo lleva la huella de su evidencia, y hay unique
 *    por sede. Zendi relee las mismas notas cada semana; sin esto la lista
 *    dejaría de servir en un mes.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { AREAS_DE_CAMBIO } from '@/lib/cambios-de-condicion';

export const TIPOS = ['SIN_CAMPO', 'CONTRADICCION', 'ALERTA_NO_ESCALADA'] as const;
export type TipoHallazgo = typeof TIPOS[number];

export const ETIQUETA_TIPO: Record<TipoHallazgo, string> = {
    SIN_CAMPO: 'No tiene dónde guardarse',
    CONTRADICCION: 'Contradice al expediente',
    ALERTA_NO_ESCALADA: 'Debió avisar y no avisó',
};

export const ETIQUETA_TIPO_LARGA: Record<TipoHallazgo, string> = {
    SIN_CAMPO: 'Alguien escribió a mano algo que el sistema debería poder guardar en un campo.',
    CONTRADICCION: 'Lo que dice el texto no coincide con lo que dice el expediente.',
    ALERTA_NO_ESCALADA: 'La nota describe algo que debió generar un aviso y no lo generó.',
};

export interface HallazgoPropuesto {
    tipo: TipoHallazgo;
    resumen: string;
    evidencia: string;
    sugerencia?: string;
    /** Índice del texto de entrada del que salió. El modelo no inventa ids. */
    origen: number;
}

/** Un trozo de texto libre para leer, con de dónde vino. */
export interface TextoParaLeer {
    /** "DailyLog:<id>", "LifePlan:<id>" — para poder ir a la fuente. */
    fuente: string;
    patientId: string | null;
    /** Contexto estructurado, para poder detectar contradicciones. */
    contexto: string;
    texto: string;
}

/** Cuánto texto se le manda de una vez. Más que esto y empieza a resumir. */
export const TEXTOS_POR_TANDA = 25;

export function huellaDe(evidencia: string): string {
    return createHash('sha256')
        .update(evidencia.toLowerCase().replace(/\s+/g, ' ').trim())
        .digest('hex')
        .slice(0, 32);
}

/**
 * LA GUARDA CONTRA LA CITA INVENTADA.
 *
 * El fallo más común de un modelo al que se le pide "cita la frase exacta" es
 * devolver una cita plausible que no está en el texto. Aquí eso no es un
 * hallazgo débil: es un hallazgo que no se guarda.
 *
 * Se compara normalizando espacios y mayúsculas, y nada más. No se acepta
 * "parecido": la evidencia tiene que estar.
 */
export function verificarEvidencia(evidencia: string, textoOriginal: string): boolean {
    const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
    const e = norm(evidencia);
    if (e.length < 15) return false; // una cita de tres palabras no prueba nada
    return norm(textoOriginal).includes(e);
}

export function construirPrompt(textos: TextoParaLeer[]): string {
    const bloques = textos
        .map((t, i) => `--- TEXTO ${i}\nCONTEXTO DEL EXPEDIENTE: ${t.contexto}\nTEXTO: ${t.texto}`)
        .join('\n\n');

    return `Eres un auditor de sistemas de un hogar de ancianos en Puerto Rico. NO eres clínico y NO diagnosticas.

Tu único trabajo es leer lo que el personal escribió a mano y detectar TRES cosas:

1. SIN_CAMPO — el texto contiene información concreta y accionable que un sistema
   debería guardar en un campo, y que ahí queda perdida. Ejemplos de lo que SÍ es:
   una preferencia de comida ("solo acepta avena"), el efecto de un medicamento
   ("se administró y no hizo efecto"), una instrucción dada a un familiar, un
   cambio de movilidad. Lo que NO es: una descripción normal del turno.

2. CONTRADICCION — lo que dice el texto no coincide con el CONTEXTO DEL
   EXPEDIENTE que te doy. Ejemplo: el contexto dice que el residente se alimenta
   por sonda y el texto habla de que comió; el contexto dice movilidad
   independiente y el texto dice que no se levanta.

3. ALERTA_NO_ESCALADA — el texto describe algo que en un hogar debería haber
   generado un aviso: una caída, un traslado, una lesión de piel nueva, un
   deterioro marcado. Solo si el texto lo dice; no lo infieras.

REGLAS ABSOLUTAS:

- La "evidencia" tiene que ser la FRASE EXACTA copiada del TEXTO, carácter por
  carácter. No la reformules, no la resumas, no la traduzcas. Si no puedes citar
  textualmente, NO reportes ese hallazgo.
- No diagnostiques. No digas qué le pasa al residente. Di qué le falta al sistema.
- No reportes nada de lo que no estés seguro. Una lista corta y cierta vale más
  que una larga y dudosa: cada hallazgo le cuesta tiempo a una enfermera.
- Si un texto no tiene nada que reportar, no reportes nada de ese texto. Es lo
  normal y es la respuesta correcta la mayoría de las veces.
- Responde en español de Puerto Rico, natural y directo.

Devuelve JSON con esta forma exacta:
{"hallazgos":[{"origen":0,"tipo":"SIN_CAMPO","resumen":"una línea","evidencia":"la frase exacta del texto","sugerencia":"qué haría falta"}]}

Si no hay nada que reportar: {"hallazgos":[]}

${bloques}`;
}

/**
 * Filtra lo que el modelo devolvió: tipo válido, origen que existe, y la
 * evidencia REALMENTE presente en el texto del que dice venir.
 */
export function filtrarPropuestas(
    crudas: unknown,
    textos: TextoParaLeer[],
): { validos: HallazgoPropuesto[]; descartados: { razon: string; resumen: string }[] } {
    const validos: HallazgoPropuesto[] = [];
    const descartados: { razon: string; resumen: string }[] = [];

    const lista = (crudas as { hallazgos?: unknown[] })?.hallazgos;
    if (!Array.isArray(lista)) return { validos, descartados };

    for (const h of lista) {
        const o = h as Record<string, unknown>;
        const resumen = String(o.resumen ?? '').trim();
        const tipo = String(o.tipo ?? '').trim() as TipoHallazgo;
        const evidencia = String(o.evidencia ?? '').trim();
        const origen = Number(o.origen);

        if (!resumen || !evidencia) { descartados.push({ razon: 'incompleto', resumen }); continue; }
        if (!TIPOS.includes(tipo)) { descartados.push({ razon: `tipo inválido: ${tipo}`, resumen }); continue; }
        if (!Number.isInteger(origen) || origen < 0 || origen >= textos.length) {
            descartados.push({ razon: 'origen inexistente', resumen }); continue;
        }
        // La guarda que importa.
        if (!verificarEvidencia(evidencia, textos[origen].texto)) {
            descartados.push({ razon: 'la cita no aparece en el texto', resumen }); continue;
        }

        validos.push({
            tipo, resumen: resumen.slice(0, 400), evidencia: evidencia.slice(0, 1000),
            sugerencia: String(o.sugerencia ?? '').trim().slice(0, 400) || undefined,
            origen,
        });
    }
    return { validos, descartados };
}

/**
 * Guarda lo que sobrevivió. El unique por (sede, huella) hace el resto: si la
 * misma frase ya generó un hallazgo, este no se duplica.
 */
export async function guardarHallazgos(
    hqId: string,
    propuestos: HallazgoPropuesto[],
    textos: TextoParaLeer[],
): Promise<{ nuevos: number; repetidos: number }> {
    let nuevos = 0, repetidos = 0;
    for (const p of propuestos) {
        const t = textos[p.origen];
        try {
            await prisma.hallazgoZendi.create({
                data: {
                    headquartersId: hqId,
                    tipo: p.tipo,
                    patientId: t.patientId,
                    resumen: p.resumen,
                    evidencia: p.evidencia,
                    sugerencia: p.sugerencia ?? null,
                    fuente: t.fuente,
                    huella: huellaDe(p.evidencia),
                },
            });
            nuevos++;
        } catch {
            // Choque con el unique: esta frase ya se reportó. Es lo esperado.
            repetidos++;
        }
    }
    return { nuevos, repetidos };
}

/** Quién puede cerrar un hallazgo. El mismo criterio que revisar un cambio del piso. */
export const PUEDEN_RESOLVER = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/* ════════════════ QUÉ SE DECIDE SOBRE UN HALLAZGO ════════════════════════ */

/**
 * TRES SALIDAS, NO DOS — Y LA PREGUNTA ERA LA QUE ESTABA MAL.
 *
 * Había "¿es real?" con sí/no. Esa pregunta asume que cada hallazgo es una
 * propuesta de producto que hay que aprobar o rechazar. Medido el 08-sep-2026
 * sobre los 36 hallazgos de tipo SIN_CAMPO: 27 piden un campo QUE YA EXISTE.
 * Seis pedían "un campo para registrar caídas" —hay módulo de caídas y su
 * botón— y seis "un campo para lesiones de piel" —hay Alerta Piel/UPP—.
 *
 * Ante uno de esos, "¿es real?" no tiene buena respuesta: sí es real, la nota
 * existe, pero no hay nada que construir. Por eso quien revisaba no sabía qué
 * escribir al descartar. La pregunta estaba mal hecha.
 *
 * Y AL HABER TRES, LA RAZÓN OBLIGATORIA SOBRA. Con dos botones, "descartado"
 * no decía nada y por eso se exigía una explicación. Ahora el botón que se
 * escoge ES la razón.
 *
 * Los códigos CONFIRMADO y DESCARTADO se conservan aunque la etiqueta cambie:
 * ya hay filas con ellos y renombrarlos rompería el historial por cosmética.
 */
export interface SalidaHallazgo {
    codigo: string;
    etiqueta: string;
    ayuda: string;
    /** Pide decir DÓNDE se documenta. Solo YA_EXISTE. */
    pideDestino?: boolean;
}

export const SALIDAS: SalidaHallazgo[] = [
    {
        codigo: 'YA_EXISTE',
        etiqueta: 'Ya se puede documentar',
        ayuda: 'El sitio existe. Se le avisa a quien escribió la nota dónde va, con sus propias palabras.',
        pideDestino: true,
    },
    {
        codigo: 'CONFIRMADO',
        etiqueta: 'Sí, para evaluar',
        ayuda: 'El hueco es real. Pasa a la lista de dirección, en el reporte de los lunes.',
    },
    {
        codigo: 'DESCARTADO',
        etiqueta: 'No hace falta',
        ayuda: 'Ni existe ni merece construirse. Se cierra.',
    },
];

/**
 * Estados terminales, cada uno cierra su camino:
 *   CONFIRMADO -> CONSTRUIDO   dirección tapó el hueco
 *   YA_EXISTE  -> AVISADO      el resumen semanal ya salió
 */
export const CONSTRUIDO = 'CONSTRUIDO';
export const AVISADO = 'AVISADO';

/**
 * DÓNDE SE DOCUMENTA — lo dice la persona que revisa, no un mapa.
 *
 * Un mapa automático entre "lo que Zendi sugiere" y "el botón que existe"
 * tendría que mantenerse cada vez que se construye algo, y a los tres meses
 * mentiría. Quien revisa sabe dónde va cada cosa y decirlo es un clic; ese
 * conocimiento no se desactualiza.
 *
 * Se guarda el TEXTO, no un código: es lo que va a leer la cuidadora, y si
 * mañana cambia esta lista, las filas viejas siguen diciendo algo cierto.
 */
export const DESTINOS: string[] = [
    'El botón de Caída, en la tableta',
    'Alerta Piel / UPP, en la tableta',
    'Vitales — presión, pulso, temperatura, saturación',
    'eMAR — motivo al omitir un medicamento',
    'Registro nutricional — motivo del rechazo',
    'Traslado a emergencias',
    ...AREAS_DE_CAMBIO.map(a => `"Algo cambió en el residente" → ${a.etiqueta}`),
];
