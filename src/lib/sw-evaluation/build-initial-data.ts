/**
 * src/lib/sw-evaluation/build-initial-data.ts
 *
 * Construye el `data` inicial de una SWEvaluation a partir del template
 * + el resultado del resolver de prefill.
 *
 * Regla (decisión 10-jun-2026):
 *   - READ_ONLY (locked):    se siembra en `data` con el valor resuelto. La UI
 *                            lo muestra read-only — la TS no lo modifica.
 *   - REFERENCE (editable):  se siembra en `data` como default editable. La
 *                            TS puede mantener o cambiar.
 *   - NONE + prefillFrom:    NO se siembra en `data`. Es hint visible al lado
 *                            (vive en referenceData del snapshot). La TS
 *                            llena el campo desde cero.
 *   - NONE sin prefillFrom:  NO se siembra. Input puro.
 *
 * El `prefillSnapshot` que se persiste captura el blob COMPLETO (prefill +
 * referenceData) como evidencia inmutable de "qué mostró el sistema al
 * crear esta eval". Eso permite auditar después qué fue auto-llenado vs qué
 * escribió la TS.
 */

import type { SWFormTemplateSchema } from './template-types';
import type { PrefillOutput } from './prefill-resolver';

export interface InitialDataResult {
    /** Lo que se persiste en SWEvaluation.data al crear. */
    data: Record<string, unknown>;
    /** Lo que se persiste en SWEvaluation.prefillSnapshot — inmutable. */
    prefillSnapshot: {
        prefill: Record<string, unknown>;
        referenceData: Record<string, unknown>;
        unmapped: string[];
        resolvedAt: string; // ISO timestamp del momento de la resolución
    };
}

export function buildInitialData(
    schema: SWFormTemplateSchema,
    prefillResult: PrefillOutput,
    resolvedAt: Date = new Date(),
): InitialDataResult {
    const data: Record<string, unknown> = {};

    for (const section of schema.sections) {
        for (const field of section.fields) {
            // Solo READ_ONLY + REFERENCE siembran el `data` inicial.
            // NONE (con o sin prefillFrom) NO se siembra — la TS llena desde cero.
            if (field.prefillMode === 'READ_ONLY' || field.prefillMode === 'REFERENCE') {
                if (Object.prototype.hasOwnProperty.call(prefillResult.prefill, field.key)) {
                    data[field.key] = prefillResult.prefill[field.key];
                }
            }
        }
    }

    return {
        data,
        prefillSnapshot: {
            prefill: prefillResult.prefill,
            referenceData: prefillResult.referenceData,
            unmapped: prefillResult.unmapped,
            resolvedAt: resolvedAt.toISOString(),
        },
    };
}
