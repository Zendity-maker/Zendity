"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertOctagon, Activity, Loader2, CheckCircle2, Clock, User, ChevronDown, Send, MessageSquarePlus, Stethoscope, Wrench, ClipboardList, AlertTriangle } from "lucide-react";

interface FollowUpNote {
    authorId: string;
    authorName: string;
    note: string;
    createdAt: string;
}

interface TriageTicketData {
    id: string;
    headquartersId: string;
    patientId: string | null;
    originType: string;
    originReferenceId: string | null;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
    isEscalated: boolean;
    isVoided: boolean;
    description: string;
    resolutionNote: string | null;
    followUpNotes: FollowUpNote[] | null;
    assignedToId: string | null;
    resolvedById: string | null;
    createdAt: string;
    updatedAt: string;
    escalatedAt: string | null;
    resolvedAt: string | null;
    patient: { id: string; name: string; colorGroup: string | null; roomNumber: string | null } | null;
    assignedTo: { id: string; name: string; role: string } | null;
    resolvedBy: { id: string; name: string } | null;
}

const PRIORITY_CONFIG: Record<string, { bg: string; label: string; icon: string }> = {
    CRITICAL: { bg: 'bg-rose-100 text-rose-800 border-rose-200', label: 'Crítico', icon: '🔴' },
    HIGH: { bg: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Alto', icon: '🟠' },
    MEDIUM: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Medio', icon: '🟡' },
    LOW: { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Bajo', icon: '⚪' },
};

const ORIGIN_CONFIG: Record<string, { bg: string; label: string; icon: string; targetRole: string; targetLabel: string }> = {
    DAILY_LOG: { bg: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Clínico', icon: '🩺', targetRole: 'NURSE', targetLabel: 'Enfermería' },
    INCIDENT: { bg: 'bg-slate-200 text-slate-700 border-slate-300', label: 'Mantenimiento', icon: '🔧', targetRole: 'MAINTENANCE', targetLabel: 'Planta Física' },
    COMPLAINT: { bg: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Queja Familiar', icon: '📋', targetRole: 'ADMIN', targetLabel: 'Administración' },
    FALL: { bg: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Caída', icon: '🚨', targetRole: 'NURSE', targetLabel: 'Enfermería + Director' },
    EMAR_MISS: { bg: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'eMAR', icon: '📊', targetRole: 'NURSE', targetLabel: 'Enfermería' },
    CRON_SYSTEM: { bg: 'bg-teal-100 text-teal-700 border-teal-200', label: 'Sistema', icon: '⚙️', targetRole: 'ADMIN', targetLabel: 'Administración' },
    MANUAL: { bg: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Manual', icon: '✏️', targetRole: 'SUPERVISOR', targetLabel: 'Supervisor' },
};

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
    OPEN: { bg: 'bg-rose-500 text-white', label: 'Abierto' },
    IN_PROGRESS: { bg: 'bg-amber-500 text-white', label: 'En Proceso' },
    RESOLVED: { bg: 'bg-emerald-500 text-white', label: 'Resuelto' },
};

export default function TriageCenterPage() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<TriageTicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState<any[]>([]);
    const [showResolved, setShowResolved] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Resolución
    const [resolutionNote, setResolutionNote] = useState("");
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    // Notas de seguimiento
    const [followUpText, setFollowUpText] = useState("");
    const [addingNoteToId, setAddingNoteToId] = useState<string | null>(null);

    const hqId = user?.hqId || user?.headquartersId || '';

    const fetchTickets = async () => {
        if (!hqId) return;
        try {
            const url = `/api/corporate/triage/pending?hqId=${hqId}${showResolved ? '&includeResolved=true' : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) setTickets(data.tickets);
        } catch (e) {
            console.error("Error fetching triage tickets:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        if (!hqId) return;
        try {
            const res = await fetch(`/api/hr/staff?hqId=${hqId}`);
            const data = await res.json();
            if (Array.isArray(data)) setStaff(data);
            else if (data.success && Array.isArray(data.staff)) setStaff(data.staff);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (!user) return;
        fetchTickets();
        fetchStaff();
    }, [user, showResolved]);

    useEffect(() => {
        if (!hqId) return;
        const interval = setInterval(fetchTickets, 30000);
        return () => clearInterval(interval);
    }, [hqId, showResolved]);

    const updateTicket = async (ticketId: string, payload: any) => {
        setUpdatingId(ticketId);
        try {
            const res = await fetch("/api/corporate/triage/resolve", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId, ...payload })
            });
            const data = await res.json();
            if (data.success) await fetchTickets();
        } catch (e) { console.error(e); }
        finally { setUpdatingId(null); }
    };

    const handleResolve = async (ticketId: string) => {
        await updateTicket(ticketId, {
            status: 'RESOLVED',
            resolvedById: user?.id,
            resolutionNote: resolutionNote || 'Resuelto sin nota adicional.',
        });
        setResolvingId(null);
        setResolutionNote("");
    };

    const handleAddFollowUp = async (ticketId: string) => {
        if (!followUpText.trim()) return;
        await updateTicket(ticketId, {
            followUpNote: {
                authorId: user?.id,
                authorName: user?.name || 'Director',
                note: followUpText.trim(),
            }
        });
        setAddingNoteToId(null);
        setFollowUpText("");
    };

    const getRelevantStaff = (originType: string) => {
        const config = ORIGIN_CONFIG[originType];
        if (!config) return staff;
        const targetRole = config.targetRole;
        // Mostrar primero los del rol target, luego el resto
        const target = staff.filter((s: any) => s.role === targetRole);
        const rest = staff.filter((s: any) => s.role !== targetRole);
        return [...target, ...rest];
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `hace ${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `hace ${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `hace ${days}d`;
    };

    const openTickets = tickets.filter(t => t.status !== 'RESOLVED');
    const criticalCount = openTickets.filter(t => t.priority === 'CRITICAL').length;
    const inProgressCount = openTickets.filter(t => t.status === 'IN_PROGRESS').length;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 animate-pulse">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                <p className="text-lg font-bold text-slate-500">Cargando Centro de Triage...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                    <Link href="/corporate" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition mb-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                        <ArrowLeft className="w-4 h-4" /> Dashboard
                    </Link>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <ShieldAlert className="w-10 h-10 text-indigo-600" /> Centro de Triage
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Seguimiento de reportes clínicos, mantenimiento y familiares — sin SLA automático.</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {criticalCount > 0 && (
                        <div className="bg-rose-50 border border-rose-200 px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm">
                            <AlertOctagon className="w-5 h-5 text-rose-600 animate-pulse" />
                            <span className="font-black text-rose-800 text-lg">{criticalCount}</span>
                            <span className="text-rose-600 text-xs font-bold uppercase tracking-wider">Críticos</span>
                        </div>
                    )}
                    <div className="bg-amber-50 border border-amber-200 px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm">
                        <Activity className="w-5 h-5 text-amber-600" />
                        <span className="font-black text-amber-800 text-lg">{inProgressCount}</span>
                        <span className="text-amber-600 text-xs font-bold uppercase tracking-wider">En Proceso</span>
                    </div>
                    <div className="bg-white border border-slate-200 px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm">
                        <ShieldAlert className="w-5 h-5 text-indigo-600" />
                        <span className="font-black text-slate-800 text-lg">{openTickets.length}</span>
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Activos</span>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setShowResolved(!showResolved)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${showResolved ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                >
                    {showResolved ? 'Ocultando Resueltos ✕' : 'Mostrar Historial Resuelto'}
                </button>
                <span className="text-xs text-slate-400 font-medium">Auto-refresh: 30s</span>
            </div>

            {/* Tickets */}
            {tickets.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-12 text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-black text-emerald-800 mb-2">Operación Estable</h3>
                    <p className="text-emerald-600 font-medium">No hay tickets activos en el Centro de Triage.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tickets.map(ticket => {
                        const prioCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
                        const originCfg = ORIGIN_CONFIG[ticket.originType] || ORIGIN_CONFIG.MANUAL;
                        const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
                        const isResolved = ticket.status === 'RESOLVED';
                        const borderColor = ticket.priority === 'CRITICAL' ? 'border-l-rose-500' :
                            ticket.priority === 'HIGH' ? 'border-l-amber-500' :
                            ticket.priority === 'MEDIUM' ? 'border-l-yellow-400' : 'border-l-slate-300';
                        const relevantStaff = getRelevantStaff(ticket.originType);
                        const followUps: FollowUpNote[] = Array.isArray(ticket.followUpNotes) ? ticket.followUpNotes : [];

                        return (
                            <div key={ticket.id} className={`bg-white rounded-2xl border border-slate-200 border-l-[6px] ${borderColor} shadow-sm transition-all hover:shadow-md ${isResolved ? 'opacity-60' : ''}`}>
                                <div className="p-6 flex flex-col lg:flex-row gap-6">
                                    {/* Content */}
                                    <div className="flex-1 space-y-3">
                                        {/* Badges row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${prioCfg.bg}`}>
                                                {prioCfg.icon} {prioCfg.label}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${originCfg.bg}`}>
                                                {originCfg.icon} {originCfg.label}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${statusCfg.bg}`}>
                                                {statusCfg.label}
                                            </span>
                                            {ticket.isEscalated && (
                                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-rose-600 text-white animate-pulse">
                                                    Escalado
                                                </span>
                                            )}
                                        </div>

                                        {/* Routing hint */}
                                        {ticket.status === 'OPEN' && (
                                            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                                <span>Destino sugerido:</span>
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold border border-slate-200">
                                                    {originCfg.targetLabel}
                                                </span>
                                            </div>
                                        )}

                                        {/* Description */}
                                        <p className="text-base font-bold text-slate-800 leading-relaxed">
                                            {ticket.description.length > 200 ? ticket.description.substring(0, 200) + '...' : ticket.description}
                                        </p>

                                        {/* Meta */}
                                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium flex-wrap">
                                            {ticket.patient && (
                                                <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                                    <User className="w-3 h-3" />
                                                    {ticket.patient.name}
                                                    {ticket.patient.roomNumber && <span className="text-slate-400">· Hab. {ticket.patient.roomNumber}</span>}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {timeAgo(ticket.createdAt)}
                                            </span>
                                            {ticket.assignedTo && (
                                                <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                                                    <Send className="w-3 h-3" /> {ticket.assignedTo.name} <span className="text-indigo-400">({ticket.assignedTo.role})</span>
                                                </span>
                                            )}
                                            {ticket.resolvedBy && (
                                                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                    <CheckCircle2 className="w-3 h-3" /> Cerrado por {ticket.resolvedBy.name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Follow-up notes timeline */}
                                        {followUps.length > 0 && (
                                            <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                    <MessageSquarePlus className="w-3 h-3" /> Notas de Seguimiento ({followUps.length})
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

                                        {/* Resolution note */}
                                        {ticket.resolutionNote && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-medium">
                                                <span className="font-black text-xs uppercase tracking-wider text-emerald-600 block mb-1">Nota de Resolución</span>
                                                {ticket.resolutionNote}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions Panel */}
                                    {!isResolved && (
                                        <div className="shrink-0 flex flex-col gap-3 w-full lg:w-60">

                                            {/* Smart Assign Dropdown — filtered by ticket type */}
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                    Asignar a {originCfg.targetLabel}
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={ticket.assignedToId || ''}
                                                        onChange={(e) => updateTicket(ticket.id, { assignedToId: e.target.value || null })}
                                                        disabled={updatingId === ticket.id}
                                                        className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 pr-8 disabled:opacity-50"
                                                    >
                                                        <option value="">Seleccionar responsable...</option>
                                                        {relevantStaff.map((s: any, i: number) => {
                                                            const isTarget = s.role === originCfg.targetRole;
                                                            return (
                                                                <option key={s.id} value={s.id}>
                                                                    {isTarget ? '★ ' : ''}{s.name} ({s.role})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* Status: OPEN → IN_PROGRESS */}
                                            {ticket.status === 'OPEN' && !ticket.assignedToId && (
                                                <button
                                                    onClick={() => updateTicket(ticket.id, { status: 'IN_PROGRESS' })}
                                                    disabled={updatingId === ticket.id}
                                                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {updatingId === ticket.id ? '...' : 'Marcar En Proceso'}
                                                </button>
                                            )}

                                            {/* Add follow-up note */}
                                            {addingNoteToId === ticket.id ? (
                                                <div className="space-y-2">
                                                    <textarea
                                                        value={followUpText}
                                                        onChange={(e) => setFollowUpText(e.target.value)}
                                                        placeholder="Nota de progreso..."
                                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none h-20"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleAddFollowUp(ticket.id)}
                                                            disabled={updatingId === ticket.id || !followUpText.trim()}
                                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                                                        >
                                                            <Send className="w-3 h-3" /> Agregar
                                                        </button>
                                                        <button
                                                            onClick={() => { setAddingNoteToId(null); setFollowUpText(""); }}
                                                            className="px-3 bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-200"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setAddingNoteToId(ticket.id); setFollowUpText(""); }}
                                                    className="w-full bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <MessageSquarePlus className="w-3.5 h-3.5" /> Nota de Seguimiento
                                                </button>
                                            )}

                                            {/* Resolve */}
                                            {resolvingId === ticket.id ? (
                                                <div className="space-y-2 border-t border-slate-100 pt-3">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block">Cerrar Ticket</label>
                                                    <input
                                                        type="text"
                                                        value={resolutionNote}
                                                        onChange={(e) => setResolutionNote(e.target.value)}
                                                        placeholder="Nota de resolución..."
                                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleResolve(ticket.id)}
                                                            disabled={updatingId === ticket.id}
                                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            Confirmar Cierre
                                                        </button>
                                                        <button
                                                            onClick={() => { setResolvingId(null); setResolutionNote(""); }}
                                                            className="px-3 bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-200"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setResolvingId(ticket.id); setResolutionNote(""); }}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95"
                                                >
                                                    Resolver Ticket
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
