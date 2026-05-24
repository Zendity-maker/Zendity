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
 * Detecta notas con prefijos de alerta clínica interna que NO deben llegar a familia.
 * Estas notas son señales del equipo (triage, observaciones) que la familia
 * solo debería ver traducidas/sanitizadas.
 *
 * Patrones reconocidos:
 *   - "[ALERTA ...]" o "[alerta ...]"
 *   - "[ACCIÓN PREVENTIVA ...]"
 *
 * Si la nota es null/empty → false (no es nota válida para mostrar).
 */
const ALERT_PREFIXES = ['[ALERTA', '[ACCIÓN PREVENTIVA', '[alerta'];

export function isCleanNote(note: string | null | undefined): boolean {
    if (!note) return false;
    const trimmed = note.trim();
    if (!trimmed) return false;
    return !ALERT_PREFIXES.some((p) => trimmed.startsWith(p));
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
