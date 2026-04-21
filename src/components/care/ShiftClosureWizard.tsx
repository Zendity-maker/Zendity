"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle, PenTool, Lock, ArrowRight, Loader2, Sparkles, FileText } from "lucide-react";

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
    shiftSessionId?: string | null;
    onFinalize: (handoverData: any, signatureStr: string) => Promise<boolean>;
    onResolveWarning: (id: string, resolution: string) => Promise<boolean>;
}

type ActivitySummary = {
    medsAdministered: number;
    medsOmittedCount: number;
    mealCount: number;
    bathCount: number;
    vitalCount: number;
    rotations: number;
    fallsCount: number;
    clinicalAlertsCount: number;
};

export default function ShiftClosureWizard({
    isOpen,
    onClose,
    warnings = [],
    hardBlockers = [],
    shiftSessionId = null,
    onFinalize,
    onResolveWarning
}: ShiftClosureWizardProps) {
    const [activeWarnings, setActiveWarnings] = useState<ClosureWarning[]>(warnings);
    const [justifications, setJustifications] = useState<Record<string, string>>({});

    // Reporte Zendi (generado server-side por /api/care/shift/preview)
    const [zendiSummary, setZendiSummary] = useState<string>("");
    const [zendiSource, setZendiSource] = useState<'gpt' | 'fallback' | null>(null);
    const [zendiActivity, setZendiActivity] = useState<ActivitySummary | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // Gate nuevo: la cuidadora debe LEER el reporte antes de firmar.
    const [hasReadReport, setHasReadReport] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        setActiveWarnings(warnings);
    }, [warnings]);

    const isBlocked = hardBlockers.length > 0 || activeWarnings.length > 0;

    // Fetch del reporte real cuando se desbloquea (warnings resueltos + sin hard blockers)
    const fetchPreview = useCallback(async () => {
        if (!shiftSessionId) {
            setPreviewError('Falta identificador del turno — no se puede generar el reporte.');
            return;
        }
        setIsGenerating(true);
        setPreviewError(null);
        setHasReadReport(false);
        try {
            const res = await fetch('/api/care/shift/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shiftSessionId, justifications }),
            });
            const data = await res.json();
            if (!data.success) {
                setPreviewError(data.error || 'No se pudo generar el reporte de Zendi');
                setZendiSummary('');
            } else {
                setZendiSummary(data.aiSummaryReport || '');
                setZendiSource(data.source || null);
                setZendiActivity(data.activity || null);
            }
        } catch (e: any) {
            setPreviewError(e.message || 'Error de conexión con el servidor');
        } finally {
            setIsGenerating(false);
        }
    }, [shiftSessionId, justifications]);

    // Auto-fetch cuando se desbloquea o cuando cambian las justificaciones
    useEffect(() => {
        if (!isOpen || isBlocked) return;
        if (!zendiSummary && !isGenerating && !previewError) {
            fetchPreview();
        }
    }, [isOpen, isBlocked, zendiSummary, isGenerating, previewError, fetchPreview]);

    // Si cambian las justificaciones mientras ya hay reporte, invalidar y re-pedir
    useEffect(() => {
        if (zendiSummary) {
            setZendiSummary('');
            setHasReadReport(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(justifications)]);

    if (!isOpen) return null;

    const handleQuickResolve = async (warningId: string, resolution: string) => {
        setJustifications({ ...justifications, [warningId]: resolution });
        setActiveWarnings(prev => prev.filter(w => w.id !== warningId));
        await onResolveWarning(warningId, resolution);
    };

    const canSign = hasReadReport && !isBlocked && !isGenerating && zendiSummary.length > 0;
    const canSubmit = canSign && confirmed && !!signature && !isSubmitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);
        const success = await onFinalize(
            { justifications, zendiSummary, aiSummaryReport: zendiSummary },
            signature as string,
        );
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 font-sans">
            <div className="bg-slate-50 rounded-[2rem] md:rounded-[3rem] shadow-2xl w-full max-w-[1600px] h-full max-h-[96vh] overflow-hidden flex flex-col animate-in zoom-in-[0.98] duration-300 border border-slate-200">

                {/* Header */}
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
                    <div className="ml-auto flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-[1.5rem] shadow-sm">
                        <Lock size={22} strokeWidth={2.8} />
                        <span className="font-black text-xs md:text-sm uppercase tracking-widest leading-tight max-w-[260px]">
                            Debes leer y firmar tu reporte antes de cerrar tu turno
                        </span>
                    </div>
                </div>

                {/* Split-View Content */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

                    {/* LEFT — Warnings & Blockers */}
                    <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto border-r border-slate-200 custom-scrollbar flex flex-col gap-10 bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Paso 1 — Carga Clínica Restante</h3>
                            <span className="px-4 py-1.5 bg-white border border-slate-200 shadow-sm text-slate-600 rounded-full text-xs font-black uppercase tracking-widest">{hardBlockers.length + activeWarnings.length} Tareas</span>
                        </div>

                        <div className="space-y-8 flex-1">
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

                    {/* RIGHT — Reporte Zendi + Firma */}
                    <div className={`w-full md:w-1/2 p-10 md:p-14 overflow-y-auto flex flex-col bg-white transition-all duration-700 gap-8 ${isBlocked ? 'opacity-30 grayscale pointer-events-none' : ''}`}>

                        {/* Paso 2 — Tu Reporte de Turno */}
                        <div className="flex flex-col relative bg-slate-50 rounded-[2rem] p-6 md:p-8 border border-slate-200 min-h-[340px]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-slate-700 font-black uppercase tracking-widest text-xs flex items-center gap-3">
                                    <FileText size={16} className="text-teal-600" />
                                    Paso 2 — Tu Reporte de Turno
                                </h3>
                                <div className="flex items-center gap-2">
                                    {zendiSource === 'gpt' && (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-widest border border-teal-200">
                                            <Sparkles size={10} /> Zendi AI
                                        </span>
                                    )}
                                    {zendiSource === 'fallback' && (
                                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-200">
                                            Reporte base
                                        </span>
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 font-semibold mb-4 leading-relaxed">
                                Este es el reporte que Zendi generó con los datos reales de tu turno. Léelo completo, confirma que es correcto y luego firma.
                            </p>

                            {isGenerating ? (
                                <div className="flex flex-col items-center justify-center flex-1 gap-4 text-slate-400 min-h-[240px]">
                                    <Loader2 size={36} className="animate-spin text-teal-500" />
                                    <span className="font-bold text-sm uppercase tracking-widest">Zendi está sintetizando tu turno...</span>
                                </div>
                            ) : previewError ? (
                                <div className="flex flex-col gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                                    <p className="text-rose-800 font-bold text-sm">No se pudo generar el reporte.</p>
                                    <p className="text-rose-600 text-xs">{previewError}</p>
                                    <button onClick={fetchPreview} className="mt-2 self-start px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-lg transition-colors">
                                        Reintentar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {zendiActivity && (
                                        <div className="grid grid-cols-4 gap-2 mb-4">
                                            <MiniKpi label="Meds" value={zendiActivity.medsAdministered} />
                                            <MiniKpi label="Baños" value={zendiActivity.bathCount} />
                                            <MiniKpi label="Comidas" value={zendiActivity.mealCount} />
                                            <MiniKpi label="Vitales" value={zendiActivity.vitalCount} />
                                        </div>
                                    )}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 max-h-[320px] overflow-y-auto custom-scrollbar">
                                        <pre className="whitespace-pre-wrap text-slate-800 font-medium text-sm md:text-base leading-relaxed font-sans">{zendiSummary || '(sin reporte)'}</pre>
                                    </div>
                                </>
                            )}

                            {/* Checkbox obligatoria para desbloquear firma */}
                            {!isGenerating && !previewError && zendiSummary && (
                                <label className="mt-5 flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-[1.5rem] cursor-pointer hover:border-teal-300 transition-colors">
                                    <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${hasReadReport ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                                        <CheckCircle size={18} strokeWidth={3} className="fill-current" />
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={hasReadReport}
                                        onChange={e => setHasReadReport(e.target.checked)}
                                    />
                                    <span className="font-bold text-slate-800 text-sm md:text-base leading-snug">
                                        He leído y confirmo que este reporte es correcto
                                    </span>
                                </label>
                            )}
                        </div>

                        {/* Paso 3 — Firma (solo habilitado después de confirmar lectura) */}
                        <div className={`transition-opacity duration-300 ${canSign ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <h3 className="text-slate-700 font-black uppercase tracking-widest text-xs mb-3 flex items-center gap-3">
                                <PenTool size={16} className="text-teal-600" />
                                Paso 3 — Firma
                            </h3>
                            <div
                                className={`rounded-[2rem] p-6 h-40 flex flex-col items-center justify-center cursor-pointer transition-all border-4
                                    ${signature ? 'border-emerald-500 bg-emerald-50 shadow-inner' : 'border-dashed border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}
                                `}
                                onClick={() => canSign && setSignature("Firma Registrada " + Date.now())}
                            >
                                {signature ? (
                                    <div className="flex flex-col gap-2 text-emerald-600 items-center animate-in zoom-in-95">
                                        <CheckCircle size={40} strokeWidth={3} />
                                        <span className="font-bold text-3xl signature-font text-emerald-800">Firma Registrada</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 text-slate-400 items-center transition-colors">
                                        <PenTool size={36} strokeWidth={2.5} className="text-slate-300" />
                                        <span className="font-black text-base text-slate-500 tracking-tight">Toque aquí para firmar electrónicamente</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Controles Finales */}
                        <div className="flex flex-col gap-5 mt-auto">
                            <label className={`flex items-center gap-5 p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] cursor-pointer transition-colors shadow-sm ${canSign ? 'hover:bg-slate-100' : 'opacity-40 pointer-events-none'}`}>
                                <div className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${confirmed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                                    <CheckCircle size={20} strokeWidth={3} className="fill-current" />
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={confirmed}
                                    onChange={e => setConfirmed(e.target.checked)}
                                />
                                <span className="font-bold text-slate-800 text-base md:text-lg leading-snug">
                                    Certifico bajo penalidad normativa que este traspaso es verídico y las rondas fueron ejecutadas.
                                </span>
                            </label>

                            <button
                                onClick={handleSubmit}
                                disabled={!canSubmit}
                                className={`w-full py-6 rounded-[2rem] font-black text-xl md:text-2xl tracking-widest transition-all flex items-center justify-center gap-4
                                    ${!canSubmit
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 active:scale-[0.98]'}`}
                            >
                                {isSubmitting ? 'CERRANDO TURNO...' : 'CONFIRMAR CIERRE DE TURNO'}
                                {!isSubmitting && <CheckCircle size={28} strokeWidth={3} className={!canSubmit ? "opacity-50" : ""} />}
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

function MiniKpi({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-2 text-center">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</div>
            <div className="text-lg font-black text-slate-800">{value}</div>
        </div>
    );
}
