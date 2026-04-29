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
    supervisorSignedAt: string | null;
    directorViewedAt: string | null;
    aiSummaryPreview: string;
    hasAiSummary: boolean;
    outgoingNurse: { id: string; name: string; role: string } | null;
    supervisorSigned: { id: string; name: string; role: string } | null;
    notesCount: number;
}

const SHIFT_STYLES: Record<ShiftType, { label: string; bg: string; text: string; icon: any }> = {
    MORNING:       { label: 'Mañana',     bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-800',  icon: Sun },
    EVENING:       { label: 'Tarde',      bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-800',   icon: Sunset },
    NIGHT:         { label: 'Noche',      bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700',  icon: Moon },
    SUPERVISOR_DAY:{ label: 'Supervisor', bg: 'bg-teal-50 border-teal-200',    text: 'text-teal-800',   icon: ClipboardList },
};

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE'];

export default function CareReportsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [reports, setReports] = useState<ReportListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isAuthorized = !!user?.role && ALLOWED_ROLES.includes(user.role);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.replace('/login'); return; }
        if (!isAuthorized) router.replace('/');
    }, [user, authLoading, isAuthorized, router]);

    const fetchReports = async () => {
        if (!isAuthorized) return;
        setLoading(true);
        try {
            const res  = await fetch('/api/care/reports?limit=30');
            const data = await res.json();
            if (data.success) setReports(data.reports || []);
            else setError(data.error || 'Error cargando reportes');
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (isAuthorized) fetchReports(); }, [isAuthorized]);

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
                        <p className="text-[#1F2D3A]/60 text-sm">Historial de tus cierres de turno.</p>
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
                            const shift   = SHIFT_STYLES[r.shiftType] || SHIFT_STYLES.MORNING;
                            const ShiftIcon = shift.icon;

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
                                                    <CheckCircle2 size={12} /> Firmado por supervisor
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-50 text-[#E5A93D] border border-amber-200">
                                                    <Clock size={12} /> Pendiente firma supervisor
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

                                    <div className="text-[11px] text-[#1F2D3A]/55 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>Notas clínicas: <strong>{r.notesCount}</strong></span>
                                        {r.outgoingNurse && (
                                            <span>Cuidador/a: <strong>{r.outgoingNurse.name}</strong></span>
                                        )}
                                        {r.supervisorSigned && (
                                            <span>Firmado por: <strong>{r.supervisorSigned.name}</strong></span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
