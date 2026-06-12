/**
 * PatientEvaluationsTab — tab del perfil del residente que lista las
 * SWEvaluation del residente. P8 SW Eval.
 *
 *   - GET /api/corporate/sw-evaluations?patientId=X (LIST endpoint con audit)
 *   - Render DESC: fecha · autor · badge estado · botón "Ver"
 *   - DEDUP DRAFT: si hay 1+ DRAFT abierto, el CTA principal cambia a
 *     "Continuar borrador del DD/MM" (evita drafts huérfanos).
 *   - Descartar inline: cada DRAFT tiene su propio botón "Descartar".
 *
 * Acentos = Zéndity teal, mismo patrón visual que los otros tabs del perfil.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface EvaluationListItem {
    id: string;
    status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
    createdAt: string;
    updatedAt: string;
    approvedAt: string | null;
    signerName: string | null;
    signerCollegiateNumber: string | null;
    templateName: string;
    templateVersion: number;
    createdByName: string | null;
    addendumCount: number;
}

interface PatientEvaluationsTabProps {
    patientId: string;
}

// ─── Badge de estado ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'BORRADOR',
    APPROVED: 'APROBADO',
    ARCHIVED: 'ARCHIVADO',
};
const STATUS_BG: Record<string, string> = {
    DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ARCHIVED: 'bg-slate-200 text-slate-700 border-slate-300',
};

const ALLOWED_ROLES = new Set(['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN']);

// ─── Component ───────────────────────────────────────────────────────────

export default function PatientEvaluationsTab({ patientId }: PatientEvaluationsTabProps) {
    const router = useRouter();
    const { user } = useAuth();
    const role = user?.role ?? '';
    const canCreate = ALLOWED_ROLES.has(role);

    const [items, setItems] = useState<EvaluationListItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [discardingId, setDiscardingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const fetchList = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch(`/api/corporate/sw-evaluations?patientId=${encodeURIComponent(patientId)}`);
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.success) {
                setError(body?.error || `Error al cargar evaluaciones (HTTP ${res.status}).`);
                setItems([]);
                return;
            }
            setItems(body.evaluations as EvaluationListItem[]);
        } catch (e: any) {
            setError(e?.message ?? 'Error de red');
            setItems([]);
        }
    }, [patientId]);

    useEffect(() => {
        void fetchList();
    }, [fetchList]);

    // DEDUP: si hay un DRAFT, el CTA principal lleva al borrador en lugar de crear nuevo
    const openDraft = items?.find(e => e.status === 'DRAFT') ?? null;

    const handleNew = () => {
        setCreating(true);
        // El page /new hace el POST internamente; tras éxito redirect al [id].
        router.push(`/corporate/sw-evaluations/new?patientId=${encodeURIComponent(patientId)}`);
    };

    const handleContinueDraft = () => {
        if (!openDraft) return;
        router.push(`/corporate/sw-evaluations/${openDraft.id}`);
    };

    const handleDiscard = async (evalId: string) => {
        const target = items?.find(e => e.id === evalId);
        if (!target) return;
        const confirmed = window.confirm(
            `¿Descartar el borrador del ${new Date(target.createdAt).toLocaleDateString('es-PR')}? Esta acción no se puede deshacer.`,
        );
        if (!confirmed) return;
        setDiscardingId(evalId);
        try {
            const res = await fetch(`/api/corporate/sw-evaluations/${evalId}`, { method: 'DELETE' });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.success) {
                alert(`Error al descartar: ${body?.error || `HTTP ${res.status}`}`);
                return;
            }
            await fetchList();
        } catch (e: any) {
            alert(`Error de red: ${e?.message ?? 'unknown'}`);
        } finally {
            setDiscardingId(null);
        }
    };

    // ─── Loading state ──
    if (items === null) {
        return (
            <div className="flex items-center justify-center py-12">
                <svg className="w-6 h-6 animate-spin text-teal-600" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
                    <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span className="ml-3 text-sm text-slate-500">Cargando evaluaciones…</span>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header con CTA contextual */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-base font-bold text-slate-800">Evaluaciones de Trabajo Social</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {items.length === 0
                            ? 'Sin evaluaciones todavía.'
                            : `${items.length} evaluación${items.length === 1 ? '' : 'es'} registrada${items.length === 1 ? '' : 's'}.`}
                    </p>
                </div>
                {canCreate && (
                    openDraft ? (
                        <button
                            type="button"
                            onClick={handleContinueDraft}
                            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
                            title="Hay un borrador abierto — continuá ese en vez de crear uno nuevo."
                        >
                            Continuar borrador del {new Date(openDraft.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: '2-digit' })}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleNew}
                            disabled={creating}
                            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 transition-colors"
                        >
                            {creating ? 'Creando…' : '+ Nueva evaluación'}
                        </button>
                    )
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                    {error}
                </div>
            )}

            {/* Lista */}
            {items.length === 0 && !error && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl px-6 py-10 text-center">
                    <p className="text-sm text-slate-500">
                        No hay evaluaciones registradas para este residente.
                        {canCreate && ' Comenzá creando la primera evaluación inicial.'}
                    </p>
                </div>
            )}

            {items.length > 0 && (
                <ul className="space-y-3">
                    {items.map((e) => (
                        <li key={e.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BG[e.status] ?? STATUS_BG.ARCHIVED}`}>
                                            {STATUS_LABEL[e.status] ?? e.status}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-700 truncate">
                                            {e.templateName} <span className="text-slate-400 font-normal">v{e.templateVersion}</span>
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                        {e.status === 'DRAFT' && (
                                            <>Iniciada {new Date(e.createdAt).toLocaleDateString('es-PR')} por <span className="font-semibold text-slate-700">{e.createdByName ?? 'Sistema'}</span></>
                                        )}
                                        {e.status === 'APPROVED' && e.approvedAt && (
                                            <>Aprobada {new Date(e.approvedAt).toLocaleDateString('es-PR')} por <span className="font-semibold text-slate-700">{e.signerName ?? 'Sistema'}</span>{e.signerCollegiateNumber && <> · #{e.signerCollegiateNumber}</>}</>
                                        )}
                                        {e.status === 'ARCHIVED' && (
                                            <>Archivada · creada {new Date(e.createdAt).toLocaleDateString('es-PR')}</>
                                        )}
                                        {e.addendumCount > 0 && <> · {e.addendumCount} addendum{e.addendumCount === 1 ? '' : 's'}</>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {e.status === 'DRAFT' && canCreate && (
                                        <button
                                            type="button"
                                            onClick={() => handleDiscard(e.id)}
                                            disabled={discardingId === e.id}
                                            className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                            title="Descartar este borrador permanentemente"
                                        >
                                            {discardingId === e.id ? 'Descartando…' : 'Descartar'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/corporate/sw-evaluations/${e.id}`)}
                                        className="min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold text-teal-700 border border-teal-300 hover:bg-teal-50 transition-colors"
                                    >
                                        {e.status === 'DRAFT' ? 'Continuar' : 'Ver'}
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
