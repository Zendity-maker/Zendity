"use client";

import * as React from "react";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { CheckCircle, PenTool, Eraser, X, Loader2, ExternalLink } from "lucide-react";
import { ExpandableText } from "@/components/ui/ExpandableText";

/**
 * HandoverSignDrawer — drawer para firmar un handover SIN navegar.
 *
 * El supervisor casi nunca firma porque cada handover requiere:
 *   1. Click en "Revisar Reporte"
 *   2. Navegar a /care/reports/[id]
 *   3. Leer el reporte
 *   4. Firmar con dedo en canvas
 *   5. Submit, volver al wall, repetir 51 veces
 *
 * Este drawer reduce 5 pasos a uno solo: abre IN-PLACE, muestra el reporte
 * de Zendi (con ExpandableText si es largo), pad de firma, nota opcional,
 * y submit. Sin perder contexto del wall.
 *
 * Integridad legal preservada: cada firma representa una revisión individual,
 * NO hay bulk-sign. El supervisor firma con su dedo en cada uno.
 *
 * Reusa POST /api/care/reports/[id]/sign (firma fuerte con base64 del canvas).
 *
 * Para casos donde el supervisor necesite ver detalle paciente-por-paciente,
 * fotos, etc., el link "Abrir reporte completo →" lo lleva a la vista clásica.
 */

export interface HandoverSummary {
    id: string;
    outgoingName: string | null;
    shiftType: string;
    colorGroups: string[];
    patientCount: number;
    createdAt: string | Date;
    aiSummaryReport: string | null;
}

interface HandoverSignDrawerProps {
    handover: HandoverSummary | null;
    onClose: () => void;
    /** Callback tras firma exitosa — para refrescar el wall. */
    onSigned: () => void;
}

const COLOR_BADGE: Record<string, string> = {
    RED: "bg-rose-500 text-white",
    YELLOW: "bg-amber-400 text-slate-900",
    GREEN: "bg-emerald-500 text-white",
    BLUE: "bg-sky-500 text-white",
};

const SHIFT_LABEL: Record<string, string> = {
    MORNING: "☀️ Mañana",
    EVENING: "🌆 Tarde",
    NIGHT: "🌙 Noche",
    FULL_NIGHT: "🌙 Guardia",
    SUPERVISOR_DAY: "☀️ Supervisor",
};

export function HandoverSignDrawer({ handover, onClose, onSigned }: HandoverSignDrawerProps) {
    const sigCanvas = useRef<SignatureCanvas | null>(null);
    const [signature, setSignature] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSigEnd = () => {
        try {
            const trimmed = sigCanvas.current?.getTrimmedCanvas();
            if (trimmed && trimmed.width > 0 && trimmed.height > 0) {
                setSignature(trimmed.toDataURL("image/png"));
            }
        } catch (e) {
            console.error("[HandoverSignDrawer] capture signature", e);
        }
    };

    const handleClear = () => {
        sigCanvas.current?.clear();
        setSignature(null);
    };

    const handleSubmit = async () => {
        if (!handover || !signature) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/care/reports/${handover.id}/sign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signature,
                    note: note.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                onSigned();
                onClose();
            } else {
                setError(data.error || "No se pudo firmar el reporte.");
            }
        } catch (e: any) {
            setError(e?.message || "Error de conexión");
        } finally {
            setSubmitting(false);
        }
    };

    // Resetear el estado interno cuando cambie el handover seleccionado
    React.useEffect(() => {
        if (handover) {
            setSignature(null);
            setNote("");
            setError(null);
            try { sigCanvas.current?.clear(); } catch { /* canvas aún no montado */ }
        }
    }, [handover?.id]);

    if (!handover) return null;

    const time = new Date(handover.createdAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" });
    const dateLabel = new Date(handover.createdAt).toLocaleDateString("es-PR", { day: "numeric", month: "short" });
    const shiftLabel = SHIFT_LABEL[handover.shiftType] || handover.shiftType;

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { if (!submitting) onClose(); }}
        >
            <div
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md uppercase tracking-widest">
                                {shiftLabel}
                            </span>
                            {handover.colorGroups.map(c => (
                                <span key={c} className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${COLOR_BADGE[c] || "bg-slate-300 text-slate-800"}`}>
                                    {c}
                                </span>
                            ))}
                            <span className="text-[10px] text-slate-500 font-bold">{dateLabel} · {time}</span>
                        </div>
                        <h2 className="text-lg font-black text-slate-900 leading-tight">
                            Firmar reporte de {handover.outgoingName || "cuidadora"}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {handover.patientCount} residente{handover.patientCount !== 1 ? "s" : ""} cubiertos en este turno
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Body — reporte + nota + firma */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Reporte Zendi */}
                    <div>
                        <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wide mb-2">
                            Reporte de cierre
                        </h3>
                        {handover.aiSummaryReport ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <ExpandableText
                                    text={handover.aiSummaryReport}
                                    previewLines={6}
                                    className="text-sm text-slate-700 leading-relaxed"
                                />
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <p className="text-sm text-amber-800 font-medium">
                                    Este handover no tiene reporte de Zendi. Probablemente fue un cierre forzado o sin actividad.
                                </p>
                            </div>
                        )}
                        <a
                            href={`/care/reports/${handover.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-[var(--color-zendity-teal)] hover:underline"
                        >
                            <ExternalLink className="w-3 h-3" /> Abrir reporte completo en otra pestaña
                        </a>
                    </div>

                    {/* Nota opcional */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide mb-2">
                            Nota del supervisor (opcional)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="Ej: revisé los meds omitidos, coordinado con turno entrante."
                            className="w-full text-sm border-2 border-slate-200 rounded-xl px-3 py-2 focus:border-[var(--color-zendity-teal)] outline-none resize-none"
                            disabled={submitting}
                        />
                    </div>

                    {/* Firma */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <PenTool size={12} /> Tu firma
                            </h3>
                            {signature && (
                                <button
                                    onClick={handleClear}
                                    disabled={submitting}
                                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                                >
                                    <Eraser size={12} /> Limpiar
                                </button>
                            )}
                        </div>
                        <div className={`relative rounded-xl border-2 overflow-hidden ${signature ? "border-emerald-500 bg-emerald-50" : "border-dashed border-slate-300 bg-white"}`}>
                            <SignatureCanvas
                                ref={sigCanvas}
                                penColor="#0F6E56"
                                onEnd={handleSigEnd}
                                canvasProps={{ className: "w-full h-32 cursor-crosshair touch-none" }}
                            />
                            {!signature && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="font-bold text-xs text-slate-400">
                                        Firma aquí con el dedo
                                    </span>
                                </div>
                            )}
                        </div>
                        {signature && (
                            <p className="mt-1.5 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle size={12} /> Firma registrada
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                            <p className="text-sm font-bold text-rose-700">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!signature || submitting}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {submitting ? (
                            <><Loader2 size={14} className="animate-spin" /> Firmando…</>
                        ) : (
                            <><CheckCircle size={14} /> Firmar y publicar</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default HandoverSignDrawer;
