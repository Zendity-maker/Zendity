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
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6 font-sans">
            <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-900/20 w-full max-w-6xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight">Cierre de Turno Ocupacional</h2>
                        <p className="text-slate-400 font-medium mt-1">Asistente de Firmas y Despeje de Responsabilidad</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors cursor-pointer">
                        <X size={24} strokeWidth={3} />
                    </button>
                </div>

                {/* Split-View Content */}
                <div className="flex flex-col md:flex-row h-[70vh] bg-slate-50">
                    
                    {/* LEFT COLUMN: CHECKLIST */}
                    <div className="w-full md:w-1/2 p-8 overflow-y-auto border-r border-slate-200 bg-slate-100/50 relative">
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">1</span> 
                            Despeje de Tareas
                        </h3>

                        <div className="space-y-6">
                            {hardBlockers.length > 0 && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center gap-3 text-red-700 mb-4">
                                        <AlertOctagon size={28} />
                                        <h3 className="text-xl font-black uppercase tracking-tight">Bloqueante Crítico</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {hardBlockers.map(block => (
                                            <div key={block.id} className="bg-white p-5 rounded-xl border border-red-100 flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="font-bold text-slate-900 text-lg">{block.title}</p>
                                                    <p className="text-sm text-slate-500">{block.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeWarnings.length > 0 && (
                                <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center gap-3 text-amber-900 mb-4">
                                        <AlertTriangle className="text-amber-500" size={24} />
                                        <h3 className="text-lg font-bold">Justificar Pendientes</h3>
                                    </div>
                                    <div className="space-y-4">
                                        {activeWarnings.map(warn => (
                                            <div key={warn.id} className="bg-slate-50 p-5 rounded-2xl border border-amber-100 flex flex-col gap-4">
                                                <div>
                                                    <p className="font-bold text-slate-800 text-lg">{warn.title}</p>
                                                    <p className="text-sm text-slate-600 font-medium">{warn.description}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => handleQuickResolve(warn.id, "REFUSED")} className="px-5 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-xl transition-all shadow-sm active:scale-95">Paciente Rehusó</button>
                                                    <button onClick={() => handleQuickResolve(warn.id, "ASLEEP")} className="px-5 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-xl transition-all shadow-sm active:scale-95">Durmiendo</button>
                                                    <button onClick={() => handleQuickResolve(warn.id, "TRANSFERRED")} className="px-5 py-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95">
                                                        <span>⇄</span> Transferir
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!isBlocked && (
                                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-4 shadow-sm animate-in zoom-in-95">
                                    <div className="bg-white p-5 rounded-full shadow-md"><CheckCircle className="text-emerald-500" size={56} /></div>
                                    <h3 className="text-3xl font-black text-emerald-900 tracking-tight">Turno Limpio</h3>
                                    <p className="text-emerald-700 font-medium text-xl">Sin deudas clínicas. Puedes firmar.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: SIGNATURE & HANDOVER */}
                    <div className={`w-full md:w-1/2 p-8 overflow-y-auto flex flex-col bg-white transition-opacity duration-500 ${isBlocked ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">2</span> 
                            Firma Digital y Entrega
                        </h3>

                        <div className="flex flex-col h-full gap-6">
                            {/* Zendi Editor */}
                            <div className="bg-slate-50 border border-slate-200 shadow-inner rounded-3xl p-6 flex flex-col flex-grow relative">
                                <div className="absolute top-6 right-6 text-3xl opacity-50">🤖</div>
                                <h3 className="text-slate-400 font-black uppercase tracking-widest text-xs mb-4">Diario Clínico Asíncrono</h3>
                                {isGenerating ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                                        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div>
                                        <span className="font-bold text-lg animate-pulse">Zendi transcribiendo responsabilidades...</span>
                                    </div>
                                ) : (
                                    <textarea 
                                        value={zendiSummary}
                                        onChange={(e) => setZendiSummary(e.target.value)}
                                        readOnly={isBlocked}
                                        className="w-full h-full bg-transparent resize-none outline-none text-slate-700 font-medium text-xl leading-relaxed"
                                    />
                                )}
                            </div>

                            {/* Canvas */}
                            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-6 h-40 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => !isBlocked && setSignature("Firma Registrada " + Date.now())}>
                                {signature ? (
                                    <div className="flex gap-3 text-emerald-600 items-center">
                                        <CheckCircle size={40} /> <span className="font-black text-3xl signature-font italic">Firma Autenticada</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 text-slate-400 items-center">
                                        <PenTool size={36} /> <span className="font-bold text-xl">Tap para Firmar Electrónicamente</span>
                                    </div>
                                )}
                            </div>

                            <label className="flex items-center gap-4 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors shadow-sm">
                                <input type="checkbox" className="w-7 h-7 rounded text-blue-600 focus:ring-blue-500 border-2 border-slate-300" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}/>
                                <span className="font-bold text-blue-900 text-lg leading-tight">Autorizo legalmente este traspaso clínico frente al Estado Libre Asociado.</span>
                            </label>

                            <button 
                                onClick={handleSubmit}
                                disabled={!confirmed || !signature || isSubmitting || isBlocked}
                                className={`w-full py-8 rounded-2xl font-black text-2xl tracking-tight transition-all shadow-xl flex items-center justify-center gap-3
                                    ${(!confirmed || !signature || isSubmitting || isBlocked) ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/30 active:scale-95'}`}
                            >
                                {isSubmitting ? 'SELLANDO BITÁCORA...' : 'ENTREGAR Y CERRAR TURNO AL 100%'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .signature-font { font-family: 'Brush Script MT', cursive; }
            `}} />
        </div>
    );
}
