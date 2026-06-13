'use client';

/**
 * EvaluationPageClient — UI de la evaluación (P5).
 *
 * Combina:
 *   - SWEvaluationFormRenderer (mode-aware lock)
 *   - useAutosaveEvaluation (DRAFT, debounce 2s, PUT /[id])
 *   - SignatureApprovalModal (DRAFT → APPROVED)
 *   - Addendum panel (APPROVED)
 *   - PDF download (cualquier estado)
 *
 * Sticky top bar: brand del tenant + paciente + estado + AutosaveIndicator +
 * botones contextuales por estado.
 *
 * Acentos = Zéndity teal #0F6B78. Logo + nombre del tenant SOLO en el header.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SWEvaluationFormRenderer } from '@/components/sw-evaluation/SWEvaluationFormRenderer';
import { AutosaveIndicator } from '@/components/sw-evaluation/AutosaveIndicator';
import { useAutosaveEvaluation } from '@/lib/sw-evaluation/use-autosave-evaluation';
import { SignatureApprovalModal } from './signature-modal';
import { AddendumPanel } from './addendum-panel';
import type {
    EvaluationFormData,
    EvaluationPrefillSnapshot,
    RendererMode,
} from '@/lib/sw-evaluation/ui-types';
import type { SWFormTemplateSchema } from '@/lib/sw-evaluation/template-types';

// ─── Props del page server ───────────────────────────────────────────────

interface EvaluationPageClientProps {
    evaluation: {
        id: string;
        status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
        createdAt: string;
        approvedAt: string | null;
        signerName: string | null;
        signerCollegiateNumber: string | null;
    };
    schema: SWFormTemplateSchema;
    initialData: EvaluationFormData;
    prefillSnapshot: EvaluationPrefillSnapshot;
    patient: { id: string; name: string; roomNumber: string | null };
    hq: {
        name: string;
        brandName: string | null;
        brandPrimary: string | null;
        logoUrl: string | null;
    };
    currentUser: { role: string; hasCollegiateNumber: boolean };
    addendums: Array<{
        id: string;
        content: unknown;
        reason: string;
        createdAt: string;
        createdByName: string | null;
    }>;
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

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATUS_BG[status] ?? STATUS_BG.ARCHIVED}`}>
            {STATUS_LABEL[status] ?? status}
        </span>
    );
}

// ─── Componente ──────────────────────────────────────────────────────────

export default function EvaluationPageClient({
    evaluation,
    schema,
    initialData,
    prefillSnapshot,
    patient,
    hq,
    addendums,
}: EvaluationPageClientProps) {
    const router = useRouter();
    const mode: RendererMode = evaluation.status;
    const [data, setData] = useState<EvaluationFormData>(initialData);
    const [showSignature, setShowSignature] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [discarding, setDiscarding] = useState(false);

    const autosave = useAutosaveEvaluation({
        evaluationId: evaluation.id,
        data,
        mode,
        schema,
    });

    const handleChange = (key: string, value: unknown) => {
        setData((prev) => ({ ...prev, [key]: value }));
    };

    // Antes de abrir el modal de firma: flush sincrónico para no perder
    // la última edición. Si flush falla, NO abrir modal — el usuario debe
    // ver el ERROR y arreglar antes de aprobar.
    const handleOpenSignature = async () => {
        if (autosave.status === 'ERROR') {
            // Forzamos al usuario a resolver el error primero
            alert('Hay un error al guardar — corrige antes de aprobar.');
            return;
        }
        try {
            await autosave.flushNow();
        } catch {
            // El hook ya marca ERROR — no abrimos modal
            return;
        }
        // Si después del flush quedó en ERROR, abortar
        // (race: el flush dejó status en SAVED o IDLE si OK)
        setShowSignature(true);
    };

    const handleApproved = () => {
        setShowSignature(false);
        // Re-fetch desde server para tener el snapshot fresh + addendums
        router.refresh();
    };

    // Descartar borrador — DELETE /[id]. Solo aplica DRAFT.
    // Redirect al perfil del paciente tras éxito (mantiene el contexto donde
    // la TS estaba parada antes de crear la eval).
    const handleDiscardDraft = async () => {
        if (mode !== 'DRAFT') return;
        const confirmed = window.confirm(
            `¿Descartar el borrador de ${patient.name}? Esta acción no se puede deshacer y se perderán todos los cambios sin guardar.`,
        );
        if (!confirmed) return;
        setDiscarding(true);
        try {
            const res = await fetch(`/api/corporate/sw-evaluations/${evaluation.id}`, { method: 'DELETE' });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.success) {
                alert(`Error al descartar: ${body?.error || `HTTP ${res.status}`}`);
                setDiscarding(false);
                return;
            }
            // Redirect al perfil del paciente
            router.push(`/corporate/medical/patients/${patient.id}`);
        } catch (e: any) {
            alert(`Error de red descartando: ${e?.message ?? 'unknown'}`);
            setDiscarding(false);
        }
    };

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            const res = await fetch(`/api/corporate/sw-evaluations/${evaluation.id}/pdf`, {
                method: 'GET',
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                alert(`Error descargando PDF: ${errBody.error ?? res.status}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = new Date().toISOString().slice(0, 10);
            a.download = `EvalSocial_${patient.name.replace(/[^a-zA-Z0-9]/g, '_')}_${ts}_${evaluation.status.toLowerCase()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert(`Error de red descargando PDF: ${e?.message ?? 'unknown'}`);
        } finally {
            setPdfLoading(false);
        }
    };

    const brandPrimary = hq.brandPrimary || '#0F6B78';
    const tenantName = hq.brandName || hq.name;

    return (
        <div className="min-h-screen bg-slate-100">
            {/* ── Sticky top bar ── */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-3">
                    {/* Brand del tenant — solo aquí (resto de la UI es Zéndity teal) */}
                    <div className="flex items-center gap-3 mb-2 pb-2 border-b border-slate-100">
                        {hq.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={hq.logoUrl} alt={tenantName} className="h-7 w-auto object-contain" />
                        )}
                        <span className="text-[12px] font-bold text-slate-700">{tenantName}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">Evaluación de Trabajo Social</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg font-black text-slate-800 truncate">{patient.name}</h1>
                                {patient.roomNumber && (
                                    <span className="text-xs font-semibold text-slate-500">Hab. {patient.roomNumber}</span>
                                )}
                                <StatusBadge status={evaluation.status} />
                            </div>
                            {/* Autosave indicator — solo visible en DRAFT */}
                            <AutosaveIndicator state={autosave} visible={mode === 'DRAFT'} />
                            {/* Info de firma en estados APPROVED/ARCHIVED */}
                            {mode !== 'DRAFT' && evaluation.signerName && evaluation.approvedAt && (
                                <p className="text-[11px] text-slate-500">
                                    Aprobada por <span className="font-semibold text-slate-700">{evaluation.signerName}</span>
                                    {evaluation.signerCollegiateNumber && <> · Lic. {evaluation.signerCollegiateNumber}</>}
                                    {' · '}
                                    {new Date(evaluation.approvedAt).toLocaleDateString('es-PR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {mode === 'DRAFT' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleDiscardDraft}
                                        disabled={discarding}
                                        className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                        title="Borra este borrador permanentemente. Solo disponible mientras está en BORRADOR."
                                    >
                                        {discarding ? 'Descartando…' : 'Descartar borrador'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadPdf}
                                        disabled={pdfLoading}
                                        className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                    >
                                        {pdfLoading ? 'Descargando…' : 'Descargar borrador'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleOpenSignature}
                                        disabled={autosave.status === 'ERROR'}
                                        className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Aprobar firma digital
                                    </button>
                                </>
                            )}
                            {mode !== 'DRAFT' && (
                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    disabled={pdfLoading}
                                    className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors"
                                >
                                    {pdfLoading ? 'Descargando…' : 'Descargar PDF'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Body ── */}
            <main className="max-w-5xl mx-auto px-6 py-8">
                <SWEvaluationFormRenderer
                    schema={schema}
                    data={data}
                    prefillSnapshot={prefillSnapshot}
                    mode={mode}
                    onChange={handleChange}
                    autosave={autosave}
                />

                {/* Panel de addendums — solo APPROVED */}
                {mode === 'APPROVED' && (
                    <div className="mt-8">
                        <AddendumPanel
                            evaluationId={evaluation.id}
                            existingAddendums={addendums}
                            onCreated={() => router.refresh()}
                        />
                    </div>
                )}

                {/* Read-only ARCHIVED: addendums se muestran sin posibilidad de agregar */}
                {mode === 'ARCHIVED' && addendums.length > 0 && (
                    <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6">
                        <h2 className="text-base font-bold text-slate-800 mb-4">Addendums ({addendums.length})</h2>
                        <ul className="space-y-4">
                            {addendums.map(a => (
                                <li key={a.id} className="border-l-4 border-slate-300 pl-4 py-1">
                                    <p className="text-sm font-semibold text-slate-700">{a.reason}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {a.createdByName ?? 'Sistema'} · {new Date(a.createdAt).toLocaleDateString('es-PR')}
                                    </p>
                                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
                                        {typeof a.content === 'string' ? a.content : JSON.stringify(a.content, null, 2)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </main>

            {/* ── Modal de firma ── */}
            {showSignature && (
                <SignatureApprovalModal
                    evaluationId={evaluation.id}
                    patientName={patient.name}
                    brandPrimary={brandPrimary}
                    onClose={() => setShowSignature(false)}
                    onApproved={handleApproved}
                />
            )}
        </div>
    );
}
