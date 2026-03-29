"use client";

import React, { useState, useEffect } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle, PenTool, X, ArrowRight } from "lucide-react";

export interface ClosureWarning {
    id: string;
    type: string;
    title: string;
    description: string;
}

export interface HardBlocker {
    id: string;
    type: string;
    title: string;
    description: string;
}

interface ShiftClosureWizardProps {
    isOpen: boolean;
    onClose: () => void;
    warnings?: ClosureWarning[];
    hardBlockers?: HardBlocker[];
    onFinalize: (handoverData: any, signatureStr: string) => Promise<boolean>;
    onResolveWarning: (id: string, resolution: string) => Promise<boolean>;
}

export default function ShiftClosureWizard({ 
    isOpen, 
    onClose, 
    warnings = [], 
    hardBlockers = [], 
    onFinalize,
    onResolveWarning 
}: ShiftClosureWizardProps) {
    const [activeWarnings, setActiveWarnings] = useState<ClosureWarning[]>(warnings);
    const [justifications, setJustifications] = useState<Record<string, string>>({}); 
    
    // Zendi Auto-generation Mock
    const [zendiSummary, setZendiSummary] = useState<string>("Generando síntesis clínica...");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        setActiveWarnings(warnings);
    }, [warnings]);

    const isBlocked = hardBlockers.length > 0 || activeWarnings.length > 0;

    useEffect(() => {
        if (!isBlocked && zendiSummary === "Generando síntesis clínica...") {
            setIsGenerating(true);
            setTimeout(() => {
                let summary = "Zendi AI Digest: El turno cerró de manera regular.\n\n";
                if (Object.keys(justifications).length > 0) {
                    summary += "Pendientes Justificados/Transferidos:\n";
                    Object.entries(justifications).forEach(([id, reason]) => {
                        summary += `• Elemento ${id}: ${reason}\n`;
                    });
                } else {
                    summary += "• Sin tareas atrasadas o transferidas.\n";
                }
                setZendiSummary(summary);
                setIsGenerating(false);
            }, 1200);
        }
    }, [isBlocked, justifications, zendiSummary]);

    if (!isOpen) return null;

    const handleQuickResolve = async (warningId: string, resolution: string) => {
        setJustifications({...justifications, [warningId]: resolution});
        setActiveWarnings(prev => prev.filter(w => w.id !== warningId));
        await onResolveWarning(warningId, resolution);
        setZendiSummary("Generando síntesis clínica...");
    };

    const handleSubmit = async () => {
        if (!confirmed || !signature) return;
        setIsSubmitting(true);
        const success = await onFinalize({ justifications, zendiSummary }, signature);
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 font-sans">
            <div className="bg-slate-50 rounded-[2rem] md:rounded-[3rem] shadow-2xl w-full max-w-[1600px] h-full max-h-[96vh] overflow-hidden flex flex-col animate-in zoom-in-[0.98] duration-300 border border-slate-200">
                
                {/* Header Premium Claro */}
                <div className="px-8 md:px-12 py-8 border-b border-slate-200 flex justify-between items-center bg-white z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-sm">
                            <CheckCircle size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-800">Cierre Operativo</h2>
                            <p className="text-slate-500 font-bold text-sm mt-1 tracking-widest uppercase">Traspaso de Guardia Validado</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-[1.5rem] transition-all cursor-pointer active:scale-95 shadow-sm ml-auto flex items-center gap-3">
                        <span className="font-bold text-sm uppercase px-2 hidden md:block tracking-widest">Posponer</span>
                        <X size={28} strokeWidth={3} />
                    </button>
                </div>

                {/* Split-View Content (iPad Landscape Optimized) */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* LEFT COLUMN: CONTROL DE ESTADOS (WARNINGS & BLOCKERS) */}
                    <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto border-r border-slate-200 custom-scrollbar flex flex-col gap-10 bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Carga Clínica Restante</h3>
                            <span className="px-4 py-1.5 bg-white border border-slate-200 shadow-sm text-slate-600 rounded-full text-xs font-black uppercase tracking-widest">{hardBlockers.length + activeWarnings.length} Tareas</span>
                        </div>

                        <div className="space-y-8 flex-1">
                            {/* HARD BLOCKERS */}
                            {hardBlockers.length > 0 && (
                                <div className="space-y-6">
                                    <h4 className="font-black text-rose-700 text-sm uppercase tracking-widest flex items-center gap-3">
                                        <AlertOctagon size={20} strokeWidth={3} /> Bloqueos Críticos
                                    </h4>
                                    {hardBlockers.map(block => (
                                        <div key={block.id} className="bg-white p-8 rounded-[2rem] border-y border-r border-slate-200 border-l-[8px] border-l-rose-500 shadow-sm flex items-start gap-6">
                                            <div className="bg-rose-50 p-4 rounded-[1.5rem] text-rose-600 shrink-0">
                                                <AlertOctagon size={32} strokeWidth={2.5} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-900 text-xl leading-tight mb-2">{block.title}</p>
                                                <p className="text-base text-slate-500 font-medium">{block.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-[1.5rem] text-center">
                                        <p className="text-rose-700 font-bold text-sm uppercase tracking-widest">Resuelva en Triage Central para Proceder</p>
                                    </div>
                                </div>
                            )}

                            {/* WARNINGS - ACCIONES RÁPIDAS */}
                            {activeWarnings.length > 0 && (
                                <div className="space-y-6">
                                    <h4 className="font-black text-amber-700 text-sm uppercase tracking-widest flex items-center gap-3">
                                        <AlertTriangle size={20} strokeWidth={3} /> Decisiones Requeridas
                                    </h4>
                                    {activeWarnings.map(warn => (
                                        <div key={warn.id} className="bg-white p-8 rounded-[2rem] border-y border-r border-slate-200 border-l-[8px] border-l-amber-400 shadow-sm flex flex-col gap-8">
                                            <div>
                                                <p className="font-black text-slate-900 text-2xl leading-tight mb-2">{warn.title}</p>
                                                <p className="text-base text-slate-500 font-medium">{warn.description}</p>
                                            </div>
                                            
                                            <div className="flex flex-col gap-4">
                                                <div className="border-t border-slate-100 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <button onClick={() => handleQuickResolve(warn.id, "REFUSED")} className="py-5 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-lg rounded-[1.5rem] transition-all active:scale-95 text-center shadow-sm">
                                                        Rehusó
                                                    </button>
                                                    <button onClick={() => handleQuickResolve(warn.id, "ASLEEP")} className="py-5 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-lg rounded-[1.5rem] transition-all active:scale-95 text-center shadow-sm">
                                                        Durmió
                                                    </button>
                                                    <button onClick={() => handleQuickResolve(warn.id, "TRANSFERRED")} className="py-5 bg-slate-900 text-white hover:bg-slate-800 border-2 border-slate-800 font-black text-lg rounded-[1.5rem] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-md">
                                                        Trasladar <ArrowRight size={20} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ESTADO LIMPIO */}
                            {!isBlocked && (
                                <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center gap-6 shadow-sm min-h-[400px]">
                                    <div className="bg-emerald-50 text-emerald-600 p-8 rounded-full mb-2">
                                        <CheckCircle size={64} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-4xl font-black text-slate-800 tracking-tight">Estado Limpio</h3>
                                    <p className="text-slate-500 font-medium text-xl max-w-sm">
                                        Todas las responsabilidades directas fueron atendidas o trasladadas exitosamente.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: ZENDI DIGEST & SIGNATURE */}
                    <div className={`w-full md:w-1/2 p-10 md:p-14 overflow-y-auto flex flex-col bg-white transition-all duration-700 gap-10 ${isBlocked ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                        
                        {/* Zendi Editor */}
                        <div className="flex flex-col relative bg-slate-50 rounded-[2rem] p-8 border border-slate-200 min-h-[260px]">
                            <h3 className="text-slate-500 font-black uppercase tracking-widest text-xs mb-6 flex items-center justify-between">
                                <span className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-teal-400"></div> 
                                    Bitácora de Salida Automática
                                </span>
                                <span className="text-2xl grayscale opacity-40">🤖</span>
                            </h3>

                            {isGenerating ? (
                                <div className="flex flex-col items-center justify-center flex-1 gap-5 text-slate-400">
                                    <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-teal-500 animate-spin"></div>
                                    <span className="font-bold text-sm uppercase tracking-widest animate-pulse">Sintetizando Turno...</span>
                                </div>
                            ) : (
                                <textarea 
                                    value={zendiSummary}
                                    onChange={(e) => setZendiSummary(e.target.value)}
                                    readOnly={isBlocked}
                                    className="w-full flex-1 bg-transparent text-slate-700 font-medium text-lg md:text-xl leading-relaxed resize-none focus:outline-none"
                                />
                            )}
                        </div>

                        {/* Firma Electrónica */}
                        <div 
                            className={`rounded-[2.5rem] p-8 h-56 flex flex-col items-center justify-center cursor-pointer transition-all border-4 
                                ${signature ? 'border-emerald-500 bg-emerald-50 shadow-inner' : 'border-dashed border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}
                            `}
                            onClick={() => !isBlocked && setSignature("Firma Registrada " + Date.now())}
                        >
                            {signature ? (
                                <div className="flex flex-col gap-3 text-emerald-600 items-center animate-in zoom-in-95">
                                    <CheckCircle size={48} strokeWidth={3} /> 
                                    <span className="font-bold text-4xl signature-font text-emerald-800">Firma Registrada</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5 text-slate-400 items-center transition-colors">
                                    <PenTool size={48} strokeWidth={2.5} className="text-slate-300" /> 
                                    <span className="font-black text-xl text-slate-500 tracking-tight">Toque Aquí Para Firmar Electrónicamente</span>
                                </div>
                            )}
                        </div>

                        {/* Controles Finales */}
                        <div className="flex flex-col gap-6 mt-auto">
                            <label className="flex items-center gap-6 p-6 md:p-8 bg-slate-50 border border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-100 transition-colors shadow-sm group">
                                <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-colors ${confirmed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-transparent group-hover:border-slate-400'}`}>
                                    <CheckCircle size={24} strokeWidth={3} className="fill-current" />
                                </div>
                                {/* Hide underlying checkbox, drive by div visually */}
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={confirmed} 
                                    onChange={(e) => setConfirmed(e.target.checked)}
                                />
                                <span className="font-bold text-slate-800 text-lg md:text-xl leading-snug">
                                    Certifico bajo penalidad normativa que este traspaso es verídico y las rondas fueron ejecutadas.
                                </span>
                            </label>

                            <button 
                                onClick={handleSubmit}
                                disabled={!confirmed || !signature || isSubmitting || isBlocked}
                                className={`w-full py-8 rounded-[2.5rem] font-black text-2xl tracking-widest transition-all flex items-center justify-center gap-4
                                    ${(!confirmed || !signature || isSubmitting || isBlocked) 
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 active:scale-[0.98]'}`}
                            >
                                {isSubmitting ? 'CERRANDO TURNO...' : 'CONFIRMAR CIERRE DE TURNO'}
                                {!isSubmitting && <CheckCircle size={32} strokeWidth={3} className={(!confirmed || !signature || isBlocked) ? "opacity-50" : ""} />}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .signature-font { font-family: 'Brush Script MT', cursive, sans-serif; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
            `}} />
        </div>
    );
}
