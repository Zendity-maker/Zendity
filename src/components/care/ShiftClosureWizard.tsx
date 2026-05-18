"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { AlertOctagon, AlertTriangle, CheckCircle, PenTool, Lock, ArrowRight, Loader2, Sparkles, FileText, HelpCircle, X, Eraser } from "lucide-react";

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
    const [showHelp, setShowHelp] = useState(true);
    const sigCanvas = useRef<any>(null);

    const handleSigEnd = () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
        try {
            const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            setSignature(dataUrl);
        } catch {
            // getTrimmedCanvas puede fallar si el trazo es de 0 px;
            // fallback al canvas completo.
            try {
                const dataUrl = sigCanvas.current.toDataURL('image/png');
                setSignature(dataUrl);
            } catch (e) {
                console.error('[ShiftClosureWizard] no se pudo capturar firma', e);
            }
        }
    };

    const handleClearSignature = () => {
        sigCanvas.current?.clear();
        setSignature(null);
    };

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

    // Si cambian las justificaciones mientras ya hay reporte, invalidar y re-pedir.
    // También invalidamos la firma si existía: lo que firmó ya no será el texto final.
    useEffect(() => {
        if (zendiSummary) {
            setZendiSummary('');
            setHasReadReport(false);
            if (signature) {
                setSignature(null);
                sigCanvas.current?.clear();
            }
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
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-800">Cierre de turno</h2>
                            <p className="text-slate-500 font-bold text-sm mt-1 tracking-widest uppercase">Reporte para el próximo equipo</p>
                        </div>
                        {!showHelp && (
                            <button
                                onClick={() => setShowHelp(true)}
                                className="ml-2 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors"
                            >
                                <HelpCircle size={14} /> ¿Cómo funciona?
                            </button>
                        )}
                    </div>
                    <div className="ml-auto flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-[1.5rem] shadow-sm">
                        <Lock size={22} strokeWidth={2.8} />
                        <span className="font-black text-xs md:text-sm uppercase tracking-widest leading-tight max-w-[260px]">
                            Tu turno se cierra cuando firmes este reporte
                        </span>
                    </div>
                </div>

                {/* Banner explicativo — cerrable */}
                {showHelp && (
                    <div className="px-8 md:px-12 py-5 bg-teal-50 border-b border-teal-100 shrink-0">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
                                <HelpCircle size={20} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-black text-teal-900 uppercase tracking-widest mb-2">¿Cómo funciona el cierre?</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-700">
                                    <div className="flex items-start gap-2">
                                        <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                                        <span><strong>Lees y firmas</strong> tu reporte aquí.</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                                        <span>Le llega al <strong>supervisor</strong> para su firma.</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                                        <span>El <strong>próximo turno</strong> lo recibe al entrar.</span>
                                    </div>
                                </div>
                                <p className="mt-3 text-xs text-slate-600 italic">
                                    Si dejas el turno sin firmar este cierre, el sistema descuenta puntos automáticamente.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="text-teal-700 hover:text-teal-900 p-1 rounded-lg hover:bg-teal-100 transition-colors shrink-0"
                                aria-label="Cerrar ayuda"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Split-View Content */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

                    {/* LEFT — Warnings & Blockers */}
                    <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto border-r border-slate-200 custom-scrollbar flex flex-col gap-10 bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Paso 1 — Pendientes de tu turno</h3>
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
                                            <div className="flex flex-col gap-3">
                                                <p className="text-xs text-slate-500 font-semibold border-t border-slate-100 pt-5">¿Qué pasó con esta tarea? Elige una opción:</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <button onClick={() => handleQuickResolve(warn.id, "REFUSED")} className="py-4 px-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-[1.5rem] transition-all active:scale-95 text-center shadow-sm flex flex-col gap-1">
                                                        <span className="font-black text-lg">Rehusó</span>
                                                        <span className="text-[11px] font-medium text-slate-500 leading-tight">El residente no aceptó</span>
                                                    </button>
                                                    <button onClick={() => handleQuickResolve(warn.id, "ASLEEP")} className="py-4 px-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-[1.5rem] transition-all active:scale-95 text-center shadow-sm flex flex-col gap-1">
                                                        <span className="font-black text-lg">Durmió</span>
                                                        <span className="text-[11px] font-medium text-slate-500 leading-tight">Estaba dormido(a)</span>
                                                    </button>
                                                    <button onClick={() => handleQuickResolve(warn.id, "TRANSFERRED")} className="py-4 px-3 bg-slate-900 text-white hover:bg-slate-800 border-2 border-slate-800 rounded-[1.5rem] transition-all active:scale-95 shadow-md flex flex-col gap-1">
                                                        <span className="font-black text-lg flex items-center justify-center gap-2">Trasladar <ArrowRight size={18} strokeWidth={3} /></span>
                                                        <span className="text-[11px] font-medium text-white/70 leading-tight">Que lo haga el próximo turno</span>
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
                                Zendi armó este reporte con lo que tú hiciste hoy: medicamentos, baños, comidas, vitales e incidentes.
                                Léelo completo. Si algo está mal, avisa a tu supervisor <em>antes</em> de firmar.
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
                                    <textarea
                                        value={zendiSummary}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setZendiSummary(next);
                                            // Si edita después de firmar, invalidamos la firma.
                                            // La cuidadora debe volver a leer y firmar lo nuevo.
                                            if (signature) {
                                                setSignature(null);
                                                sigCanvas.current?.clear();
                                            }
                                            if (hasReadReport) setHasReadReport(false);
                                        }}
                                        rows={12}
                                        className="w-full bg-white border border-slate-200 rounded-2xl p-5 max-h-[320px] min-h-[180px] overflow-y-auto custom-scrollbar whitespace-pre-wrap text-slate-800 font-medium text-sm md:text-base leading-relaxed font-sans resize-y focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300"
                                        placeholder="(sin reporte)"
                                    />
                                    <p className="mt-2 text-[11px] text-slate-500 font-medium italic leading-relaxed">
                                        Puedes corregir el texto si algo está mal. Si lo editas después de firmar, tendrás que firmar de nuevo.
                                    </p>
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
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-slate-700 font-black uppercase tracking-widest text-xs flex items-center gap-3">
                                    <PenTool size={16} className="text-teal-600" />
                                    Paso 3 — Firma con el dedo
                                </h3>
                                {signature && (
                                    <button
                                        onClick={handleClearSignature}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors"
                                    >
                                        <Eraser size={12} /> Limpiar
                                    </button>
                                )}
                            </div>
                            <div
                                className={`rounded-[2rem] overflow-hidden transition-all border-4 relative
                                    ${signature ? 'border-emerald-500 bg-emerald-50' : 'border-dashed border-slate-300 bg-white'}
                                `}
                            >
                                {/* línea base sutil tipo papel */}
                                <div className="absolute left-4 right-4 bottom-6 border-b border-dashed border-slate-200 pointer-events-none"></div>
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    penColor="#0F6E56"
                                    onEnd={handleSigEnd}
                                    canvasProps={{ className: 'w-full h-40 cursor-crosshair touch-none' }}
                                />
                                {!signature && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="font-bold text-sm text-slate-400 tracking-tight">
                                            Firma aquí con el dedo o el lápiz
                                        </span>
                                    </div>
                                )}
                            </div>
                            {signature && (
                                <p className="mt-2 text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                                    <CheckCircle size={12} strokeWidth={3} /> Firma registrada
                                </p>
                            )}
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
                            <p className="text-center text-xs text-slate-500 font-medium leading-relaxed -mt-1">
                                Después de firmar, tu reporte se envía al <strong>supervisor</strong>. El próximo cuidador también lo verá al entrar.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
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
