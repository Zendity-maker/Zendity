"use client";

import { useState } from "react";
import { HelpCircle, X, Send, CheckCircle2, Loader2 } from "lucide-react";

type Category = "BUG" | "QUESTION" | "FEATURE" | "URGENT";

const CATEGORIES: { value: Category; label: string; color: string }[] = [
    { value: "QUESTION",  label: "❓ Pregunta",           color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
    { value: "BUG",       label: "🐛 Error del sistema",  color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" },
    { value: "FEATURE",   label: "💡 Solicitar mejora",   color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" },
    { value: "URGENT",    label: "🚨 Urgente",            color: "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" },
];

export default function SupportButton() {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<Category>("QUESTION");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const handleOpen = () => {
        setOpen(true);
        setSent(false);
        setError("");
        setDescription("");
        setCategory("QUESTION");
    };

    const handleClose = () => {
        setOpen(false);
        setSubmitting(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (description.trim().length < 10) {
            setError("Por favor describe el problema con más detalle (mínimo 10 caracteres).");
            return;
        }
        setError("");
        setSubmitting(true);
        try {
            const res = await fetch("/api/support/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, description: description.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setSent(true);
                setDescription("");
                setTimeout(() => handleClose(), 3000);
            } else {
                setError(data.error || "No se pudo enviar el ticket. Intenta de nuevo.");
            }
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/* ── Botón flotante ── */}
            <button
                onClick={handleOpen}
                title="Contactar Soporte Zéndity"
                className="fixed bottom-24 right-6 z-50 w-12 h-12 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"
            >
                <HelpCircle className="w-6 h-6" />
            </button>

            {/* ── Modal ── */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4 duration-300">

                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
                                    <HelpCircle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">Soporte Zéndity</h3>
                                    <p className="text-xs text-slate-500">Respuesta en menos de 24h</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            {sent ? (
                                <div className="flex flex-col items-center py-6 gap-3 text-center">
                                    <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-teal-600" />
                                    </div>
                                    <h4 className="font-bold text-slate-900">¡Ticket enviado!</h4>
                                    <p className="text-sm text-slate-500">
                                        El equipo de Zéndity recibirá tu mensaje y te responderá por email en menos de 24 horas.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Categoría */}
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                            Tipo de consulta
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.value}
                                                    type="button"
                                                    onClick={() => setCategory(cat.value)}
                                                    className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${cat.color} ${
                                                        category === cat.value
                                                            ? "ring-2 ring-teal-400 ring-offset-1"
                                                            : "opacity-70"
                                                    }`}
                                                >
                                                    {cat.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Descripción */}
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                            Descripción del problema
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => { setDescription(e.target.value); setError(""); }}
                                            placeholder="Describe detalladamente el problema o pregunta. Incluye pasos para reproducirlo si es un error…"
                                            rows={4}
                                            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300 transition-all resize-none text-slate-800 placeholder:text-slate-400"
                                        />
                                        {error && (
                                            <p className="text-xs text-red-600 mt-1">{error}</p>
                                        )}
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={submitting || description.trim().length < 10}
                                        className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Enviando…
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Enviar a Soporte
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
