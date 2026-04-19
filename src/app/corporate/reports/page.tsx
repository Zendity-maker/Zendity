"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '@/context/AuthContext';
import { ClipboardList, CheckCircle2, Clock, Sun, Moon, Sunset, Loader2, FileText, PenTool, X, Eye } from 'lucide-react';

type ShiftType = 'MORNING' | 'EVENING' | 'NIGHT' | 'SUPERVISOR_DAY';
type Status = 'PENDING' | 'ACCEPTED';

interface ReportListItem {
    id: string;
    shiftType: ShiftType;
    status: Status;
    createdAt: string;
    acceptedAt: string | null;
    seniorConfirmedAt: string | null;
    supervisorSignedAt: string | null;
    directorViewedAt: string | null;
    aiSummaryPreview: string;
    hasAiSummary: boolean;
    outgoingNurse: { id: string; name: string; role: string } | null;
    seniorCaregiver: { id: string; name: string; role: string } | null;
    supervisorSigned: { id: string; name: string; role: string } | null;
    notesCount: number;
}

interface ReportDetail extends ReportListItem {
    aiSummaryReport: string | null;
    seniorNote: string | null;
    supervisorNote: string | null;
    notes: Array<{
        id: string;
        patientId: string;
        clinicalNotes: string;
        isCritical: boolean;
        patient: { id: string; name: string; roomNumber: string | null } | null;
    }>;
}

const SHIFT_STYLES: Record<ShiftType, { label: string; bg: string; text: string; icon: any }> = {
    MORNING: { label: 'Mañana', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: Sun },
    EVENING: { label: 'Tarde', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: Sunset },
    NIGHT: { label: 'Noche', bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', icon: Moon },
    SUPERVISOR_DAY: { label: 'Supervisor', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', icon: ClipboardList },
};

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export default function CorporateReportsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [reports, setReports] = useState<ReportListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signingFor, setSigningFor] = useState<ReportDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [supervisorNote, setSupervisorNote] = useState('');
    const sigPad = useRef<any>(null);

    const isAuthorized = !!user?.role && ALLOWED_ROLES.includes(user.role);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        if (!isAuthorized) {
            router.replace('/');
        }
    }, [user, authLoading, isAuthorized, router]);

    const fetchReports = async () => {
        if (!isAuthorized) return;
        setLoading(true);
        try {
            const res = await fetch('/api/care/reports?limit=60');
            const data = await res.json();
            if (data.success) setReports(data.reports || []);
            else setError(data.error || 'Error cargando reportes');
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) fetchReports();
    }, [isAuthorized]);

    const { pendingFirma, firmados } = useMemo(() => {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const pending: ReportListItem[] = [];
        const signed: ReportListItem[] = [];
        reports.forEach(r => {
            if (r.seniorConfirmedAt && !r.supervisorSignedAt) {
                pending.push(r);
            } else if (r.supervisorSignedAt) {
                if (new Date(r.supervisorSignedAt).getTime() >= thirtyDaysAgo) signed.push(r);
            }
        });
        return { pendingFirma: pending, firmados: signed };
    }, [reports]);

    const openSignModal = async (id: string) => {
        setDetailLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/care/reports/${id}`);
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'No se pudo cargar el reporte');
                return;
            }
            // Normalize the shape to match our expectations
            const r = data.report;
            const detail: ReportDetail = {
                id: r.id,
                shiftType: r.shiftType,
                status: r.status,
                createdAt: r.createdAt,
                acceptedAt: r.acceptedAt,
                seniorConfirmedAt: r.seniorConfirmedAt,
                supervisorSignedAt: r.supervisorSignedAt,
                directorViewedAt: r.directorViewedAt,
                aiSummaryPreview: (r.aiSummaryReport || '').slice(0, 200),
                hasAiSummary: !!r.aiSummaryReport,
                aiSummaryReport: r.aiSummaryReport,
                seniorNote: r.seniorNote,
                supervisorNote: r.supervisorNote,
                outgoingNurse: r.outgoingNurse,
                seniorCaregiver: r.seniorCaregiver,
                supervisorSigned: r.supervisorSigned,
                notesCount: r.notes?.length || 0,
                notes: r.notes || [],
            };
            setSigningFor(detail);
            setSupervisorNote('');
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setDetailLoading(false);
        }
    };

    const closeModal = () => {
        setSigningFor(null);
        setSupervisorNote('');
        sigPad.current?.clear();
    };

    const handleSign = async () => {
        if (!signingFor) return;
        if (!sigPad.current || sigPad.current.isEmpty()) {
            setError('Por favor dibuja tu firma antes de continuar.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const signature = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
            const res = await fetch(`/api/care/reports/${signingFor.id}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signature, note: supervisorNote.trim() || undefined }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'No se pudo firmar');
                return;
            }
            closeModal();
            await fetchReports();
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
                <div className="text-[#1F2D3A]/60 font-medium">Cargando...</div>
            </div>
        );
    }

    const renderCard = (r: ReportListItem, showSignButton: boolean) => {
        const shift = SHIFT_STYLES[r.shiftType] || SHIFT_STYLES.MORNING;
        const ShiftIcon = shift.icon;
        return (
            <div key={r.id} className="bg-white border border-[#e7e5e4] rounded-2xl p-4 transition-all hover:shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${shift.bg} ${shift.text}`}>
                            <ShiftIcon size={12} />
                            {shift.label}
                        </span>
                        {r.status === 'ACCEPTED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} /> Firmado
                            </span>
                        ) : r.seniorConfirmedAt ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-50 text-[#E5A93D] border border-amber-200">
                                <PenTool size={12} /> Pendiente firma
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
                                <Clock size={12} /> Esperando senior
                            </span>
                        )}
                    </div>
                    <span className="text-[#1F2D3A]/50 text-xs font-medium">
                        {new Date(r.createdAt).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {r.aiSummaryPreview && (
                    <p className="text-[#1F2D3A]/75 text-sm leading-relaxed mb-3 line-clamp-3">
                        {r.aiSummaryPreview}{r.hasAiSummary ? '…' : ''}
                    </p>
                )}

                <div className="text-[11px] text-[#1F2D3A]/55 mb-3 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Notas: <strong>{r.notesCount}</strong></span>
                    {r.seniorCaregiver && (
                        <span>Senior: <strong>{r.seniorCaregiver.name}</strong></span>
                    )}
                    {r.supervisorSigned && (
                        <span>Supervisor: <strong>{r.supervisorSigned.name}</strong></span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={`/corporate/reports/${r.id}`}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-[#1F2D3A]/75 border border-[#e7e5e4] hover:bg-[#fafaf9] transition-colors"
                    >
                        <Eye size={14} /> Ver detalle
                    </Link>
                    {showSignButton && (
                        <button
                            onClick={() => openSignModal(r.id)}
                            disabled={detailLoading}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-[#0F6B78] text-white hover:bg-[#0d5a66] disabled:opacity-60 transition-colors"
                        >
                            <PenTool size={14} /> Revisar y Firmar
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#fafaf9]">
            <div className="max-w-5xl mx-auto p-5 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-xl bg-[#0F6B78]/10 border border-[#0F6B78]/20 flex items-center justify-center text-[#0F6B78]">
                        <ClipboardList size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[#1F2D3A] tracking-tight">Reportes de Turno</h1>
                        <p className="text-[#1F2D3A]/60 text-sm">Confirmación del cuidador senior + tu firma cierra cada turno.</p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm mb-4">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-10 text-center text-[#1F2D3A]/50">
                        <Loader2 className="mx-auto animate-spin mb-2" size={24} />
                        Cargando reportes...
                    </div>
                ) : (
                    <>
                        <section className="mb-8">
                            <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-3">
                                Pendientes de firma ({pendingFirma.length})
                            </h2>
                            {pendingFirma.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-[#e7e5e4] p-8 text-center text-[#1F2D3A]/50 text-sm">
                                    <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={28} />
                                    No hay reportes pendientes de firma.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingFirma.map(r => renderCard(r, true))}
                                </div>
                            )}
                        </section>

                        <section>
                            <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-3">
                                Firmados (últimos 30 días — {firmados.length})
                            </h2>
                            {firmados.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-[#e7e5e4] p-8 text-center text-[#1F2D3A]/50 text-sm">
                                    <FileText className="mx-auto text-[#1F2D3A]/25 mb-2" size={28} />
                                    Aún no hay reportes firmados en los últimos 30 días.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {firmados.map(r => renderCard(r, false))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {/* Sign Modal */}
            {signingFor && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#e7e5e4] sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="text-lg font-black text-[#1F2D3A]">Revisar y Firmar Reporte</h3>
                                <p className="text-xs text-[#1F2D3A]/60 mt-0.5">
                                    {SHIFT_STYLES[signingFor.shiftType]?.label} ·{' '}
                                    {new Date(signingFor.createdAt).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <button onClick={closeModal} className="text-[#1F2D3A]/60 hover:text-[#1F2D3A] p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {signingFor.aiSummaryReport && (
                                <div>
                                    <h4 className="text-xs font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-1">Resumen Zendi</h4>
                                    <div className="bg-[#fafaf9] border border-[#e7e5e4] rounded-xl p-3 text-sm text-[#1F2D3A]/85 whitespace-pre-wrap">
                                        {signingFor.aiSummaryReport}
                                    </div>
                                </div>
                            )}

                            {signingFor.seniorCaregiver && signingFor.seniorConfirmedAt && (
                                <div>
                                    <h4 className="text-xs font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-1">Confirmación del Senior</h4>
                                    <div className="bg-[#fafaf9] border border-[#e7e5e4] rounded-xl p-3 text-sm text-[#1F2D3A]/85">
                                        <div className="font-semibold">{signingFor.seniorCaregiver.name}</div>
                                        <div className="text-xs text-[#1F2D3A]/55 mb-1">
                                            {new Date(signingFor.seniorConfirmedAt).toLocaleString('es-PR')}
                                        </div>
                                        {signingFor.seniorNote && (
                                            <p className="mt-1 whitespace-pre-wrap">{signingFor.seniorNote}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {signingFor.notes && signingFor.notes.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-1">Notas por residente ({signingFor.notes.length})</h4>
                                    <div className="space-y-2">
                                        {signingFor.notes.map(n => (
                                            <div key={n.id} className={`border rounded-xl p-3 text-sm ${n.isCritical ? 'bg-red-50 border-red-200' : 'bg-[#fafaf9] border-[#e7e5e4]'}`}>
                                                <div className="font-semibold text-[#1F2D3A]">
                                                    {n.patient?.name || 'Residente'}
                                                    {n.patient?.roomNumber && <span className="text-xs text-[#1F2D3A]/55 ml-2">Hab. {n.patient.roomNumber}</span>}
                                                    {n.isCritical && <span className="ml-2 text-[10px] font-bold uppercase text-red-700">Crítico</span>}
                                                </div>
                                                <p className="text-[#1F2D3A]/80 mt-0.5 whitespace-pre-wrap">{n.clinicalNotes}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-1">
                                    Nota del supervisor (opcional)
                                </label>
                                <textarea
                                    value={supervisorNote}
                                    onChange={(e) => setSupervisorNote(e.target.value)}
                                    placeholder="Comentarios o acciones requeridas..."
                                    rows={3}
                                    className="w-full border border-[#e7e5e4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B78]/30 bg-white resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-1">
                                    Firma
                                </label>
                                <div className="border-2 border-dashed border-[#e7e5e4] rounded-xl bg-white">
                                    <SignatureCanvas
                                        ref={sigPad}
                                        penColor="#1F2D3A"
                                        canvasProps={{ className: 'w-full h-40 rounded-xl' }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => sigPad.current?.clear()}
                                    className="text-xs text-[#0F6B78] font-bold mt-1 hover:underline"
                                >
                                    Limpiar firma
                                </button>
                            </div>
                        </div>

                        <div className="p-5 border-t border-[#e7e5e4] flex items-center justify-end gap-2 sticky bottom-0 bg-white">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-[#1F2D3A]/70 hover:bg-[#fafaf9]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSign}
                                disabled={submitting}
                                className="bg-[#0F6B78] text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-[#0d5a66] disabled:opacity-60 transition-colors flex items-center gap-2"
                            >
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}
                                {submitting ? 'Firmando...' : 'Firmar reporte'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
