/**
 * CheckboxGroupField — renderer para field.type === 'checkbox_group'.
 *
 * Multi-select con checkboxes grandes (touch-friendly). El value en `data`
 * es un Array<string> de opciones marcadas.
 *
 * Sin opciones definidas, el field es inerte (mensaje claro al supervisor).
 */

'use client';

import type { FieldRendererProps } from '@/lib/sw-evaluation/ui-types';
import { FieldShell } from './FieldShell';

interface CheckboxGroupFieldProps extends FieldRendererProps {
    defaultValue?: string[] | null;
    error?: string | null;
}

function toArray(v: unknown): string[] {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    return [];
}

function sameArray(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((x, i) => x === sb[i]);
}

export function CheckboxGroupField({
    field, value, referenceHint, locked, onChange, defaultValue, error,
}: CheckboxGroupFieldProps) {
    const options = field.options ?? [];
    const current = toArray(value);
    const defaultArr = toArray(defaultValue);
    const showRestore = field.prefillMode === 'REFERENCE'
        && defaultArr.length > 0
        && !sameArray(current, defaultArr);

    const toggle = (opt: string) => {
        if (locked) return;
        const next = current.includes(opt)
            ? current.filter(o => o !== opt)
            : [...current, opt];
        onChange(field.key, next);
    };

    if (options.length === 0) {
        return (
            <FieldShell field={field} locked={locked} referenceHint={referenceHint} error={error}>
                <p className="text-sm italic text-slate-400 px-2 py-3 border border-dashed border-slate-200 rounded-xl">
                    (Sin opciones configuradas en el template)
                </p>
            </FieldShell>
        );
    }

    return (
        <FieldShell
            field={field}
            locked={locked}
            referenceHint={referenceHint}
            onRestore={showRestore ? () => onChange(field.key, defaultArr) : undefined}
            error={error}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {options.map((opt) => {
                    const checked = current.includes(opt);
                    const itemClasses = [
                        'flex items-center gap-3 min-h-[48px] px-4 py-3',
                        'border rounded-xl cursor-pointer select-none transition-all',
                        checked
                            ? 'bg-teal-50 border-teal-500'
                            : 'bg-white border-slate-300 hover:border-slate-400',
                        locked && 'cursor-not-allowed opacity-60',
                    ].filter(Boolean).join(' ');

                    return (
                        <label key={opt} className={itemClasses}>
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(opt)}
                                disabled={locked}
                                className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-600 cursor-pointer shrink-0"
                            />
                            <span className="text-base text-slate-700 font-medium leading-snug">{opt}</span>
                        </label>
                    );
                })}
            </div>
        </FieldShell>
    );
}
