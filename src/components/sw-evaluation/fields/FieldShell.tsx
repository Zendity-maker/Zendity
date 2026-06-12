/**
 * FieldShell — wrapper visual común a todos los field renderers de la
 * SWEvaluation. Centraliza label + lock icon + hint line + slot de error +
 * botón "↻ restaurar" (REFERENCE override).
 *
 * El renderer concreto (Text, Date, Select, …) provee el input vía children.
 *
 * Acentos Zéndity teal (#0F6B78) en focus rings; en lock state, gris.
 */

'use client';

import type { ReactNode } from 'react';
import type { SWFormField } from '@/lib/sw-evaluation/template-types';

interface FieldShellProps {
    field: SWFormField;
    /**
     * Locked visualmente. True cuando:
     *   - mode != DRAFT (form aprobado/archivado), o
     *   - prefillMode === 'READ_ONLY' (siempre locked, incluso en DRAFT).
     */
    locked: boolean;
    /** Hint de "Referencia: …" — ya formateado por format-hint. null = no mostrar. */
    referenceHint: string | null;
    /** Solo aparece cuando el value actual ≠ default REFERENCE (señal de override). */
    onRestore?: () => void;
    /** Mensaje de error inline, debajo del input. */
    error?: string | null;
    children: ReactNode;
}

// ─── Iconos inline (sin dependencia externa) ─────────────────────────────

function LockIcon() {
    return (
        <svg viewBox="0 0 20 20" className="w-4 h-4 text-slate-400 shrink-0" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 1a4 4 0 00-4 4v3H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm-2 7V5a2 2 0 114 0v3H8z" clipRule="evenodd" />
        </svg>
    );
}

function RestoreIcon() {
    return (
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 shrink-0" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
    );
}

// ─── Componente ──────────────────────────────────────────────────────────

export function FieldShell({ field, locked, referenceHint, onRestore, error, children }: FieldShellProps) {
    const isReadOnly = field.prefillMode === 'READ_ONLY';
    const showLockIcon = isReadOnly; // global lock no muestra icono — el botón Approved del page lo indica

    return (
        <div className="flex flex-col gap-1.5">
            {/* Label row: label + lock icon (READ_ONLY) + restore btn (REFERENCE override) */}
            <div className="flex items-center gap-2 min-h-[24px]">
                <label
                    htmlFor={`fld-${field.key}`}
                    className="text-sm font-semibold text-slate-700"
                >
                    {field.label}
                </label>
                {showLockIcon && (
                    <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400"
                        title="Viene del residente — no editable"
                    >
                        <LockIcon />
                        <span>del residente</span>
                    </span>
                )}
                {onRestore && !locked && (
                    <button
                        type="button"
                        onClick={onRestore}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors"
                        title="Restaurar el valor sugerido del residente"
                    >
                        <RestoreIcon />
                        <span>restaurar</span>
                    </button>
                )}
            </div>

            {/* Hint de referencia (NONE+prefillFrom) — info-line tenue */}
            {referenceHint && (
                <p className="text-[12px] text-slate-500 italic leading-snug">
                    <span className="font-medium not-italic text-slate-400">Referencia:</span>{' '}
                    {referenceHint}
                </p>
            )}

            {/* Input slot */}
            {children}

            {/* Error inline */}
            {error && (
                <p className="text-[12px] font-medium text-red-600 leading-snug">{error}</p>
            )}
        </div>
    );
}
