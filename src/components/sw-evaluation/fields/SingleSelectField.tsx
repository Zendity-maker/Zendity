/**
 * SingleSelectField — renderer para field.type === 'single_select'.
 *
 * Pill-buttons en lugar de <select> nativo: tap-friendly en tablet, ~~más
 * claro visualmente cuál opción está activa~~, y consistente con el resto
 * del app (DietPrescription, color picker del supervisor).
 *
 * Si options no está definido, fallback a "Sí/No" — defensivo.
 */

'use client';

import type { FieldRendererProps } from '@/lib/sw-evaluation/ui-types';
import { FieldShell } from './FieldShell';

interface SingleSelectFieldProps extends FieldRendererProps {
    defaultValue?: string | null;
    error?: string | null;
}

export function SingleSelectField({
    field, value, referenceHint, locked, onChange, defaultValue, error,
}: SingleSelectFieldProps) {
    const options = field.options && field.options.length > 0 ? field.options : ['Sí', 'No'];
    const current = value == null ? '' : String(value);
    const showRestore = field.prefillMode === 'REFERENCE'
        && defaultValue != null && defaultValue !== ''
        && current !== String(defaultValue);

    return (
        <FieldShell
            field={field}
            locked={locked}
            referenceHint={referenceHint}
            onRestore={showRestore ? () => onChange(field.key, defaultValue) : undefined}
            error={error}
        >
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`fld-${field.key}-label`}>
                {options.map((opt) => {
                    const selected = current === opt;
                    const pillClasses = [
                        'min-h-[48px] px-5 py-3 rounded-xl text-base font-semibold',
                        'border transition-all',
                        selected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400',
                        locked && 'cursor-not-allowed opacity-60',
                        !locked && !selected && 'hover:bg-slate-50',
                    ].filter(Boolean).join(' ');

                    return (
                        <button
                            key={opt}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => !locked && onChange(field.key, opt)}
                            disabled={locked}
                            className={pillClasses}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </FieldShell>
    );
}
