"use client";

/**
 * DietPrescription — componente único de prescripción de dieta.
 *
 * Reemplaza los 3 dropdowns que existían pre-Sprint (intake, /care, perfil)
 * con vocabularios incompatibles. Lee y escribe `dietTexture` + 4 flags
 * ortogonales (`dietDiabetic`, `dietLowSodium`, `dietRenal`, `dietVegetarian`).
 *
 * Modo controlado: el padre maneja el estado y onChange. NO hace fetch directo.
 * El padre decide si confirmar via modal antes de guardar o no.
 *
 * Layout: dropdown de textura arriba + checkboxes de modificadores debajo.
 */

import { DietTexture } from '@prisma/client';
import {
    DIET_TEXTURES,
    DIET_TEXTURE_LABELS,
    DIET_TEXTURE_DESC,
    DIET_MODIFIERS,
    DIET_MODIFIER_LABELS,
    DietModifier,
    DietPrescription as DietPrescriptionData,
} from '@/lib/diet';

interface Props {
    value: Partial<DietPrescriptionData>;
    onChange: (next: DietPrescriptionData) => void;
    disabled?: boolean;
    /** Si true, oculta la descripción debajo de cada textura (compact mode) */
    compact?: boolean;
}

export default function DietPrescription({ value, onChange, disabled = false, compact = false }: Props) {
    const current: DietPrescriptionData = {
        dietTexture:    value.dietTexture ?? null,
        dietDiabetic:   value.dietDiabetic ?? false,
        dietLowSodium:  value.dietLowSodium ?? false,
        dietRenal:      value.dietRenal ?? false,
        dietVegetarian: value.dietVegetarian ?? false,
    };

    const setTexture = (t: DietTexture | null) => onChange({ ...current, dietTexture: t });
    const toggleMod = (m: DietModifier) => {
        const next = { ...current };
        const key = ({
            diabetic:   'dietDiabetic',
            lowSodium:  'dietLowSodium',
            renal:      'dietRenal',
            vegetarian: 'dietVegetarian',
        } as const)[m];
        (next as any)[key] = !current[key];
        onChange(next);
    };

    return (
        <div className="space-y-6">
            {/* Textura — dropdown único */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Textura de la dieta
                </label>
                <select
                    value={current.dietTexture ?? ''}
                    onChange={(e) => setTexture(e.target.value === '' ? null : (e.target.value as DietTexture))}
                    disabled={disabled}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    <option value="">— Sin prescribir —</option>
                    {DIET_TEXTURES.map((t) => (
                        <option key={t} value={t}>{DIET_TEXTURE_LABELS[t]}</option>
                    ))}
                </select>
                {!compact && current.dietTexture && (
                    <p className="mt-1 text-xs text-slate-500 italic">
                        {DIET_TEXTURE_DESC[current.dietTexture]}
                    </p>
                )}
            </div>

            {/* Modificadores — checkboxes ortogonales */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Modificadores (opcionales, no excluyentes)
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {DIET_MODIFIERS.map((m) => {
                        const key = ({
                            diabetic:   'dietDiabetic',
                            lowSodium:  'dietLowSodium',
                            renal:      'dietRenal',
                            vegetarian: 'dietVegetarian',
                        } as const)[m];
                        const checked = current[key];
                        return (
                            <label
                                key={m}
                                className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                                    checked
                                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleMod(m)}
                                    disabled={disabled}
                                    className="w-4 h-4 accent-indigo-600"
                                />
                                <span className="text-sm font-bold">{DIET_MODIFIER_LABELS[m]}</span>
                            </label>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
