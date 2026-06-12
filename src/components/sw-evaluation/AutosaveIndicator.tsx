/**
 * AutosaveIndicator — feedback visible del hook useAutosaveEvaluation.
 *
 * 4 estados:
 *   IDLE   → "Sin cambios pendientes" (gris suave)
 *   SAVING → spinner + "Guardando…" (teal)
 *   SAVED  → ✓ + "Guardado hace X" (verde)
 *   ERROR  → ⚠ + mensaje del error (rojo) — persiste hasta nuevo cambio
 *
 * Pensado para vivir en el top-bar sticky del page de la eval (P5),
 * a la derecha del título.
 */

'use client';

import { useEffect, useState } from 'react';
import type { AutosaveState } from '@/lib/sw-evaluation/ui-types';

interface AutosaveIndicatorProps {
    state: AutosaveState;
    /** Si false, el componente se oculta (ej. mode != DRAFT en page real). */
    visible?: boolean;
}

// ─── Helper: tiempo relativo en español ──────────────────────────────────

function formatRelative(date: Date | null, now: number): string {
    if (!date) return '';
    const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
    if (seconds < 5) return 'ahora mismo';
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    return date.toLocaleString('es-PR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Componente ──────────────────────────────────────────────────────────

export function AutosaveIndicator({ state, visible = true }: AutosaveIndicatorProps) {
    // Tick cada 15s para refrescar "hace X" sin re-renderizar el padre
    const [tick, setTick] = useState(Date.now());
    useEffect(() => {
        if (!visible) return;
        const id = setInterval(() => setTick(Date.now()), 15000);
        return () => clearInterval(id);
    }, [visible]);

    if (!visible) return null;

    if (state.status === 'IDLE') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-300" aria-hidden="true" />
                <span>Sin cambios pendientes</span>
            </span>
        );
    }

    if (state.status === 'SAVING') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-teal-700">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
                    <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span>Guardando…</span>
            </span>
        );
    }

    if (state.status === 'SAVED') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
                </svg>
                <span>Guardado <span className="font-normal text-emerald-600">{formatRelative(state.lastSavedAt, tick)}</span></span>
            </span>
        );
    }

    // ERROR — visible y persistente hasta que el usuario tipea
    return (
        <span
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1"
            role="status"
            aria-live="polite"
            title={state.lastError ?? 'Error al guardar'}
        >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM10 5a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1zm0 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z" clipRule="evenodd" />
            </svg>
            <span className="max-w-[260px] truncate">
                Error al guardar
                {state.lastError ? `: ${state.lastError}` : ''}
            </span>
        </span>
    );
}
