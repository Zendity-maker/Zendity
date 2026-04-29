"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
    BookOpen, ChevronLeft, ChevronRight, Filter, RefreshCw,
    Moon, Sun, Sunset, Clock, CheckCircle2, AlertCircle,
    User, Shield, Star, Eye, ChevronDown, ChevronUp,
    ClipboardList, Circle
} from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    MORNING:       { label: "Mañana",      icon: <Sun size={14} />,    color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
    EVENING:       { label: "Tarde",       icon: <Sunset size={14} />, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
    NIGHT:         { label: "Noche",       icon: <Moon size={14} />,   color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
    FULL_DAY:      { label: "Día completo (12h)",  icon: <Sun size={14} />,    color: "text-teal-700",   bg: "bg-teal-50 border-teal-200" },
    FULL_NIGHT:    { label: "Noche completa (12h)", icon: <Moon size={14} />,  color: "text-slate-700",  bg: "bg-slate-100 border-slate-200" },
    SUPERVISOR_DAY:{ label: "Supervisor",  icon: <Shield size={14} />, color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
};

const COLOR_DOTS: Record<string, string> = {
    RED:    "bg-rose-500",
    YELLOW: "bg-amber-400",
    GREEN:  "bg-emerald-500",
    BLUE:   "bg-blue-500",
    ALL:    "bg-slate-400",
};

const today = () => new Date().toISOString().split("T")[0];
const thirtyDaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-PR", {
        day: "2-digit", month: "short", year: "numeric",
    });
}
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-PR", {
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}
function fmtDateTime(iso: string) {
    return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ShiftLogPage() {
    const { user } = useAuth();

    // Filtros
    const [from, setFrom]             = useState(thirtyDaysAgo());
    const [to, setTo]                 = useState(today());
    const [shiftType, setShiftType]   = useState("");
    const [status, setStatus]         = useState("");
    const [page, setPage]             = useState(1);
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Datos
    const [records, setRecords]       = useState<any[]>([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 25, totalPages: 1 });
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);

    // Detalle expandido
    const [expanded, setExpanded]     = useState<string | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchLog = useCallback(async (p = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (from)      params.set("from", from);
            if (to)        params.set("to", to);
            if (shiftType) params.set("shiftType", shiftType);
            if (status)    params.set("status", status);
            params.set("page", String(p));

            const res  = await fetch(`/api/corporate/hr/shift-log?${params.toString()}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Error cargando bitácora");
            setRecords(data.records);
            setPagination(data.pagination);
        } catch (e: any) {
            setError(e.message || "Error desconocido");
        }
        setLoading(false);
    }, [from, to, shiftType, status]);

    useEffect(() => {
        setPage(1);
        fetchLog(1);
    }, [fetchLog]);

    const handlePageChange = (p: number) => {
        setPage(p);
        fetchLog(p);
    };

    // ── Status badge ───────────────────────────────────────────────────────
    function StatusBadge({ r }: { r: any }) {
        if (r.status === "ACCEPTED") {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={10} strokeWidth={3} /> Firmado
                </span>
            );
        }
        if (r.seniorConfirmedAt) {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                    <Star size={10} strokeWidth={3} /> Confirmado
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <AlertCircle size={10} strokeWidth={3} /> Pendiente
            </span>
        );
    }

    // ── Fila expandida ─────────────────────────────────────────────────────
    function ExpandedRow({ r }: { r: any }) {
        return (
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cronología de firmas */}
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Cronología del turno</h4>
                    <ol className="space-y-2.5 text-sm">
                        <TimelineItem
                            label="Cierre registrado"
                            date={r.signedOutAt || r.createdAt}
                            name={r.outgoingNurse?.name}
                            color="bg-teal-500"
                            icon={<Clock size={11} />}
                        />
                        {r.seniorConfirmedAt && (
                            <TimelineItem
                                label="Confirmado por Senior"
                                date={r.seniorConfirmedAt}
                                name={r.seniorCaregiver?.name}
                                color="bg-blue-500"
                                icon={<Star size={11} />}
                            />
                        )}
                        {r.supervisorSignedAt && (
                            <TimelineItem
                                label="Firmado por Supervisor"
                                date={r.supervisorSignedAt}
                                name={r.supervisorSigned?.name}
                                color="bg-emerald-500"
                                icon={<Shield size={11} />}
                            />
                        )}
                        {r.directorViewedAt && (
                            <TimelineItem
                                label="Visto por Director"
                                date={r.directorViewedAt}
                                name={user?.name}
                                color="bg-violet-500"
                                icon={<Eye size={11} />}
                            />
                        )}
                    </ol>
                </div>

                {/* Resumen Zendi */}
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Resumen Zendi</h4>
                    {r.aiSummaryPreview ? (
                        <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-xl p-3">
                            {r.aiSummaryPreview}
                            {r.aiSummaryPreview.length >= 300 && (
                                <Link
                                    href={`/care/reports/${r.id}`}
                                    className="ml-1 text-teal-600 font-bold hover:underline text-xs"
                                >
                                    ver completo →
                                </Link>
                            )}
                        </p>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Sin resumen Zendi.</p>
                    )}
                    {r.supervisorNote && (
                        <div className="mt-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Nota del supervisor</p>
                            <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-3">
                                {r.supervisorNote}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    function TimelineItem({ label, date, name, color, icon }: {
        label: string; date: string; name?: string; color: string; icon: React.ReactNode;
    }) {
        return (
            <li className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full ${color} text-white flex items-center justify-center shrink-0 mt-0.5`}>
                    {icon}
                </div>
                <div>
                    <p className="font-bold text-slate-700 text-xs">{label}</p>
                    <p className="text-[11px] text-slate-500">{fmtDateTime(date)}{name ? ` · ${name}` : ""}</p>
                </div>
            </li>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-100">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">

                {/* ── Cabecera ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0 shadow">
                            <BookOpen className="w-7 h-7 text-teal-400" strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                                Bitácora General de Turnos
                            </h1>
                            <p className="text-sm text-slate-500 font-bold mt-0.5 uppercase tracking-widest">
                                Historial completo de cierres · {pagination.total} registros
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchLog(page)}
                            disabled={loading}
                            className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            Actualizar
                        </button>
                        <button
                            onClick={() => setFiltersOpen(v => !v)}
                            className="flex items-center gap-2 text-sm font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 px-4 py-2 rounded-xl transition shadow-sm"
                        >
                            <Filter size={14} />
                            Filtros
                            {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                    </div>
                </div>

                {/* ── Panel de filtros ── */}
                {filtersOpen && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Desde</label>
                                <input
                                    type="date"
                                    value={from}
                                    onChange={e => setFrom(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Hasta</label>
                                <input
                                    type="date"
                                    value={to}
                                    onChange={e => setTo(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Turno</label>
                                <select
                                    value={shiftType}
                                    onChange={e => setShiftType(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-400 outline-none bg-white"
                                >
                                    <option value="">Todos</option>
                                    <option value="MORNING">Mañana</option>
                                    <option value="EVENING">Tarde</option>
                                    <option value="NIGHT">Noche</option>
                                    <option value="FULL_DAY">Día completo (12h)</option>
                                    <option value="FULL_NIGHT">Noche completa (12h)</option>
                                    <option value="SUPERVISOR_DAY">Supervisor</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Estado</label>
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-400 outline-none bg-white"
                                >
                                    <option value="">Todos</option>
                                    <option value="PENDING">Pendiente</option>
                                    <option value="ACCEPTED">Firmado</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Tabla / Lista ── */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                    {/* Header de columnas — solo desktop */}
                    <div className="hidden md:grid grid-cols-[1fr_140px_180px_130px_90px_48px] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Turno / Empleado</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha de cierre</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Notas</span>
                        <span></span>
                    </div>

                    {loading && (
                        <div className="flex items-center justify-center py-16 text-slate-400">
                            <RefreshCw size={20} className="animate-spin mr-2" /> Cargando bitácora...
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex items-center justify-center py-16 text-rose-500 font-bold gap-2">
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    {!loading && !error && records.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                            <ClipboardList size={36} strokeWidth={1.5} />
                            <p className="font-bold">No hay registros para los filtros seleccionados.</p>
                        </div>
                    )}

                    {!loading && !error && records.map((r, idx) => {
                        const shift = SHIFT_LABELS[r.shiftType] ?? { label: r.shiftType, icon: <Clock size={14} />, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" };
                        const isExpanded = expanded === r.id;
                        const isLast = idx === records.length - 1;

                        return (
                            <React.Fragment key={r.id}>
                                {/* ── Fila principal ── */}
                                <div
                                    className={`grid grid-cols-1 md:grid-cols-[1fr_140px_180px_130px_90px_48px] gap-4 px-6 py-4 items-center cursor-pointer hover:bg-slate-50 transition-colors ${!isLast || isExpanded ? "border-b border-slate-100" : ""}`}
                                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                                >
                                    {/* Empleado */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                                            <User size={16} strokeWidth={2} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-extrabold text-slate-800 text-sm truncate">
                                                {r.outgoingNurse?.name ?? "Sin asignar"}
                                            </p>
                                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                {(r.colorGroups ?? []).map((c: string) => (
                                                    <span
                                                        key={c}
                                                        className={`w-2.5 h-2.5 rounded-full ${COLOR_DOTS[c] ?? "bg-slate-300"}`}
                                                        title={c}
                                                    />
                                                ))}
                                                {r.outgoingNurse?.role && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-0.5">
                                                        {r.outgoingNurse.role}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tipo de turno */}
                                    <div>
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold border px-2.5 py-1 rounded-full ${shift.color} ${shift.bg}`}>
                                            {shift.icon}
                                            {shift.label}
                                        </span>
                                    </div>

                                    {/* Fecha */}
                                    <div className="text-sm text-slate-600 font-medium">
                                        <span className="font-bold text-slate-700">{fmtDate(r.createdAt)}</span>
                                        <br />
                                        <span className="text-[11px] text-slate-400">{fmtTime(r.createdAt)}</span>
                                    </div>

                                    {/* Estado */}
                                    <div>
                                        <StatusBadge r={r} />
                                    </div>

                                    {/* # Notas */}
                                    <div className="text-center">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${r.notesCount > 0 ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-slate-100 text-slate-400"}`}>
                                            {r.notesCount}
                                        </span>
                                    </div>

                                    {/* Expand toggle */}
                                    <div className="flex justify-center text-slate-400">
                                        {isExpanded
                                            ? <ChevronUp size={16} strokeWidth={2.5} />
                                            : <ChevronDown size={16} strokeWidth={2.5} />
                                        }
                                    </div>
                                </div>

                                {/* ── Fila expandida ── */}
                                {isExpanded && <ExpandedRow r={r} />}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* ── Paginación ── */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500 font-medium">
                            Página {pagination.page} de {pagination.totalPages} · {pagination.total} registros
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page <= 1 || loading}
                                className="flex items-center gap-1 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl disabled:opacity-40 transition"
                            >
                                <ChevronLeft size={14} /> Anterior
                            </button>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page >= pagination.totalPages || loading}
                                className="flex items-center gap-1 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl disabled:opacity-40 transition"
                            >
                                Siguiente <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
