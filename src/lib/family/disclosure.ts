/**
 * src/lib/family/disclosure.ts
 *
 * Fuente única de verdad para la divulgación de data clínica hacia la familia.
 *
 * Principio rector:
 *   LIFESTYLE (default) — la familia NUNCA ve números clínicos (vitales)
 *                          ni lista de medicamentos. Solo bandas cualitativas
 *                          y narrativa cálida.
 *   FULL (consentido)   — la familia ve la vista clínica completa.
 *
 * El filtrado es responsabilidad de la CAPA DE DATA (servidor), nunca del
 * prompt de IA ni del cliente. Lo clínico no debe siquiera salir del backend
 * cuando shareLevel = LIFESTYLE.
 *
 * USO TÍPICO:
 *   import { resolveShareLevel, sanitizeClinical, isCleanNote } from '@/lib/family/disclosure';
 *
 *   const level = resolveShareLevel(patient);
 *   const safe = sanitizeClinical(patient, level);
 *   const cleanNotes = patient.wellnessNotes.filter(n => isCleanNote(n.note));
 */

export type ShareLevel = 'LIFESTYLE' | 'FULL';

/**
 * Devuelve el shareLevel efectivo a partir del campo del Patient.
 * Cualquier valor distinto de "FULL" se interpreta como LIFESTYLE (default seguro).
 */
export function resolveShareLevel(patient: { familyShareLevel?: string | null } | null | undefined): ShareLevel {
    if (!patient) return 'LIFESTYLE';
    return patient.familyShareLevel === 'FULL' ? 'FULL' : 'LIFESTYLE';
}

/**
 * Elimina campos clínicos del resident según shareLevel.
 *
 * LIFESTYLE: descarta vitalSigns y medications. Retorna el objeto sin esos campos
 *            (vitalSigns queda como [] explícito para evitar undefined en el cliente).
 * FULL:      devuelve el resident sin modificar.
 */
export function sanitizeClinical<T extends Record<string, any>>(
    resident: T,
    level: ShareLevel,
): T {
    if (level === 'FULL') return resident;
    // LIFESTYLE — strip clinical fields. Mantenemos vitalSigns: [] explícito
    // para que el cliente no rompa con undefined si hace .map() o .[0]?.x.
    const { medications: _meds, ...rest } = resident as any;
    void _meds;
    return { ...rest, vitalSigns: [] } as T;
}

/**
 * ¿Esta nota puede llegar a la familia?
 *
 * ═══ ESTO ERA UNA LISTA NEGRA Y DEJABA PASAR LO PEOR ═══
 *
 * Bloqueaba tres prefijos: "[ALERTA", "[alerta" y "[ACCIÓN PREVENTIVA". Todo
 * lo demás pasaba. Medido en producción el 05-sep-2026: 39 notas de
 * `[TRASLADO HOSPITALARIO DE EMERGENCIA]` pasaban el filtro, y 23 de ellas
 * eran de residentes con familia en el portal. Entre ellas:
 *
 *     "[TRASLADO HOSPITALARIO DE EMERGENCIA] Motivo: Fallecio pasiente"
 *     "[TRASLADO HOSPITALARIO DE EMERGENCIA] Motivo: Fallecio"
 *
 * Una familia podía abrir el portal y leer que su familiar murió, en una nota
 * interna escrita a las prisas y con faltas. El filtro bloqueaba las alertas
 * de rutina y dejaba pasar las muertes.
 *
 * ═══ AHORA ES UNA LISTA BLANCA ═══
 *
 * El defecto era estructural, no una entrada que faltara: con una lista negra,
 * CUALQUIER marcador nuevo que alguien invente el año que viene se publica
 * solo. Se invierte la carga — lo que el sistema no reconoce como seguro es
 * interno.
 *
 * Pasan:
 *   · Notas SIN marcador — las de estilo de vida ("Lavado de ropa
 *     completado", "Aseo de habitación"). Son las 288 de bitácora que la
 *     familia sí debe ver.
 *   · "[Zendi Update]" — mensajes que una persona escribió, revisó y aprobó
 *     antes de que salieran. Las 1 832 notas de bienestar son de estas.
 *
 * Todo lo demás —alertas, acciones preventivas, traslados, notas de turno,
 * salidas a diálisis y lo que venga— es lenguaje del equipo para el equipo.
 * La familia recibe eso en la llamada semanal, de una persona que puede
 * explicarlo y responder preguntas, no en un renglón de portal.
 *
 * Si la nota es null/vacía → false.
 */
const MARCADORES_PARA_FAMILIA = ['[zendi update]'];

export function isCleanNote(note: string | null | undefined): boolean {
    if (!note) return false;
    const trimmed = note.trim();
    if (!trimmed) return false;

    // Sin marcador: nota de estilo de vida, va a la familia.
    if (!trimmed.startsWith('[')) return true;

    const marcador = trimmed.slice(0, trimmed.indexOf(']') + 1).toLowerCase();
    return MARCADORES_PARA_FAMILIA.includes(marcador);
}

/**
 * Computa la banda cualitativa de ingesta de comida a partir del % numérico.
 *   ≥70% → "bien"
 *   ≥40% → "parcial"
 *   <40% → "poco"
 *   null/undefined → null (sin registro)
 */
export function computeFoodBand(foodIntake: number | null | undefined): 'bien' | 'parcial' | 'poco' | null {
    if (foodIntake == null) return null;
    if (foodIntake >= 70) return 'bien';
    if (foodIntake >= 40) return 'parcial';
    return 'poco';
}

/**
 * Texto humano para mostrar la foodBand en UI cuando shareLevel = LIFESTYLE.
 */
export function foodBandLabel(band: 'bien' | 'parcial' | 'poco' | null | undefined): string {
    if (!band) return '—';
    return { bien: 'Bien', parcial: 'Parcial', poco: 'Poco' }[band];
}
