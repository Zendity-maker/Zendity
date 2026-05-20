"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw, Filter } from "lucide-react";

type Ticket = {
    id: string;
    category: string;
    description: string;
    status: string;
    adminNote: string | null;
    createdAt: string;
    submittedBy: { name: string; role: string };
    headquarters: { name: string };
};

const CATEGORY_ICONS: Record<string, string> = {
    BUG:      "🐛",
    QUESTION: "❓",
    FEATURE:  "💡",
    URGENT:   "🚨",
};

const STATUS_STYLES: Record<string, string> = {
    OPEN:        "bg-amber-100 text-amber-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    RESOLVED:    "bg-green-100 text-green-700",
    CLOSED:      "bg-slate-100 text-slate-500",
};

function timeAgo(date: string): string {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 60) return `hace ${diff}m`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    return `hace ${Math.floor(diff / 1440)}d`;
}

export default function AdminSupportPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [updating, setUpdating] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/support/tickets");
            const data = await res.json();
            if (data.success) setTickets(data.tickets);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const updateStatus = async (id: string, status: string) => {
        setUpdating(id);
        try {
            const res = await fetch(`/api/admin/support/tickets/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
            }
        } finally {
            setUpdating(null);
        }
    };

    const filtered = statusFilter === "ALL"
        ? tickets
        : tickets.filter(t => t.status === statusFilter);

    const counts = {
        ALL:        tickets.length,
        OPEN:       tickets.filter(t => t.status === "OPEN").length,
        IN_PROGRESS: tickets.filter(t => t.status === "IN_PROGRESS").length,
        RESOLVED:   tickets.filter(t => t.status === "RESOLVED").length,
    };

    return (
        <div className="max-w-5xl mx-auto pb-16 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Tickets de Soporte</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Solicitudes de todas las sedes</p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Actualizar
                </button>
            </div>

            {/* KPI chips */}
            <div className="flex flex-wrap gap-2 mb-6">
                {[
                    { key: "ALL",         label: `Todos (${counts.ALL})`,             active: "bg-slate-800 text-white" },
                    { key: "OPEN",        label: `🟡 Abiertos (${counts.OPEN})`,       active: "bg-amber-500 text-white" },
                    { key: "IN_PROGRESS", label: `🔵 En proceso (${counts.IN_PROGRESS})`, active: "bg-blue-500 text-white" },
                    { key: "RESOLVED",    label: `🟢 Resueltos (${counts.RESOLVED})`,  active: "bg-emerald-600 text-white" },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            statusFilter === f.key
                                ? f.active + " border-transparent"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Ticket list */}
            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400">No hay tickets en esta categoría.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(ticket => (
                        <div key={ticket.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <span className="text-lg">{CATEGORY_ICONS[ticket.category] || "📋"}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[ticket.status] || "bg-slate-100 text-slate-500"}`}>
                                            {ticket.status.replace("_", " ")}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {ticket.category}
                                        </span>
                                        <span className="text-xs text-slate-400">{timeAgo(ticket.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mb-3">
                                        {ticket.description}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                        <span className="font-semibold text-teal-700">{ticket.headquarters?.name}</span>
                                        <span>·</span>
                                        <span>{ticket.submittedBy?.name}</span>
                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                            {ticket.submittedBy?.role}
                                        </span>
                                    </div>
                                </div>

                                {/* Acciones rápidas */}
                                <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    {ticket.status !== "IN_PROGRESS" && ticket.status !== "RESOLVED" && (
                                        <button
                                            onClick={() => updateStatus(ticket.id, "IN_PROGRESS")}
                                            disabled={updating === ticket.id}
                                            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap disabled:opacity-50"
                                        >
                                            {updating === ticket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "En proceso"}
                                        </button>
                                    )}
                                    {ticket.status !== "RESOLVED" && (
                                        <button
                                            onClick={() => updateStatus(ticket.id, "RESOLVED")}
                                            disabled={updating === ticket.id}
                                            className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 font-semibold rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap disabled:opacity-50"
                                        >
                                            {updating === ticket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Resolver"}
                                        </button>
                                    )}
                                    {ticket.status === "RESOLVED" && (
                                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Resuelto
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
