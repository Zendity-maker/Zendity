/**
 * SWEvaluationFormRenderer — master del form de SWEvaluation.
 *
 * Itera secciones del schema y dispatcha cada field a su renderer concreto
 * según `field.type`. El switch es EXHAUSTIVO: si alguien agrega un FieldType
 * nuevo al template-types sin actualizar este renderer, el compilador
 * (vía `never`) avisa.
 *
 * Reglas de value:
 *   - READ_ONLY: lee del prefillSnapshot.prefill[key]. NO de `data` — anti-drift.
 *                Para tabla, también pasa snapshotValue para que TableField use el array
 *                heredado del residente.
 *   - REFERENCE: lee de data[key]; defaultValue = prefillSnapshot.prefill[key] (botón restaurar).
 *   - NONE+from: lee de data[key]; referenceHint = formatHint(field, referenceData[key]).
 *   - NONE puro: lee de data[key]; sin hint.
 *
 * Lock global:
 *   - mode === 'DRAFT' → solo READ_ONLY locked; el resto editable.
 *   - mode === 'APPROVED' / 'ARCHIVED' → todo locked.
 */

'use client';

import type {
    SWFormField,
    SWFormSection,
    SWFormTemplateSchema,
} from '@/lib/sw-evaluation/template-types';
import type { RendererProps } from '@/lib/sw-evaluation/ui-types';
import { formatHint } from '@/lib/sw-evaluation/format-hint';

import { TextField } from './fields/TextField';
import { DateField } from './fields/DateField';
import { SingleSelectField } from './fields/SingleSelectField';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import { TableField } from './fields/TableField';

// ─── Dispatch por FieldType — exhaustivo por construcción ────────────────

interface RenderFieldArgs {
    field: SWFormField;
    value: unknown;
    snapshotValue: unknown;
    defaultValue: unknown;
    referenceHint: string | null;
    locked: boolean;
    onChange: RendererProps['onChange'];
}

function renderField(args: RenderFieldArgs) {
    const { field, value, snapshotValue, defaultValue, referenceHint, locked, onChange } = args;

    // El switch es exhaustivo: si SWFormField['type'] gana un literal nuevo,
    // el `never` en default rompe el build. TypeScript es nuestro radar.
    switch (field.type) {
        case 'text':
        case 'narrative':
            return (
                <TextField
                    field={field}
                    value={value}
                    referenceHint={referenceHint}
                    locked={locked}
                    onChange={onChange}
                    defaultValue={typeof defaultValue === 'string' ? defaultValue : null}
                />
            );

        case 'date':
            return (
                <DateField
                    field={field}
                    value={value}
                    referenceHint={referenceHint}
                    locked={locked}
                    onChange={onChange}
                    defaultValue={typeof defaultValue === 'string' ? defaultValue : null}
                />
            );

        case 'single_select':
            return (
                <SingleSelectField
                    field={field}
                    value={value}
                    referenceHint={referenceHint}
                    locked={locked}
                    onChange={onChange}
                    defaultValue={typeof defaultValue === 'string' ? defaultValue : null}
                />
            );

        case 'checkbox_group':
            return (
                <CheckboxGroupField
                    field={field}
                    value={value}
                    referenceHint={referenceHint}
                    locked={locked}
                    onChange={onChange}
                    defaultValue={Array.isArray(defaultValue) ? (defaultValue as string[]) : null}
                />
            );

        case 'table':
            return (
                <TableField
                    field={field}
                    value={value}
                    snapshotValue={snapshotValue}
                    referenceHint={referenceHint}
                    locked={locked}
                    onChange={onChange}
                />
            );

        default: {
            // Exhaustividad: si llega acá, FieldType creció y este renderer
            // está obsoleto. El compilador rompe via never.
            const _exhaustive: never = field.type;
            return (
                <p className="text-sm text-red-600 italic px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    [Renderer faltante para FieldType: {String(_exhaustive)}]
                </p>
            );
        }
    }
}

// ─── Section block ───────────────────────────────────────────────────────

interface SectionBlockProps {
    section: SWFormSection;
    children: React.ReactNode;
}

function SectionBlock({ section, children }: SectionBlockProps) {
    return (
        <section
            id={`sec-${section.key}`}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
            aria-labelledby={`sec-${section.key}-title`}
        >
            <header className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <h2 id={`sec-${section.key}-title`} className="text-base font-bold text-slate-800 tracking-tight">
                    <span className="text-teal-700 font-black">{section.order}.</span>{' '}
                    <span>{section.title.replace(/^[IVX]+\.\s*/, '').replace(/^\d+\.\s*/, '')}</span>
                </h2>
            </header>
            <div className="px-6 py-5 grid grid-cols-1 gap-5">
                {children}
            </div>
        </section>
    );
}

// ─── Master renderer ─────────────────────────────────────────────────────

export function SWEvaluationFormRenderer({
    schema,
    data,
    prefillSnapshot,
    mode,
    onChange,
}: RendererProps) {
    const globalLock = mode !== 'DRAFT';

    // Ordenamos secciones por `order` (defensivo — el schema debería estar ordenado).
    const sections = [...schema.sections].sort((a, b) => a.order - b.order);

    return (
        <div className="flex flex-col gap-6">
            {sections.map((section) => (
                <SectionBlock key={section.key} section={section}>
                    {section.fields.map((field) => {
                        // Resolver value según prefillMode
                        const snapshotValue = prefillSnapshot.prefill[field.key];
                        const isReadOnly = field.prefillMode === 'READ_ONLY';

                        // READ_ONLY: snapshot manda. REFERENCE/NONE: data manda.
                        const value = isReadOnly ? snapshotValue : data[field.key];

                        // Default para botón "restaurar" — solo aplica en REFERENCE.
                        const defaultValue = field.prefillMode === 'REFERENCE'
                            ? snapshotValue
                            : undefined;

                        // Hint visible — solo cuando NONE + prefillFrom (otros modes nunca llegan a referenceData).
                        const referenceHint = field.prefillMode === 'NONE' && field.prefillFrom
                            ? formatHint(field, prefillSnapshot.referenceData[field.key])
                            : null;

                        const locked = globalLock || isReadOnly;

                        return (
                            <div key={field.key} data-field-key={field.key}>
                                {renderField({
                                    field,
                                    value,
                                    snapshotValue,
                                    defaultValue,
                                    referenceHint,
                                    locked,
                                    onChange,
                                })}
                            </div>
                        );
                    })}
                </SectionBlock>
            ))}
        </div>
    );
}
