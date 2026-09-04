/**
 * src/lib/diet.ts
 *
 * Fuente única de verdad para la prescripción de dietas en el sistema.
 *
 * Antes del Sprint Diet System (jun-2026) existían 3 dropdowns distintos
 * (intake, /care, perfil residente) escribiendo strings libres en
 * Patient.diet con vocabularios incompatibles ("BLANDA" vs "Puré (Mojada)"
 * vs "Puré / Mojado"). El filtro de cocina hacía .includes() sobre esos
 * strings y los conteos quedaban en 0 cuando llegaba un valor de un form
 * que no estaba contemplado.
 *
 * Solución: enum `DietTexture` + flags ortogonales `dietDiabetic/LowSodium/
 * Renal/Vegetarian`. Este módulo expone:
 *   - DIET_TEXTURE_LABELS  → label humano por textura (UI)
 *   - DIET_TEXTURE_DESC    → descripción clínica corta (tooltip)
 *   - DIET_MODIFIER_LABELS → label humano por flag
 *   - DIET_TEXTURES        → array ordenado para iterar dropdowns
 *   - formatDietSummary    → string corto para listados ("Puré +Bajo Sodio")
 */

import { DietTexture } from '@prisma/client';

export const DIET_TEXTURES: DietTexture[] = [
    'REGULAR',
    'BLANDA',
    'MAJADA',
    'PUREE',
    'LICUADO',
    'LIQUIDOS_CLAROS',
    'PEG',
];

export const DIET_TEXTURE_LABELS: Record<DietTexture, string> = {
    REGULAR:         'Regular',
    BLANDA:          'Blanda',
    MAJADA:          'Majada',
    PUREE:           'Puré',
    LICUADO:         'Licuado',
    LIQUIDOS_CLAROS: 'Líquidos Claros',
    PEG:             'PEG (Sonda)',
};

export const DIET_TEXTURE_DESC: Record<DietTexture, string> = {
    REGULAR:         'Sólida estándar',
    BLANDA:          'Sólida cocida y suave (carne molida, vegetales blandos)',
    MAJADA:          'Machacada sin trozos (mofongo, majado de papa)',
    PUREE:           'Sin grumos, espesa — disfagia moderada',
    LICUADO:         'Sin grumos, líquida — disfagia severa',
    LIQUIDOS_CLAROS: 'Caldo, té, jugo colado',
    PEG:             'Alimentación enteral por sonda, no oral',
};

/**
 * Densidades de fórmula enteral en kcal/mL. Es un vocabulario cerrado a
 * propósito: son las presentaciones que existen en el mercado, y dejarlo como
 * texto libre reproduciría exactamente el problema que este módulo vino a
 * resolver —tres pantallas escribiendo "1.5 Cal", "1.5 kcal/ml" y "1,5".
 */
export const DIET_PEG_DENSIDADES = [1.0, 1.2, 1.5, 2.0] as const;

/** "1.5 Cal" — como lo dice la orden y como lo lee la cocina. */
export function etiquetaDensidadPeg(kcalMl: number): string {
    return `${kcalMl.toFixed(1)} Cal`;
}

export type DietModifier = 'diabetic' | 'lowSodium' | 'renal' | 'vegetarian';

export const DIET_MODIFIERS: DietModifier[] = ['diabetic', 'lowSodium', 'renal', 'vegetarian'];

export const DIET_MODIFIER_LABELS: Record<DietModifier, string> = {
    diabetic:   'Diabética / Baja en Azúcar',
    lowSodium:  'Baja en Sodio / Baja en Sal',
    renal:      'Renal',
    vegetarian: 'Vegetariana',
};

export const DIET_MODIFIER_SHORT: Record<DietModifier, string> = {
    diabetic:   'Diabética',
    lowSodium:  'Bajo Sodio',
    renal:      'Renal',
    vegetarian: 'Vegetariana',
};

export interface DietPrescription {
    dietTexture: DietTexture | null;
    dietDiabetic: boolean;
    dietLowSodium: boolean;
    dietRenal: boolean;
    dietVegetarian: boolean;
    /** kcal/mL de la fórmula. Solo con dietTexture = PEG. */
    dietPegKcalMl?: number | null;
}

/**
 * Compacta una prescripción en una etiqueta corta para listados/tablas.
 * Ej.: { texture: PUREE, lowSodium: true } → "Puré +Bajo Sodio"
 *      { texture: null }                   → "Sin prescribir"
 */
export function formatDietSummary(p: Partial<DietPrescription>): string {
    if (!p.dietTexture) return 'Sin prescribir';
    const parts = [DIET_TEXTURE_LABELS[p.dietTexture]];
    // La densidad va pegada a la textura, no como modificador: no es algo que
    // se le añade a la dieta, es de qué está hecha.
    if (p.dietTexture === 'PEG' && p.dietPegKcalMl) {
        parts[0] += ` ${etiquetaDensidadPeg(p.dietPegKcalMl)}`;
    }
    if (p.dietDiabetic)   parts.push('+Diabética');
    if (p.dietLowSodium)  parts.push('+Bajo Sodio');
    if (p.dietRenal)      parts.push('+Renal');
    if (p.dietVegetarian) parts.push('+Vegetariana');
    return parts.join(' ');
}

/**
 * Útil para componer un string compat con Patient.diet legacy
 * (back-compat para code paths que aún leen el string). Lo seguimos
 * escribiendo durante la transición para no romper consumers.
 */
export function buildLegacyDietString(p: Partial<DietPrescription>): string | null {
    if (!p.dietTexture) return null;
    return formatDietSummary(p);
}
