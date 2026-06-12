/**
 * TableField — renderer para field.type === 'table'.
 *
 * Dos modos lockeados en v1, discriminados por la presencia de `field.rows`:
 *
 *   MODO DISPLAY (sin field.rows + prefillMode=READ_ONLY):
 *     Tabla read-only que renderiza un array de objetos heredados del
 *     prefillSnapshot. Ej. §IX Familiares — cada fila es un FamilyMember.
 *     Las columnas pueden incluir boolean (¿Apoderado?, ¿Principal?).
 *     SIN add/delete-row. La data viene del residente, vive como display.
 *
 *   MODO FILAS-FIJAS (con field.rows + prefillMode=NONE):
 *     Tabla con conceptos fijos provistos por el schema (`field.rows`).
 *     Por convención v1: la primera columna es el concepto (precargado,
 *     read-only) y las columnas `currency` son editables. SIN add/delete-row.
 *     Ej. §X Datos Económicos — 12 fuentes de ingreso fijas + columna $.
 *
 * Touch-friendly: celdas editables son inputs grandes (min-h 44px), padding
 * generoso. Funciona igual en laptop y tablet.
 *
 * El value en `data`:
 *   - Modo DISPLAY:    Array<Record<string, unknown>>  (objetos por fila)
 *   - Modo FILAS-FIJAS: Array<Record<string, unknown>> donde cada fila tiene
 *                       el `concept` (= row del schema) + valores editables.
 *                       Si la TS aún no ha editado, el array puede tener
 *                       menos filas que field.rows — el renderer sintetiza.
 */

'use client';

import type { TableColumn } from '@/lib/sw-evaluation/template-types';
import type { FieldRendererProps } from '@/lib/sw-evaluation/ui-types';
import { FieldShell } from './FieldShell';

interface TableFieldProps extends FieldRendererProps {
    error?: string | null;
    /** Snapshot del prefill — autoritativo cuando prefillMode === 'READ_ONLY'. */
    snapshotValue?: unknown;
}

// ─── Helpers de display ──────────────────────────────────────────────────

function renderDisplayCell(col: TableColumn, raw: unknown): React.ReactNode {
    if (raw === null || raw === undefined || raw === '') {
        return <span className="text-slate-300">—</span>;
    }
    switch (col.type) {
        case 'boolean':
            return raw === true
                ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">✓</span>
                : <span className="text-slate-300">—</span>;
        case 'currency':
            return <span className="font-mono tabular-nums">${Number(raw).toLocaleString('es-PR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
        case 'number':
            return <span className="font-mono tabular-nums">{String(raw)}</span>;
        case 'text':
        default:
            return String(raw);
    }
}

function toRowArray(v: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(v)) return v.filter(x => typeof x === 'object' && x !== null) as Array<Record<string, unknown>>;
    return [];
}

// ─── Componente ──────────────────────────────────────────────────────────

export function TableField({ field, value, referenceHint, locked, onChange, error, snapshotValue }: TableFieldProps) {
    const columns: TableColumn[] = field.columns ?? [];
    const fixedRows: string[] | undefined = field.rows;

    // ¿Qué value mostrar? Si READ_ONLY, prefillSnapshot manda (anti-drift).
    const isReadOnlyFromSnapshot = field.prefillMode === 'READ_ONLY';
    const effectiveValue = isReadOnlyFromSnapshot && snapshotValue !== undefined ? snapshotValue : value;
    const rows = toRowArray(effectiveValue);

    if (columns.length === 0) {
        return (
            <FieldShell field={field} locked={locked} referenceHint={referenceHint} error={error}>
                <p className="text-sm italic text-slate-400 px-2 py-3 border border-dashed border-slate-200 rounded-xl">
                    (Sin columnas configuradas en el template)
                </p>
            </FieldShell>
        );
    }

    const baseTableClasses = 'w-full border-collapse border border-slate-200 rounded-xl overflow-hidden';
    const baseHeaderCellClasses = 'text-left text-[12px] uppercase tracking-wide font-bold text-slate-600 bg-slate-50 border-b border-slate-200 px-4 py-3';

    // ── MODO FILAS-FIJAS: rows definidos en schema, columnas mezclan
    //    concepto (1ª, readonly) + currency (editables). v1 lockeado.
    if (fixedRows && fixedRows.length > 0) {
        const conceptCol = columns[0];      // por convención v1
        const editableCols = columns.slice(1);

        const handleCellChange = (rowIdx: number, colKey: string, newRaw: string) => {
            const next = fixedRows.map((rowConcept, i) => {
                const existing = rows[i] ?? {};
                if (i !== rowIdx) {
                    return { ...existing, [conceptCol.key]: rowConcept };
                }
                return { ...existing, [conceptCol.key]: rowConcept, [colKey]: newRaw };
            });
            onChange(field.key, next);
        };

        return (
            <FieldShell field={field} locked={locked} referenceHint={referenceHint} error={error}>
                <div className="overflow-x-auto -mx-1">
                    <table className={baseTableClasses}>
                        <thead>
                            <tr>
                                {columns.map(c => (
                                    <th key={c.key} className={baseHeaderCellClasses}>{c.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {fixedRows.map((rowConcept, rowIdx) => {
                                const rowData = rows[rowIdx] ?? {};
                                return (
                                    <tr key={rowConcept} className="border-b border-slate-100 last:border-b-0">
                                        {/* Columna concepto — precargada, readonly */}
                                        <td className="px-4 py-3 text-sm text-slate-700 font-medium bg-slate-50/50 border-r border-slate-100">
                                            {rowConcept}
                                        </td>
                                        {/* Columnas editables (currency típicamente) */}
                                        {editableCols.map(col => (
                                            <td key={col.key} className="px-2 py-2 border-r border-slate-100 last:border-r-0">
                                                <CurrencyCell
                                                    value={rowData[col.key]}
                                                    locked={locked}
                                                    onChange={(v) => handleCellChange(rowIdx, col.key, v)}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </FieldShell>
        );
    }

    // ── MODO DISPLAY: array de objetos del prefillSnapshot (familyMembers)
    if (rows.length === 0) {
        return (
            <FieldShell field={field} locked={true} referenceHint={referenceHint} error={error}>
                <p className="text-sm italic text-slate-400 px-4 py-6 text-center bg-slate-50 border border-slate-200 rounded-xl">
                    (Sin registros heredados del residente)
                </p>
            </FieldShell>
        );
    }

    return (
        <FieldShell field={field} locked={true} referenceHint={referenceHint} error={error}>
            <div className="overflow-x-auto -mx-1">
                <table className={baseTableClasses}>
                    <thead>
                        <tr>
                            {columns.map(c => (
                                <th key={c.key} className={baseHeaderCellClasses}>{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-100 last:border-b-0 even:bg-slate-50/40">
                                {columns.map(col => (
                                    <td key={col.key} className="px-4 py-3 text-sm text-slate-700 align-top">
                                        {renderDisplayCell(col, row[col.key])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </FieldShell>
    );
}

// ─── Celda currency editable (sub-componente) ────────────────────────────

interface CurrencyCellProps {
    value: unknown;
    locked: boolean;
    onChange: (raw: string) => void;
}

function CurrencyCell({ value, locked, onChange }: CurrencyCellProps) {
    const strValue = value == null || value === '' ? '' : String(value);
    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-base pointer-events-none">$</span>
            <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={strValue}
                onChange={(e) => onChange(e.target.value)}
                disabled={locked}
                placeholder="0.00"
                className={[
                    'w-full min-h-[44px] pl-8 pr-3 py-2 text-base font-mono tabular-nums',
                    'bg-white border border-slate-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600',
                    'transition-colors',
                    locked && 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200',
                ].filter(Boolean).join(' ')}
            />
        </div>
    );
}
