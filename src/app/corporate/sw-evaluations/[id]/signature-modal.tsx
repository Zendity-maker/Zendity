'use client';

/**
 * SignatureApprovalModal — modal con SignaturePad para aprobar la evaluación.
 *
 * Flujo:
 *   1. La TS firma en el canvas.
 *   2. Click "Confirmar y aprobar" → POST /approve con `signatureBase64`.
 *   3. Si OK, dispara `onApproved` (page refresh).
 *   4. Si error (4xx/5xx), muestra mensaje y permite retry.
 *
 * El nombre del firmante + #colegiado los toma el endpoint del usuario
 * autenticado (no se pide acá — evita errors de typo y mantiene el flow
 * rápido).
 */

import { useState } from 'react';
import { SignaturePad } from '@/components/sw-evaluation/SignaturePad';

interface SignatureApprovalModalProps {
    evaluationId: string;
    patientName: string;
    brandPrimary: string;
    onClose: () => void;
    onApproved: () => void;
}

export function SignatureApprovalModal({
    evaluationId,
    patientName,
    brandPrimary,
    onClose,
    onApproved,
}: SignatureApprovalModalProps) {
    const [signature, setSignature] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!signature) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/corporate/sw-evaluations/${evaluationId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureBase64: signature }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.success) {
                setError(body?.error || `Error HTTP ${res.status}`);
                return;
            }
            onApproved();
        } catch (e: any) {
            setError(e?.message ?? 'Error de red');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signature-modal-title"
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="px-6 py-5 border-b border-slate-200">
                    <h2 id="signature-modal-title" className="text-lg font-black text-slate-800">
                        Aprobar evaluación
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Vas a firmar la evaluación inicial de <span className="font-semibold text-slate-700">{patientName}</span>.
                    </p>
                    <p className="text-[12px] text-slate-500 mt-2 leading-relaxed bg-amber-50 border-l-4 border-amber-400 px-3 py-2 rounded-r-lg">
                        ⚠️ Una vez aprobada, los datos quedan inmutables. Cambios posteriores requieren un addendum.
                    </p>
                </header>

                <div className="px-6 py-5 flex-1 overflow-y-auto">
                    {!signature ? (
                        <SignaturePad
                            onAccept={(b64) => {
                                setSignature(b64);
                                setError(null);
                            }}
                            onCancel={onClose}
                        />
                    ) : (
                        <div className="flex flex-col gap-3 items-center">
                            <p className="text-sm font-semibold text-slate-700">Firma capturada — confirma para aprobar.</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={signature}
                                alt="Firma de la Trabajadora Social"
                                className="max-h-32 border border-slate-300 rounded-xl bg-white"
                            />
                            <button
                                type="button"
                                onClick={() => setSignature(null)}
                                className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                            >
                                Volver a firmar
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                            {error}
                        </div>
                    )}
                </div>

                {signature && (
                    <footer className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            style={{ backgroundColor: submitting ? undefined : brandPrimary }}
                            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? 'Aprobando…' : 'Confirmar y aprobar'}
                        </button>
                    </footer>
                )}
            </div>
        </div>
    );
}
