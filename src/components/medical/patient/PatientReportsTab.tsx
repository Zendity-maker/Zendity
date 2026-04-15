"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface FollowUpNote {
    authorId: string;
    authorName: string;
    note: string;
    createdAt: string;
}

interface TriageTicketRow {
    id: string;
    originType: string;
    priority: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
    description: string;
    resolutionNote: string | null;
    followUpNotes: FollowUpNote[] | null;
    createdAt: string;
    resolvedAt: string | null;
    assignedTo: { name: string; role: string } | null;
    resolvedBy: { name: string } | null;
}

const STATUS_CFG: Record<string, { bg: string; label: string }> = {
    OPEN: { bg: 'bg-rose-100 text-rose-700 border border-rose-200', label: 'Abierto' },
    IN_PROGRESS: { bg: 'bg-amber-100 text-amber-700 border border-amber-200', label: 'En Proceso' },
    RESOLVED: { bg: 'bg-emerald-100 text-emerald-700 border border-emerald-200', label: 'Resuelto' },
};

const ORIGIN_CFG: Record<string, { label: string; icon: string; bg: string }> = {
    DAILY_LOG: { icon: '\u{1FA7A}', label: 'Clinico', bg: 'bg-purple-100 text-purple-700 border border-purple-200' },
    INCIDENT: { icon: '\u{1F527}', label: 'Mantenimiento', bg: 'bg-slate-100 text-slate-600 border border-slate-200' },
    COMPLAINT: { icon: '\u{1F4CB}', label: 'Queja', bg: 'bg-orange-100 text-orange-700 border border-orange-200' },
    FALL: { icon: '\u{1F6A8}', label: 'Caida', bg: 'bg-rose-100 text-rose-700 border border-rose-200' },
    EMAR_MISS: { icon: '\u{1F48A}', label: 'eMAR', bg: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
    CRON_SYSTEM: { icon: '\u2699\uFE0F', label: 'Sistema', bg: 'bg-teal-100 text-teal-700 border border-teal-200' },
    MANUAL: { icon: '\u270F\uFE0F', label: 'Manual', bg: 'bg-blue-100 text-blue-700 border border-blue-200' },
};

const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-PR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

export default function PatientReportsTab({ patientId, patientName }: { patientId: string; patientName?: string }) {
    const [tickets, setTickets] = useState<TriageTicketRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const res = await fetch(`/api/corporate/patients/${patientId}/history-report`);
                const data = await res.json();
                if (data.success && data.history?.TriageTicket) {
                    setTickets(data.history.TriageTicket);
                }
            } catch (e) {
                console.error("Error fetching triage tickets:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchTickets();
    }, [patientId]);

    const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS' || t.status === 'OPEN').length;
    const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

    if (loading) {
        return (
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm font-bold text-slate-400">Cargando reportes de triage...</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <span className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-lg">&#x1F6E1;</span>
                        Reportes de Triage
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">
                        Historial completo de tickets clinicos, mantenimiento y seguimiento.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {inProgressCount > 0 && (
                        <span className="bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            {inProgressCount} En Proceso
                        </span>
                    )}
                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider">
                        {resolvedCount} Resueltos
                    </span>
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider">
                        {tickets.length} Total
                    </span>
                </div>
            </div>

            {/* Empty State */}
            {tickets.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">&#x1F6E1;</div>
                    <p className="text-lg font-bold text-slate-400">Sin reportes de triage para este residente</p>
                    <p className="text-sm text-slate-300 font-medium mt-1">Los tickets se crean automaticamente al reportar alertas, caidas o incidentes.</p>
                </div>
            ) : (
                /* Timeline */
                <div className="space-y-4">
                    {tickets.map((ticket) => {
                        const statusCfg = STATUS_CFG[ticket.status] || STATUS_CFG.OPEN;
                        const originCfg = ORIGIN_CFG[ticket.originType] || ORIGIN_CFG.MANUAL;
                        const followUps: FollowUpNote[] = Array.isArray(ticket.followUpNotes) ? ticket.followUpNotes : [];
                        const isResolved = ticket.status === 'RESOLVED';

                        return (
                            <div
                                key={ticket.id}
                                className={`rounded-2xl border p-5 transition-all ${
                                    isResolved
                                        ? 'bg-slate-50 border-slate-200'
                                        : ticket.status === 'OPEN'
                                            ? 'bg-white border-rose-200 border-l-4 border-l-rose-400'
                                            : 'bg-white border-amber-200 border-l-4 border-l-amber-400'
                                }`}
                            >
                                {/* Badges Row */}
                                <div className="flex items-center gap-2 flex-wrap mb-3">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${statusCfg.bg}`}>
                                        {ticket.status === 'OPEN' ? '\u{1F534}' : ticket.status === 'IN_PROGRESS' ? '\u{1F7E1}' : '\u2705'} {statusCfg.label}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${originCfg.bg}`}>
                                        {originCfg.icon} {originCfg.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium ml-auto">
                                        {formatDate(ticket.createdAt)}
                                    </span>
                                </div>

                                {/* Description */}
                                <p className="text-sm font-bold text-slate-800 leading-relaxed mb-3">
                                    {ticket.description.length > 300 ? ticket.description.substring(0, 300) + '...' : ticket.description}
                                </p>

                                {/* Meta */}
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                                    {ticket.assignedTo && (
                                        <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                                            &#x1F464; Asignado a: {ticket.assignedTo.name} <span className="text-indigo-400">({ticket.assignedTo.role})</span>
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        &#x23F0; {timeAgo(ticket.createdAt)}
                                    </span>
                                    {ticket.resolvedBy && (
                                        <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100">
                                            &#x2705; Resuelto por {ticket.resolvedBy.name}
                                        </span>
                                    )}
                                    {ticket.resolvedAt && (
                                        <span className="text-slate-400">
                                            {formatDate(ticket.resolvedAt)}
                                        </span>
                                    )}
                                </div>

                                {/* Resolution Note */}
                                {ticket.resolutionNote && (
                                    <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Nota de Cierre</span>
                                        <p className="text-sm text-emerald-800 font-medium">{ticket.resolutionNote}</p>
                                    </div>
                                )}

                                {/* Follow-up Notes */}
                                {followUps.length > 0 && (
                                    <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            &#x1F4AC; Notas de Seguimiento ({followUps.length})
                                        </p>
                                        {followUps.map((n, idx) => (
                                            <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-bold text-slate-700">{n.authorName}</span>
                                                    <span className="text-slate-400">{timeAgo(n.createdAt)}</span>
                                                </div>
                                                <p className="text-slate-600 font-medium">{n.note}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
