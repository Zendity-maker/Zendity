/**
 * SWEvaluationsSummaryWidget — widget del dashboard /corporate/social (P9).
 *
 * Muestra resumen agregado de SWEvaluation a NIVEL DE SEDE:
 *   - KPI: borradores pendientes (con badge ⚠ si >7d)
 *   - KPI: aprobadas del mes
 *   - Lista breve: borradores más viejos (clic → /[id])
 *   - Lista breve: aprobadas recientes (clic → /[id])
 *
 * Data viene del endpoint /api/corporate/sw-evaluations/summary —
 * HQ-scoped, audited, role-gated.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Summary {
    draftCount: number;
    oldestDraftDays: number | null;
    approvedThisMonthCount: number;
    recentApproved: Array<{
        id: string; patientId: string; patientName: string;
        signerName: string | null; approvedAt: string | null;
    }>;
    oldestDrafts: Array<{
        id: string; patientId: string; patientName: string;
        createdAt: string; createdByName: string | null;
    }>;
}

export default function SWEvaluationsSummaryWidget() {
    const [data, setData] = useState<Summary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch('/api/corporate/sw-evaluations/summary');
                const body = await r.json().catch(() => ({}));
                if (cancelled) return;
                if (!r.ok || !body?.success) {
                    setError(body?.error || `Error ${r.status}`);
                    return;
                }
                setData(body.summary as Summary);
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? 'Error de red');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (error) {
        return (
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-base font-bold text-slate-800 mb-2">Evaluaciones de Trabajo Social</h2>
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            </section>
        );
    }

    if (!data) {
        return (
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <h2 className="text-base font-bold text-slate-800 mb-3">Evaluaciones de Trabajo Social</h2>
                <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
                    <svg className="w-4 h-4 animate-spin text-teal-600" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
                        <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <span>Cargando…</span>
                </div>
            </section>
        );
    }

    const hasNothing = data.draftCount === 0 && data.approvedThisMonthCount === 0 && data.recentApproved.length === 0;
    const showOldestWarn = data.oldestDraftDays !== null && data.oldestDraftDays > 7;

    return (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">Evaluaciones de Trabajo Social</h2>
                <span className="text-[11px] text-slate-400">Nivel de sede</span>
            </header>

            {hasNothing ? (
                <div className="px-5 py-8 text-center">
                    <p className="text-sm text-slate-500">
                        Aún no hay evaluaciones registradas en la sede.
                    </p>
                    <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
                        Las evaluaciones psicosociales se crean desde el perfil del residente, tab "Evaluaciones".
                    </p>
                </div>
            ) : (
                <>
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 py-4 bg-slate-50/60 border-b border-slate-100">
                        <div className="bg-white border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Borradores pendientes</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-2xl font-black ${data.draftCount === 0 ? 'text-slate-400' : 'text-amber-600'}`}>
                                    {data.draftCount}
                                </span>
                                {showOldestWarn && (
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"
                                        title={`Hay un borrador abierto desde hace ${data.oldestDraftDays} días`}
                                    >
                                        ⚠ +{data.oldestDraftDays}d
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Aprobadas este mes</p>
                            <p className={`text-2xl font-black mt-1 ${data.approvedThisMonthCount === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>
                                {data.approvedThisMonthCount}
                            </p>
                        </div>
                    </div>

                    {/* Borradores más viejos */}
                    {data.oldestDrafts.length > 0 && (
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                                Borradores abiertos (más antiguos primero)
                            </h3>
                            <ul className="divide-y divide-slate-100">
                                {data.oldestDrafts.map(d => {
                                    const days = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <li key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-slate-700 truncate">{d.patientName}</p>
                                                <p className="text-[11px] text-slate-500">
                                                    Iniciado {new Date(d.createdAt).toLocaleDateString('es-PR')}
                                                    {d.createdByName && <> · {d.createdByName}</>}
                                                    {' · '}
                                                    <span className={days > 7 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                                                        {days === 0 ? 'hoy' : `hace ${days}d`}
                                                    </span>
                                                </p>
                                            </div>
                                            <Link
                                                href={`/corporate/sw-evaluations/${d.id}`}
                                                className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg text-[12px] font-semibold text-teal-700 border border-teal-300 hover:bg-teal-50 transition-colors"
                                            >
                                                Continuar
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Aprobadas recientes */}
                    {data.recentApproved.length > 0 && (
                        <div className="px-5 py-4">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                                Aprobadas recientes
                            </h3>
                            <ul className="divide-y divide-slate-100">
                                {data.recentApproved.map(a => (
                                    <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-700 truncate">{a.patientName}</p>
                                            <p className="text-[11px] text-slate-500">
                                                {a.approvedAt && new Date(a.approvedAt).toLocaleDateString('es-PR')}
                                                {a.signerName && <> · {a.signerName}</>}
                                            </p>
                                        </div>
                                        <Link
                                            href={`/corporate/sw-evaluations/${a.id}`}
                                            className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg text-[12px] font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition-colors"
                                        >
                                            Ver
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
