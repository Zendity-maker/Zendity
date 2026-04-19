"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ClipboardList, CheckCircle2, Clock, Sun, Moon, Sunset, Loader2, ArrowLeft, Eye, Sparkles, UserCheck, PenTool } from 'lucide-react';

type ShiftType = 'MORNING' | 'EVENING' | 'NIGHT' | 'SUPERVISOR_DAY';

const SHIFT_STYLES: Record<ShiftType, { label: string; bg: string; text: string; icon: any }> = {
    MORNING: { label: 'Mañana', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: Sun },
    EVENING: { label: 'Tarde', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: Sunset },
    NIGHT: { label: 'Noche', bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', icon: Moon },
    SUPERVISOR_DAY: { label: 'Supervisor', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', icon: ClipboardList },
};

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE', 'CAREGIVER'];

export default function CorporateReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const id = params?.id as string;

    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isAuthorized = !!user?.role && ALLOWED_ROLES.includes(user.role);
    const isDirectorLike = !!user?.role && (user.role === 'DIRECTOR' || user.role === 'ADMIN');

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

    const fetchDetail = async () => {
        if (!isAuthorized || !id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/care/reports/${id}`);
            const data = await res.json();
            if (data.success) setReport(data.report);
            else setError(data.error || 'No se pudo cargar el reporte');
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) fetchDetail();
    }, [isAuthorized, id]);

    // Auto-mark as viewed for DIRECTOR/ADMIN (only once per mount when still null)
    useEffect(() => {
        if (!isDirectorLike || !report || report.directorViewedAt) return;
        (async () => {
            try {
                const res = await fetch(`/api/care/reports/${id}/view`, { method: 'POST' });
                const data = await res.json();
                if (data.success && data.directorViewedAt) {
                    setReport((prev: any) => prev ? { ...prev, directorViewedAt: data.directorViewedAt } : prev);
                }
            } catch (e) {
                console.error('[view tracking]', e);
            }
        })();
    }, [isDirectorLike, report?.id, report?.directorViewedAt, id]);

    if (authLoading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
                <div className="text-[#1F2D3A]/60 font-medium">Cargando...</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
                <div className="text-[#1F2D3A]/50 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    Cargando reporte...
                </div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="min-h-screen bg-[#fafaf9]">
                <div className="max-w-3xl mx-auto p-8">
                    <Link href="/corporate/reports" className="inline-flex items-center gap-2 text-[#0F6B78] font-bold text-sm mb-6 hover:underline">
                        <ArrowLeft size={16} /> Volver a Reportes
                    </Link>
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
                        {error || 'Reporte no encontrado'}
                    </div>
                </div>
            </div>
        );
    }

    const shift = SHIFT_STYLES[report.shiftType as ShiftType] || SHIFT_STYLES.MORNING;
    const ShiftIcon = shift.icon;

    // Timeline steps
    const steps = [
        {
            key: 'generated',
            label: 'Generado por Zendi',
            icon: Sparkles,
            at: report.createdAt,
            who: report.outgoingNurse?.name || 'Sistema',
            done: true,
        },
        {
            key: 'confirmed',
            label: 'Confirmado por Senior',
            icon: UserCheck,
            at: report.seniorConfirmedAt,
            who: report.seniorCaregiver?.name || '—',
            done: !!report.seniorConfirmedAt,
        },
        {
            key: 'signed',
            label: 'Firmado por Supervisor',
            icon: PenTool,
            at: report.supervisorSignedAt,
            who: report.supervisorSigned?.name || '—',
            done: !!report.supervisorSignedAt,
        },
        {
            key: 'viewed',
            label: 'Visto por Director',
            icon: Eye,
            at: report.directorViewedAt,
            who: isDirectorLike && report.directorViewedAt ? (user?.name || 'Director') : '—',
            done: !!report.directorViewedAt,
        },
    ];

    return (
        <div className="min-h-screen bg-[#fafaf9]">
            <div className="max-w-4xl mx-auto p-5 md:p-8">
                <Link
                    href={user?.role === 'CAREGIVER' || user?.role === 'NURSE' ? '/care/reports' : '/corporate/reports'}
                    className="inline-flex items-center gap-2 text-[#0F6B78] font-bold text-sm mb-5 hover:underline"
                >
                    <ArrowLeft size={16} /> Volver a Reportes
                </Link>

                {/* Header */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 mb-5">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${shift.bg} ${shift.text}`}>
                            <ShiftIcon size={12} />
                            {shift.label}
                        </span>
                        {report.status === 'ACCEPTED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} /> Firmado
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-50 text-[#E5A93D] border border-amber-200">
                                <Clock size={12} /> Pendiente
                            </span>
                        )}
                    </div>
                    <div className="text-lg font-black text-[#1F2D3A]">Reporte de Turno</div>
                    <div className="text-sm text-[#1F2D3A]/60">
                        {new Date(report.createdAt).toLocaleString('es-PR', { dateStyle: 'full', timeStyle: 'short' })}
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 mb-5">
                    <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-4">Flujo del Reporte</h2>
                    <ol className="relative border-l-2 border-[#e7e5e4] ml-3 space-y-5">
                        {steps.map((s, idx) => {
                            const Icon = s.icon;
                            return (
                                <li key={s.key} className="ml-5 relative">
                                    <span
                                        className={`absolute -left-[32px] top-0 w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                                            s.done ? 'bg-[#0F6B78] border-[#0F6B78] text-white' : 'bg-white border-[#e7e5e4] text-[#1F2D3A]/40'
                                        }`}
                                    >
                                        <Icon size={13} />
                                    </span>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold text-[#1F2D3A]/50 uppercase tracking-wider">
                                            Paso {idx + 1}
                                        </span>
                                        {s.done && (
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">✓ Completado</span>
                                        )}
                                    </div>
                                    <div className={`text-sm font-bold ${s.done ? 'text-[#1F2D3A]' : 'text-[#1F2D3A]/50'}`}>
                                        {s.label}
                                    </div>
                                    <div className="text-xs text-[#1F2D3A]/60 mt-0.5">
                                        {s.done && s.at ? (
                                            <>
                                                <strong>{s.who}</strong> · {new Date(s.at).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </>
                                        ) : (
                                            'Pendiente'
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </div>

                {/* Resumen Zendi */}
                {report.aiSummaryReport && (
                    <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 mb-5">
                        <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Sparkles size={14} className="text-[#0F6B78]" />
                            Resumen Zendi
                        </h2>
                        <div className="text-sm text-[#1F2D3A]/85 leading-relaxed whitespace-pre-wrap">
                            {report.aiSummaryReport}
                        </div>
                    </div>
                )}

                {/* Notas por residente */}
                {report.notes && report.notes.length > 0 && (
                    <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 mb-5">
                        <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-3">
                            Notas por Residente ({report.notes.length})
                        </h2>
                        <div className="space-y-2">
                            {report.notes.map((n: any) => (
                                <div
                                    key={n.id}
                                    className={`border rounded-xl p-3 text-sm ${n.isCritical ? 'bg-red-50 border-red-200' : 'bg-[#fafaf9] border-[#e7e5e4]'}`}
                                >
                                    <div className="font-semibold text-[#1F2D3A] flex items-center gap-2 flex-wrap">
                                        <span>{n.patient?.name || 'Residente'}</span>
                                        {n.patient?.roomNumber && (
                                            <span className="text-xs text-[#1F2D3A]/55">Hab. {n.patient.roomNumber}</span>
                                        )}
                                        {n.isCritical && (
                                            <span className="text-[10px] font-bold uppercase text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                                                Crítico
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[#1F2D3A]/80 mt-1 whitespace-pre-wrap">{n.clinicalNotes}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Nota del Senior */}
                {report.seniorNote && (
                    <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 mb-5">
                        <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <UserCheck size={14} className="text-[#0F6B78]" />
                            Nota del Senior {report.seniorCaregiver?.name ? `(${report.seniorCaregiver.name})` : ''}
                        </h2>
                        <div className="text-sm text-[#1F2D3A]/85 leading-relaxed whitespace-pre-wrap">
                            {report.seniorNote}
                        </div>
                    </div>
                )}

                {/* Nota del Supervisor */}
                {report.supervisorNote && (
                    <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 mb-5">
                        <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <PenTool size={14} className="text-[#0F6B78]" />
                            Nota del Supervisor {report.supervisorSigned?.name ? `(${report.supervisorSigned.name})` : ''}
                        </h2>
                        <div className="text-sm text-[#1F2D3A]/85 leading-relaxed whitespace-pre-wrap">
                            {report.supervisorNote}
                        </div>
                    </div>
                )}

                {/* Firma del supervisor (visual) */}
                {report.supervisorSignature && (
                    <div className="bg-white border border-[#e7e5e4] rounded-2xl p-5 mb-5">
                        <h2 className="text-sm font-bold text-[#1F2D3A]/70 uppercase tracking-wide mb-3">Firma del Supervisor</h2>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={report.supervisorSignature}
                            alt="Firma del supervisor"
                            className="max-h-28 bg-[#fafaf9] border border-[#e7e5e4] rounded-lg p-2"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
