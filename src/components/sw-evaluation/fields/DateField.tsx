/**
 * DateField — renderer para field.type === 'date'.
 *
 * Mantiene la convención de el resto del app: el value en `data` es un
 * string ISO date (YYYY-MM-DD) o vacío. Lo persistimos así para que el
 * PDF y los endpoints no tengan que reparsear Dates de JSON.
 *
 * Touch-friendly: input[type=date] nativo, min-h 48px, padding generoso.
 */

'use client';

import type { FieldRendererProps } from '@/lib/sw-evaluation/ui-types';
import { FieldShell } from './FieldShell';

interface DateFieldProps extends FieldRendererProps {
    defaultValue?: string | null;
    error?: string | null;
}

/** Normaliza cualquier date-like (Date, ISO, YYYY-MM-DD) a YYYY-MM-DD para el input. */
function toIsoDate(v: unknown): string {
    if (v == null || v === '') return '';
    if (v instanceof Date) {
        if (Number.isNaN(v.getTime())) return '';
        return v.toISOString().slice(0, 10);
    }
    if (typeof v === 'string') {
        // Ya es YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        // ISO completo
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return '';
}

export function DateField({ field, value, referenceHint, locked, onChange, defaultValue, error }: DateFieldProps) {
    const isoValue = toIsoDate(value);
    const defaultIso = toIsoDate(defaultValue);
    const showRestore = field.prefillMode === 'REFERENCE'
        && defaultIso !== ''
        && isoValue !== defaultIso;

    const baseInputClasses = [
        'w-full bg-white text-base text-slate-800',
        'border border-slate-300 rounded-xl px-4 py-3 min-h-[48px]',
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
            onRestore={showRestore ? () => onChange(field.key, defaultIso) : undefined}
            error={error}
        >
            <input
                id={`fld-${field.key}`}
                type="date"
                value={isoValue}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={locked}
                className={baseInputClasses}
            />
        </FieldShell>
    );
}
