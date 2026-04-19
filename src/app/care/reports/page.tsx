"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ClipboardList, CheckCircle2, Clock, Sun, Moon, Sunset, Loader2, FileText } from 'lucide-react';

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

const SHIFT_STYLES: Record<ShiftType, { label: string; bg: string; text: string; icon: any }> = {
    MORNING: { label: 'Mañana', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: Sun },
    EVENING: { label: 'Tarde', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: Sunset },
    NIGHT: { label: 'Noche', bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', icon: Moon },
    SUPERVISOR_DAY: { label: 'Supervisor', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', icon: ClipboardList },
};

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE'];

export default function CareReportsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [reports, setReports] = useState<ReportListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [noteDraft, setNoteDraft] = useState('');
    const [openConfirmId, setOpenConfirmId] = useState<string | null>(null);

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
            const res = await fetch('/api/care/reports?limit=30');
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

    const handleConfirm = async (id: string) => {
        setConfirmingId(id);
        setError(null);
        try {
            const res = await fetch(`/api/care/reports/${id}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: noteDraft.trim() || undefined }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'No se pudo confirmar');
            } else {
                setOpenConfirmId(null);
                setNoteDraft('');
                await fetchReports();
            }
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setConfirmingId(null);
        }
    };

    if (authLoading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
                <div className="text-[#1F2D3A]/60 font-medium">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fafaf9]">
            <div className="max-w-4xl mx-auto p-5 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-xl bg-[#0F6B78]/10 border border-[#0F6B78]/20 flex items-center justify-center text-[#0F6B78]">
                        <ClipboardList size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[#1F2D3A] tracking-tight">Reportes de Turno</h1>
                        <p className="text-[#1F2D3A]/60 text-sm">Confirma el reporte si eres el cuidador senior del turno activo.</p>
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
                ) : reports.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-10 text-center">
                        <FileText className="mx-auto text-[#1F2D3A]/25 mb-3" size={36} />
                        <p className="text-[#1F2D3A]/60 font-medium">Aún no hay reportes de turno.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map(r => {
                            const shift = SHIFT_STYLES[r.shiftType] || SHIFT_STYLES.MORNING;
                            const ShiftIcon = shift.icon;
                            const canConfirm = r.status === 'PENDING' && !r.seniorConfirmedAt;

                            return (
                                <div
                                    key={r.id}
                                    className="bg-white border border-[#e7e5e4] rounded-2xl p-4 transition-all hover:shadow-sm"
                                >
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
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-50 text-[#E5A93D] border border-amber-200">
                                                    <Clock size={12} /> Pendiente confirmación
                                                </span>
                                            )}
                                            {r.seniorConfirmedAt && !r.supervisorSignedAt && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                                                    Esperando firma supervisor
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
                                        <span>Notas clínicas: <strong>{r.notesCount}</strong></span>
                                        {r.seniorCaregiver && (
                                            <span>Senior: <strong>{r.seniorCaregiver.name}</strong></span>
                                        )}
                                        {r.outgoingNurse && (
                                            <span>Originado por: <strong>{r.outgoingNurse.name}</strong></span>
                                        )}
                                    </div>

                                    {canConfirm && openConfirmId !== r.id && (
                                        <button
                                            onClick={() => { setOpenConfirmId(r.id); setNoteDraft(''); }}
                                            className="bg-[#0F6B78] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#0d5a66] transition-colors"
                                        >
                                            Confirmar reporte
                                        </button>
                                    )}

                                    {openConfirmId === r.id && (
                                        <div className="bg-[#fafaf9] border border-[#e7e5e4] rounded-xl p-3 mt-2">
                                            <label className="block text-xs font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-1">Nota del senior (opcional)</label>
                                            <textarea
                                                value={noteDraft}
                                                onChange={(e) => setNoteDraft(e.target.value)}
                                                placeholder="Observaciones relevantes que deban llegar al supervisor..."
                                                rows={3}
                                                className="w-full border border-[#e7e5e4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B78]/30 bg-white resize-none"
                                            />
                                            <div className="flex items-center gap-2 mt-2">
                                                <button
                                                    onClick={() => handleConfirm(r.id)}
                                                    disabled={confirmingId === r.id}
                                                    className="bg-[#0F6B78] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#0d5a66] disabled:opacity-60 transition-colors"
                                                >
                                                    {confirmingId === r.id ? 'Confirmando...' : 'Firmar confirmación'}
                                                </button>
                                                <button
                                                    onClick={() => { setOpenConfirmId(null); setNoteDraft(''); }}
                                                    className="px-4 py-2 rounded-lg text-sm font-bold text-[#1F2D3A]/70 hover:bg-[#fafaf9]"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
