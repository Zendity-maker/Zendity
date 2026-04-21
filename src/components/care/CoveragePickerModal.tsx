"use client";

import React, { useMemo, useState } from "react";
import { X, Users, AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export interface CoverageColorOption {
    color: string;
    patientsCount: number;
    status: 'absent' | 'already_redistributed' | 'covered';
    coveredBy?: string | null; // nombre del cuidador que ya lo cubre
    redistributedTo?: string[]; // nombres si ya se repartió entre otros
}

interface CoveragePickerModalProps {
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    options: CoverageColorOption[];
    submitting?: boolean;
    onClose: () => void;
    onSelect: (colors: string[]) => void;
}

const COLOR_BG: Record<string, string> = {
    RED: 'bg-red-500',
    YELLOW: 'bg-amber-500',
    GREEN: 'bg-emerald-500',
    BLUE: 'bg-blue-500',
};

const COLOR_LABEL: Record<string, string> = {
    RED: 'Rojo',
    YELLOW: 'Amarillo',
    GREEN: 'Verde',
    BLUE: 'Azul',
};

export default function CoveragePickerModal({
    isOpen,
    title = '¿Qué grupo vas a cubrir hoy?',
    subtitle = 'Selecciona el grupo de residentes que atenderás.',
    options,
    submitting = false,
    onClose,
    onSelect,
}: CoveragePickerModalProps) {
    const [selectedColors, setSelectedColors] = useState<string[]>([]);

    const absentColors = useMemo(
        () => options.filter(o => o.status === 'absent' || o.status === 'already_redistributed'),
        [options]
    );

    if (!isOpen) return null;

    const toggle = (color: string) => {
        setSelectedColors(prev =>
            prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
        );
    };

    const selectAllAbsent = () => {
        setSelectedColors(absentColors.map(o => o.color));
    };

    const canSubmit = selectedColors.length > 0 && !submitting;

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-200 flex items-start justify-between bg-gradient-to-br from-teal-50 to-white">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                            <Sparkles size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 leading-tight">{title}</h2>
                            <p className="text-sm text-slate-500 font-semibold mt-1">{subtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        disabled={submitting}
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Lista de colores */}
                <div className="p-6 md:p-8 space-y-3 max-h-[60vh] overflow-y-auto">
                    {absentColors.length === 0 && (
                        <div className="text-center py-10 text-slate-500">
                            <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
                            <p className="font-bold text-slate-700">Todos los grupos están cubiertos</p>
                            <p className="text-sm font-medium text-slate-500 mt-1">No hay residentes sin cuidador asignado.</p>
                        </div>
                    )}

                    {absentColors.map(opt => {
                        const isSelected = selectedColors.includes(opt.color);
                        const wasRedistributed = opt.status === 'already_redistributed';
                        return (
                            <button
                                key={opt.color}
                                onClick={() => toggle(opt.color)}
                                disabled={submitting}
                                className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-5 ${
                                    isSelected
                                        ? 'border-teal-500 bg-teal-50 shadow-md'
                                        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'
                                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className={`w-14 h-14 rounded-2xl ${COLOR_BG[opt.color] || 'bg-slate-400'} shadow-sm shrink-0 flex items-center justify-center text-white font-black text-xs tracking-widest`}>
                                    {COLOR_LABEL[opt.color]?.charAt(0).toUpperCase() || opt.color.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-900 text-lg">{COLOR_LABEL[opt.color] || opt.color}</span>
                                        {wasRedistributed ? (
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                                Redistribuido
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                                                Sin cuidador
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 font-semibold mt-0.5">
                                        {opt.patientsCount} residentes en este grupo
                                    </p>
                                    {wasRedistributed && opt.redistributedTo && opt.redistributedTo.length > 0 && (
                                        <p className="text-xs text-slate-500 mt-1 font-medium">
                                            Redistribuido entre: <span className="text-slate-700">{opt.redistributedTo.join(', ')}</span>
                                            <span className="text-amber-700"> — al seleccionar los tomas de vuelta</span>
                                        </p>
                                    )}
                                </div>
                                <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                    {isSelected && <CheckCircle2 size={18} strokeWidth={3} />}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 md:px-8 py-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    {absentColors.length > 1 && (
                        <button
                            onClick={selectAllAbsent}
                            disabled={submitting}
                            className="px-4 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                        >
                            <Users size={16} />
                            Cubrir todos los sin asignar
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onSelect(selectedColors)}
                        disabled={!canSubmit}
                        className={`px-6 py-3 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
                            canSubmit
                                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md active:scale-95'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {submitting ? <><Loader2 size={16} className="animate-spin" /> Asignando...</> : <><CheckCircle2 size={16} /> Confirmar cobertura ({selectedColors.length})</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
