/**
 * TextField — renderer para field.type === 'text' o 'narrative'.
 *
 *   text:      <input> de una línea
 *   narrative: <textarea> de varias líneas (mínimo 4 filas)
 *
 * Respeta prefillMode y lock global vía FieldShell. Touch-friendly: padding
 * generoso, text-base (no text-sm), focus ring teal Zéndity.
 */

'use client';

import type { FieldRendererProps } from '@/lib/sw-evaluation/ui-types';
import { FieldShell } from './FieldShell';

interface TextFieldProps extends FieldRendererProps {
    /** Si el field es REFERENCE y el value editado difiere del default — UI mostrará botón "↻ restaurar". */
    defaultValue?: string | null;
    error?: string | null;
}

export function TextField({ field, value, referenceHint, locked, onChange, defaultValue, error }: TextFieldProps) {
    const stringValue = value == null ? '' : String(value);
    const isNarrative = field.type === 'narrative';
    const showRestore = field.prefillMode === 'REFERENCE'
        && defaultValue != null
        && stringValue !== String(defaultValue);

    const baseInputClasses = [
        'w-full bg-white text-base text-slate-800 placeholder-slate-400',
        'border border-slate-300 rounded-xl px-4 py-3',
        'focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600',
        'transition-colors',
        locked && 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200',
        error && 'border-red-400 focus:ring-red-400 focus:border-red-400',
    ].filter(Boolean).join(' ');

    return (
        <FieldShell
            field={field}
            locked={locked}
            referenceHint={referenceHint}
            onRestore={showRestore ? () => onChange(field.key, defaultValue) : undefined}
            error={error}
        >
            {isNarrative ? (
                <textarea
                    id={`fld-${field.key}`}
                    value={stringValue}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    disabled={locked}
                    rows={4}
                    className={`${baseInputClasses} min-h-[120px] resize-y leading-relaxed`}
                />
            ) : (
                <input
                    id={`fld-${field.key}`}
                    type="text"
                    value={stringValue}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    disabled={locked}
                    className={`${baseInputClasses} min-h-[48px]`}
                />
            )}
        </FieldShell>
    );
}
