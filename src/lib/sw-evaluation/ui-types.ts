/**
 * src/lib/sw-evaluation/ui-types.ts
 *
 * Tipos compartidos para el renderer de UI de SWEvaluation (Fase 2).
 * NO toca el shape de los modelos Prisma ni de los endpoints — solo
 * propaga estado entre componentes React.
 *
 * Sin acoplamiento al DOM ni a librerías específicas — para que estos
 * tipos sean usables por field renderers, autosave hook, y harness de
 * preview por igual.
 */

import type { SWFormTemplateSchema, SWFormField } from './template-types';

/**
 * Modo de render — alineado con el estado de la evaluación en DB.
 *
 *   DRAFT     → todos los campos editables (excepto los READ_ONLY que vienen
 *              del prefillSnapshot). Autosave activo.
 *   APPROVED  → form lockeado, addendums permitidos.
 *   ARCHIVED  → form lockeado, addendums prohibidos (solo descargar PDF).
 */
export type RendererMode = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

/**
 * Estado del autosave — feedback visual obligatorio.
 *
 *   IDLE    → sin cambios desde el último save (o nunca se ha guardado).
 *   SAVING  → request PUT en vuelo.
 *   SAVED   → último save fue exitoso.
 *   ERROR   → el último save falló — debe visualizarse para que la TS no
 *            pierda trabajo silenciosamente. El hook NO recupera por sí
 *            mismo; espera a que el usuario tipee de nuevo para retry.
 */
export type AutosaveStatus = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';

export interface AutosaveState {
    status: AutosaveStatus;
    lastSavedAt: Date | null;
    lastError: string | null;
}

/**
 * Callback que un field renderer dispara cuando el usuario edita.
 * El renderer master agrega al `data` y dispara autosave debouncedo.
 */
export type FieldChangeHandler = (key: string, value: unknown) => void;

/**
 * Shape del payload que el form maneja en memoria — la unión de:
 *   - data DRAFT (editable)
 *   - data inyectada vía prefill (READ_ONLY + REFERENCE en prefillSnapshot,
 *     pero los REFERENCE pueden estar overrided por la TS en data)
 *
 * Mantenemos `unknown` por ahora; el tipado fino vive en los field renderers
 * que sí discriminan por `FieldType`.
 */
export type EvaluationFormData = Record<string, unknown>;

/**
 * Snapshot inmutable de prefill — copia exacta del JSON guardado al crear
 * la eval. Autoridad para los campos READ_ONLY: aunque `data` tenga otro
 * valor, el renderer lockea con este (anti-drift).
 */
export interface EvaluationPrefillSnapshot {
    prefill: Record<string, unknown>;
    referenceData: Record<string, unknown>;
    unmapped: string[];
    resolvedAt: string; // ISO timestamp
}

/**
 * Props que recibe el renderer master.
 *
 * `data` es el estado vivo en memoria (no inmutable). `prefillSnapshot` SÍ
 * es inmutable: si un campo es READ_ONLY, su valor sale de aquí, no de
 * `data` (anti-drift por edición accidental).
 */
export interface RendererProps {
    schema: SWFormTemplateSchema;
    data: EvaluationFormData;
    prefillSnapshot: EvaluationPrefillSnapshot;
    mode: RendererMode;
    onChange: FieldChangeHandler;
    autosave?: AutosaveState; // opcional — el harness puede omitirlo
}

/**
 * Props que recibe cada field renderer concreto.
 * `referenceHint` ya viene pre-formateado por `format-hint.ts` (string
 * legible o null). Si null, el renderer no muestra el hint.
 */
export interface FieldRendererProps {
    field: SWFormField;
    value: unknown;
    referenceHint: string | null;
    locked: boolean; // mode != DRAFT, o prefillMode === READ_ONLY
    onChange: FieldChangeHandler;
}
