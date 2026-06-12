'use client';

/**
 * AddendumPanel — visible solo en APPROVED.
 * Lista los addendums existentes + form para agregar uno nuevo.
 *
 *   reason     → string obligatorio (trazabilidad)
 *   content    → texto libre, va al body como string
 *   signature  → opcional via SignaturePad
 */

import { useState } from 'react';
import { SignaturePad } from '@/components/sw-evaluation/SignaturePad';

interface AddendumPanelProps {
    evaluationId: string;
    existingAddendums: Array<{
        id: string;
        content: unknown;
        reason: string;
        createdAt: string;
        createdByName: string | null;
    }>;
    onCreated: () => void;
}

export function AddendumPanel({ evaluationId, existingAddendums, onCreated }: AddendumPanelProps) {
    const [showForm, setShowForm] = useState(false);
    const [reason, setReason] = useState('');
    const [content, setContent] = useState('');
    const [signature, setSignature] = useState<string | null>(null);
    const [showPad, setShowPad] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = reason.trim().length > 0 && content.trim().length > 0;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/corporate/sw-evaluations/${evaluationId}/addendum`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: reason.trim(),
                    content: content.trim(),
                    ...(signature ? { signatureBase64: signature } : {}),
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.success) {
                setError(body?.error ?? `Error HTTP ${res.status}`);
                return;
            }
            // Reset form
            setReason('');
            setContent('');
            setSignature(null);
            setShowForm(false);
            onCreated();
        } catch (e: any) {
            setError(e?.message ?? 'Error de red');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
            <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">
                    Addendums {existingAddendums.length > 0 && <span className="text-slate-400">({existingAddendums.length})</span>}
                </h2>
                {!showForm && (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="min-h-[40px] px-4 py-2 rounded-xl text-sm font-semibold text-teal-700 border border-teal-300 hover:bg-teal-50 transition-colors"
                    >
                        + Agregar addendum
                    </button>
                )}
            </header>

            <div className="px-6 py-5 space-y-5">
                {existingAddendums.length === 0 && !showForm && (
                    <p className="text-sm text-slate-500 italic text-center py-4">
                        Sin addendums todavía.
                    </p>
                )}

                {existingAddendums.length > 0 && (
                    <ul className="space-y-4">
                        {existingAddendums.map(a => (
                            <li key={a.id} className="border-l-4 border-teal-400 pl-4 py-1">
                                <p className="text-sm font-semibold text-slate-700">{a.reason}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {a.createdByName ?? 'Sistema'} ·{' '}
                                    {new Date(a.createdAt).toLocaleString('es-PR', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </p>
                                <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
                                    {typeof a.content === 'string' ? a.content : JSON.stringify(a.content, null, 2)}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}

                {showForm && (
                    <div className="border-t border-slate-200 pt-5 space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-slate-700" htmlFor="add-reason">
                                Razón del addendum
                            </label>
                            <input
                                id="add-reason"
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="ej. Cambio en necesidades de equipo asistivo"
                                className="w-full bg-white text-base text-slate-800 placeholder-slate-400 border border-slate-300 rounded-xl px-4 py-3 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-colors"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-slate-700" htmlFor="add-content">
                                Contenido
                            </label>
                            <textarea
                                id="add-content"
                                rows={4}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Detalle del addendum…"
                                className="w-full bg-white text-base text-slate-800 placeholder-slate-400 border border-slate-300 rounded-xl px-4 py-3 min-h-[120px] resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-colors"
                            />
                        </div>

                        {signature ? (
                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                <span className="text-emerald-700 font-bold">✓ Firma capturada</span>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={signature} alt="firma" className="h-10 border border-emerald-300 rounded bg-white" />
                                <button
                                    type="button"
                                    onClick={() => setSignature(null)}
                                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                                >
                                    Re-firmar
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowPad(s => !s)}
                                className="self-start text-[12px] font-semibold text-teal-700 hover:text-teal-800 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors"
                            >
                                {showPad ? '✕ Cancelar firma' : '🖋️ Firmar (opcional)'}
                            </button>
                        )}

                        {showPad && !signature && (
                            <SignaturePad
                                onAccept={(b64) => {
                                    setSignature(b64);
                                    setShowPad(false);
                                }}
                                onCancel={() => setShowPad(false)}
                            />
                        )}

                        {error && (
                            <div className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setReason(''); setContent(''); setSignature(null); setError(null); }}
                                disabled={submitting}
                                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!canSubmit || submitting}
                                className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitting ? 'Guardando…' : 'Guardar addendum'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
