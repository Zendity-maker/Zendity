"use client";

import { useState } from "react";
import { Send, Sparkles, X } from "lucide-react";

/**
 * Pide a Zendi un borrador de actualización clínica para la familia de ESTE
 * residente, deja editarlo y lo envía.
 *
 * Vive en el expediente y no en /care a propósito. La enfermera del hogar tiene
 * cero turnos abiertos en /care en 96 días: trabaja desde aquí, donde entra 116
 * veces y consulta el historial 372. El widget anterior generaba la tarjeta en
 * una pantalla que ella no pisa, y por eso solo llegaron a existir dos
 * actualizaciones en toda la historia del sistema.
 *
 * El texto es editable. Zendi propone; quien envía decide. Lo que sale queda
 * guardado aparte de lo que Zendi escribió, así que siempre se puede saber si
 * una persona lo cambió.
 */
export default function ActualizarFamiliaButton({
    patientId,
    patientName,
}: {
    patientId: string;
    patientName: string;
}) {
    const [abierto, setAbierto] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [updateId, setUpdateId] = useState<string | null>(null);
    const [opciones, setOpciones] = useState<{ a: string; b: string } | null>(null);
    const [texto, setTexto] = useState("");
    const [contexto, setContexto] = useState("");
    const [error, setError] = useState<string | null>(null);

    const abrir = async () => {
        setAbierto(true);
        setError(null);
        setOpciones(null);
        setTexto("");
        setGenerando(true);
        try {
            const res = await fetch("/api/care/zendi/nursing-updates/borrador", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId }),
            });
            const d = await res.json();
            if (!d.success) {
                setError(d.error || "No se pudo generar el borrador.");
                return;
            }
            setUpdateId(d.update.id);
            setOpciones({ a: d.update.optionGen1, b: d.update.optionGen2 });
            setTexto(d.update.optionGen1);
            setContexto(d.contexto || "");
        } catch {
            setError("No se pudo generar el borrador. Intenta de nuevo.");
        } finally {
            setGenerando(false);
        }
    };

    const enviar = async () => {
        if (!updateId || !texto.trim() || enviando) return;
        setEnviando(true);
        try {
            const res = await fetch(`/api/care/zendi/nursing-updates/${updateId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ACCEPT", selectedOption: texto.trim() }),
            });
            const d = await res.json();
            if (!d.success) {
                setError(d.error || "No se pudo enviar.");
                return;
            }
            setAbierto(false);
        } catch {
            setError("No se pudo enviar. Intenta de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    const descartar = async () => {
        if (updateId) {
            // Se declina en el servidor para no dejar el borrador colgado en
            // PENDING. Los momentos de Zendi acumularon 560 asi.
            await fetch(`/api/care/zendi/nursing-updates/${updateId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "DECLINE" }),
            }).catch(() => null);
        }
        setAbierto(false);
    };

    return (
        <>
            <button
                onClick={abrir}
                className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm"
                title="Zendi redacta una actualización con los datos clínicos de la semana; tú la editas antes de enviarla"
            >
                <Send className="w-5 h-5" /> Actualizar a la Familia
            </button>

            {abierto && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between p-6 border-b border-slate-100">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-teal-700 mb-1">Zéndity Academy · Zendi</p>
                                <h3 className="text-xl font-black text-slate-800">Actualización para la familia</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{patientName}</p>
                            </div>
                            <button onClick={descartar} className="text-slate-400 hover:text-slate-700 p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {generando && (
                                <div className="flex items-center gap-3 text-slate-500 font-medium py-8 justify-center">
                                    <Sparkles className="w-5 h-5 animate-pulse text-teal-500" />
                                    Zendi está leyendo el expediente de la semana…
                                </div>
                            )}

                            {error && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {opciones && !generando && (
                                <>
                                    {contexto && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                                                En qué se basa
                                            </p>
                                            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">{contexto}</pre>
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                                            Empezar desde
                                        </p>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {([['Opción 1', opciones.a], ['Opción 2', opciones.b]] as const).map(([et, val]) => (
                                                <button
                                                    key={et}
                                                    onClick={() => setTexto(val)}
                                                    className={`text-left p-3 rounded-xl border text-sm transition-all ${texto === val ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}
                                                >
                                                    <span className="block text-[10px] font-black uppercase tracking-wider opacity-60 mb-1">{et}</span>
                                                    {val}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-baseline justify-between mb-2">
                                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                                                Mensaje que se enviará
                                            </p>
                                            <span className={`text-xs font-bold ${texto.length > 1200 ? 'text-rose-600' : 'text-slate-400'}`}>
                                                {texto.length}/1200
                                            </span>
                                        </div>
                                        <textarea
                                            value={texto}
                                            onChange={(e) => setTexto(e.target.value)}
                                            rows={6}
                                            className="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                                        />
                                        <p className="text-xs text-slate-400 mt-2">
                                            Edítalo como entiendas. Lo que escribas aquí es lo que recibe la familia.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {opciones && !generando && (
                            <div className="flex gap-3 p-6 border-t border-slate-100">
                                <button
                                    onClick={descartar}
                                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                                >
                                    Ahora no
                                </button>
                                <button
                                    onClick={enviar}
                                    disabled={enviando || !texto.trim() || texto.length > 1200}
                                    className="flex-[2] px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-lg shadow-teal-600/20 transition-colors disabled:opacity-50"
                                >
                                    {enviando ? "Enviando…" : "Enviar a la familia"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
