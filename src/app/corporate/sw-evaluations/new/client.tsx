'use client';

/**
 * NewEvaluationClient — UI del flujo "crear evaluación nueva".
 *
 * El server (page.tsx) ya validó: rol, paciente existe, template existe.
 * Si algo falla, `preCheck.ok` es false y este client solo muestra el error.
 * Si todo OK, dispara POST create con patientId + templateId pre-resueltos.
 *
 * Carga: muestra spinner mientras el POST corre (1-2s por joins server-side).
 * Éxito: redirect a /[id]. Error: mensaje con botón Reintentar / Volver.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type State =
    | { kind: 'IDLE' }
    | { kind: 'LOADING' }
    | { kind: 'ERROR'; title: string; detail: string; canRetry: boolean }
    | { kind: 'SUCCESS'; id: string };

interface NewEvaluationClientProps {
    preCheck: { ok: true } | { ok: false; error: string };
    patientId: string | null;
    templateId: string | null;
    patientName: string | null;
}

export default function NewEvaluationClient({
    preCheck, patientId, templateId, patientName,
}: NewEvaluationClientProps) {
    const router = useRouter();
    const [state, setState] = useState<State>({ kind: 'IDLE' });
    const startedRef = useRef(false);

    const handleBack = () => {
        if (patientId) router.push(`/corporate/medical/patients/${patientId}`);
        else router.push('/corporate/social');
    };

    const start = async () => {
        if (!preCheck.ok || !patientId || !templateId) return;
        startedRef.current = true;
        setState({ kind: 'LOADING' });

        try {
            const res = await fetch('/api/corporate/sw-evaluations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId, templateId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.success) {
                setState({
                    kind: 'ERROR',
                    title: 'No se pudo crear el borrador',
                    detail: body?.error || `HTTP ${res.status}`,
                    canRetry: res.status >= 500 || res.status === 0,
                });
                return;
            }
            const id = body?.evaluation?.id ?? body?.id;
            if (!id) {
                setState({
                    kind: 'ERROR',
                    title: 'Respuesta inesperada',
                    detail: 'El servidor creó la evaluación pero no devolvió un ID.',
                    canRetry: false,
                });
                return;
            }
            setState({ kind: 'SUCCESS', id });
            router.replace(`/corporate/sw-evaluations/${id}`);
        } catch (e: any) {
            setState({
                kind: 'ERROR',
                title: 'Error de conexión',
                detail: e?.message ?? 'No se pudo crear el borrador.',
                canRetry: true,
            });
        }
    };

    useEffect(() => {
        if (!preCheck.ok) return; // no-op si server-check falló
        if (startedRef.current) return;
        void start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preCheck.ok]);

    const handleRetry = () => {
        startedRef.current = false;
        void start();
    };

    // ── Pre-check falló: server detectó el error antes de hacer POST ──
    if (!preCheck.ok) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm max-w-md w-full p-8">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 text-xl">⚠</span>
                        <h1 className="text-lg font-black text-slate-800">No se puede crear</h1>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{preCheck.error}</p>
                    <div className="flex items-center justify-end pt-4 mt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
                        >
                            {patientId ? 'Volver al perfil' : 'Volver al dashboard'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Pre-check OK: estamos creando ──
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm max-w-md w-full p-8">
                {(state.kind === 'LOADING' || state.kind === 'IDLE') && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <svg className="w-10 h-10 animate-spin text-teal-600" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
                            <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                        <h1 className="text-lg font-black text-slate-800 text-center">
                            Creando evaluación{patientName ? ` para ${patientName}` : ''}…
                        </h1>
                        <p className="text-sm text-slate-500 text-center max-w-xs leading-relaxed">
                            Esto puede tardar 1-2 segundos mientras agregamos los datos clínicos y familiares del residente.
                        </p>
                    </div>
                )}

                {state.kind === 'ERROR' && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 text-xl">⚠</span>
                            <h1 className="text-lg font-black text-slate-800">{state.title}</h1>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{state.detail}</p>
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleBack}
                                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Volver al perfil
                            </button>
                            {state.canRetry && (
                                <button
                                    type="button"
                                    onClick={handleRetry}
                                    className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
                                >
                                    Reintentar
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {state.kind === 'SUCCESS' && (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 text-2xl">✓</span>
                        <p className="text-sm font-bold text-slate-700">Borrador creado — redirigiendo…</p>
                    </div>
                )}
            </div>
        </div>
    );
}
