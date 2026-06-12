/**
 * useAutosaveEvaluation — autosave debounced para SWEvaluation DRAFT.
 *
 *   - 2s debounce desde el último cambio
 *   - PUT /api/corporate/sw-evaluations/[id]
 *   - SOLO en mode==='DRAFT' (APPROVED/ARCHIVED ignoran cambios)
 *   - Solo persiste keys EDITABLES (excluye prefillMode==='READ_ONLY' del schema —
 *     esos vienen del prefillSnapshot, anti-drift)
 *   - Estados visibles: IDLE / SAVING / SAVED / ERROR. ERROR persiste hasta
 *     que el usuario tipea de nuevo (NO se traga silenciosamente).
 *   - Race-safe: si entra un cambio con un PUT en vuelo, el nuevo cambio
 *     se "supersede" — apenas termine el PUT actual, dispara otro con la
 *     última versión. Garantiza que el último estado del usuario llega
 *     al servidor, sin disparar requests dobles paralelos.
 *   - beforeunload: si está SAVING o hay pending, browser alerta al usuario
 *     "Tienes cambios sin guardar".
 *
 * No depende de React Query u otra lib — vanilla hooks para que el bundle
 * no infle por un único endpoint.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SWFormTemplateSchema } from './template-types';
import type { AutosaveState, EvaluationFormData, RendererMode } from './ui-types';

const DEBOUNCE_MS = 2000;

interface UseAutosaveOpts {
    evaluationId: string;
    data: EvaluationFormData;
    mode: RendererMode;
    schema: SWFormTemplateSchema;
    /** Override para tests / harness — default es el endpoint real. */
    endpoint?: string;
}

interface UseAutosaveReturn extends AutosaveState {
    /** Fuerza un flush sincrónico (cancela debounce, espera el PUT). Útil antes de aprobar. */
    flushNow: () => Promise<void>;
}

// ─── Helper: stripear keys READ_ONLY ─────────────────────────────────────

/**
 * Devuelve un objeto con SOLO los keys que NO son READ_ONLY en el schema.
 * Los READ_ONLY se mantienen en `prefillSnapshot.prefill` y NUNCA deben
 * sobrescribirse vía PUT — el snapshot es autoridad inmutable.
 */
function stripReadOnly(
    data: EvaluationFormData,
    schema: SWFormTemplateSchema,
): EvaluationFormData {
    const readOnlyKeys = new Set<string>();
    for (const section of schema.sections) {
        for (const field of section.fields) {
            if (field.prefillMode === 'READ_ONLY') {
                readOnlyKeys.add(field.key);
            }
        }
    }
    const out: EvaluationFormData = {};
    for (const k of Object.keys(data)) {
        if (!readOnlyKeys.has(k)) out[k] = data[k];
    }
    return out;
}

// ─── Helper: comparación shallow estable (JSON stringify de keys ordenados) ─

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((value as any)[k])).join(',') + '}';
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useAutosaveEvaluation({
    evaluationId,
    data,
    mode,
    schema,
    endpoint,
}: UseAutosaveOpts): UseAutosaveReturn {
    const url = endpoint ?? `/api/corporate/sw-evaluations/${evaluationId}`;
    const isDraft = mode === 'DRAFT';

    const [state, setState] = useState<AutosaveState>({
        status: 'IDLE',
        lastSavedAt: null,
        lastError: null,
    });

    // Refs para race handling. Evitan re-renders y no se cierran sobre stale closures.
    const lastSavedSerialized = useRef<string>(''); // último data que el server confirmó
    const inFlight = useRef<boolean>(false);
    const pendingSerialized = useRef<string | null>(null); // serializado del cambio "supersede"
    const pendingData = useRef<EvaluationFormData | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Realiza UN PUT. Re-dispara si pendingData se llenó mientras estaba en vuelo. ──
    const doSave = useCallback(async (payload: EvaluationFormData, payloadSerialized: string) => {
        inFlight.current = true;
        setState(s => ({ ...s, status: 'SAVING' }));

        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: payload }),
            });

            if (!res.ok) {
                // 409 (conflict, eval ya no es DRAFT), 422 (validation), 500 — todos visibles
                let msg = `HTTP ${res.status}`;
                try {
                    const body = await res.json();
                    if (body?.error) msg = String(body.error);
                } catch { /* sin body parseable */ }
                throw new Error(msg);
            }

            lastSavedSerialized.current = payloadSerialized;
            setState({ status: 'SAVED', lastSavedAt: new Date(), lastError: null });
        } catch (err: unknown) {
            // ERROR no se traga — queda visible hasta que el usuario tipea de nuevo
            const msg = err instanceof Error ? err.message : 'Error de conexión';
            setState(s => ({ ...s, status: 'ERROR', lastError: msg }));
            // Importante: NO actualizar lastSavedSerialized — el próximo cambio
            // del usuario va a re-disparar el save automáticamente.
        } finally {
            inFlight.current = false;
            // ¿Hubo cambio mientras estábamos guardando? Disparar otro PUT.
            if (pendingData.current !== null && pendingSerialized.current !== null) {
                const nextPayload = pendingData.current;
                const nextSerialized = pendingSerialized.current;
                pendingData.current = null;
                pendingSerialized.current = null;
                // Solo re-disparar si NO igual al que acabamos de guardar (evita ciclo)
                if (nextSerialized !== lastSavedSerialized.current) {
                    void doSave(nextPayload, nextSerialized);
                }
            }
        }
    }, [url]);

    // ─── Debounced trigger sobre cambios en `data` ──
    useEffect(() => {
        // Modo no editable → no hacer nada (limpieza por si quedó timer)
        if (!isDraft || !evaluationId) {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            return;
        }

        const editable = stripReadOnly(data, schema);
        const serialized = stableStringify(editable);

        // Sin cambios netos vs último confirmado → IDLE (suprime el primer save de mount).
        if (serialized === lastSavedSerialized.current) return;

        // Cancelar debounce previo
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            debounceTimer.current = null;

            if (inFlight.current) {
                // Race: hay PUT en vuelo. Guardar este como "pending"; el finally
                // del PUT actual lo va a disparar.
                pendingData.current = editable;
                pendingSerialized.current = serialized;
                return;
            }

            void doSave(editable, serialized);
        }, DEBOUNCE_MS);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
        };
        // Stable stringify del data es lo que dispara — no `data` por referencia,
        // que cambiaría en cada render aunque keys idénticas.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stableStringify(stripReadOnly(data, schema)), isDraft, evaluationId, schema, doSave]);

    // ─── beforeunload: bloquear cierre si hay trabajo sin guardar ──
    useEffect(() => {
        if (!isDraft) return;
        const handler = (e: BeforeUnloadEvent) => {
            const hasPendingDebounce = debounceTimer.current !== null;
            const hasUnsavedFlush = inFlight.current || pendingData.current !== null;
            if (hasPendingDebounce || hasUnsavedFlush || state.status === 'ERROR') {
                e.preventDefault();
                // Chrome ignora el mensaje custom desde 2016, pero set returnValue
                // dispara el dialog nativo.
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDraft, state.status]);

    // ─── flushNow — cancelar debounce, esperar PUT en vuelo, mandar último cambio ──
    const flushNow = useCallback(async (): Promise<void> => {
        if (!isDraft || !evaluationId) return;

        // Cancelar debounce pendiente
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
        }

        const editable = stripReadOnly(data, schema);
        const serialized = stableStringify(editable);
        // No hay cambios netos → no hacer nada
        if (serialized === lastSavedSerialized.current && !inFlight.current) return;

        // Esperar PUT en vuelo (si hay)
        while (inFlight.current) {
            await new Promise(r => setTimeout(r, 50));
        }
        // Después del wait, el último PUT pudo haber subido la versión actual ya
        if (serialized === lastSavedSerialized.current) return;

        await doSave(editable, serialized);
    }, [data, schema, isDraft, evaluationId, doSave]);

    return {
        ...state,
        flushNow,
    };
}
