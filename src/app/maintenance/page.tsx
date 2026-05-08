"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Wrench, Clock, CheckCircle2, AlertTriangle, Loader2, Play, LogOut } from "lucide-react";

function cleanText(raw: string): string {
    if (!raw) return '';
    return raw
        .replace(/Reporte de Mantenimiento \/ Operación \[Severidad: \w+\]/gi, '')
        .replace(/\[Firmado por [a-f0-9-]+\]\s*-\s*/gi, '')
        .replace(/\[MANTENIMIENTO\]\s*/gi, '')
        .replace(/Incidente operativo:\s*/gi, '')
        // Quitar el prefijo de ubicación estructurado (se muestra aparte)
        .replace(/📍[^|]+\|\s*/g, '')
        .trim();
}

/** Extrae el prefijo de ubicación estructurado "📍 Baño · Hab. 101" */
function extractLocation(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/📍([^|]+)\|/);
    return match ? match[1].trim() : '';
}

export default function MaintenanceDashboardPage() {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [kanban, setKanban] = useState({ pending: [] as any[], inProgress: [] as any[], resolved: [] as any[] });
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    useEffect(() => { if (user) fetchTickets(); }, [user]);

    const fetchTickets = async () => {
        const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
        try {
            const res = await fetch(`/api/maintenance?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) setKanban({ pending: data.pending, inProgress: data.inProgress, resolved: data.resolved });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const updateStatus = async (eventId: string, status: string) => {
        setIsUpdating(eventId);
        try {
            const res = await fetch("/api/maintenance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId, status, mechanicId: user?.id })
            });
            if (res.ok) fetchTickets();
        } catch (e) { console.error(e); }
        finally { setIsUpdating(null); }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
            <Loader2 className="w-10 h-10 animate-spin text-orange-400" />
        </div>
    );

    const TicketCard = ({ ticket, col }: { ticket: any; col: 'pending' | 'inProgress' | 'resolved' }) => {
        // Intentar extraer ubicación del title o description (donde esté el emoji 📍)
        const rawTitle = ticket.title || '';
        const rawDesc = ticket.description || '';
        const locationFromTitle = extractLocation(rawTitle);
        const locationFromDesc = extractLocation(rawDesc);
        const location = locationFromTitle || locationFromDesc;

        const title = cleanText(rawTitle) || 'Reporte de mantenimiento';
        const desc = cleanText(rawDesc);
        const time = new Date(ticket.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
        const busy = isUpdating === ticket.id;

        return (
            <div className={`bg-white rounded-2xl p-4 border ${col === 'pending' ? 'border-slate-200' : col === 'inProgress' ? 'border-orange-300 shadow-md' : 'border-slate-100'}`}>
                {/* Hora */}
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{time}</p>

                {/* Ubicación badge — solo si existe */}
                {location && (
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">📍</span>
                        <span className="text-xs font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg">{location}</span>
                    </div>
                )}

                {/* Título principal */}
                <p className={`font-black text-base leading-snug mb-1 ${col === 'resolved' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {title}
                </p>

                {/* Descripción solo si es diferente al título */}
                {desc && desc !== title && (
                    <p className="text-sm text-slate-500 leading-relaxed mb-3">{desc}</p>
                )}

                {/* Foto */}
                {ticket.photoUrl && (
                    <div className="rounded-xl overflow-hidden h-28 mb-3 border border-slate-100">
                        <img src={ticket.photoUrl} alt="Evidencia" className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Acciones */}
                {col === 'pending' && (
                    <button onClick={() => updateStatus(ticket.id, 'IN_PROGRESS')} disabled={!!busy}
                        className="mt-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Iniciar
                    </button>
                )}
                {col === 'inProgress' && (
                    <button onClick={() => updateStatus(ticket.id, 'RESOLVED')} disabled={!!busy}
                        className="mt-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Marcar Resuelto
                    </button>
                )}
                {col === 'resolved' && ticket.resolutionTimeMinutes && (
                    <p className="text-xs font-bold text-emerald-600 mt-1">✓ Resuelto en {ticket.resolutionTimeMinutes} min</p>
                )}
            </div>
        );
    };

    return (
        <div className="flex w-full h-screen bg-slate-100 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 bg-slate-950 flex flex-col shrink-0">
                <div className="p-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
                            <Wrench className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm leading-none">Planta Física</p>
                            <p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Mantenimiento</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1 space-y-3">
                    <div>
                        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1">En turno</p>
                        <p className="text-white font-bold text-sm">{user?.name}</p>
                    </div>
                    <div className="pt-3 border-t border-white/5 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-xs">Pendientes</span>
                            <span className="text-rose-400 font-black text-sm">{kanban.pending.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-xs">En progreso</span>
                            <span className="text-orange-400 font-black text-sm">{kanban.inProgress.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-xs">Resueltos hoy</span>
                            <span className="text-emerald-400 font-black text-sm">{kanban.resolved.length}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10">
                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-rose-400 font-bold text-sm py-2 transition-colors">
                        <LogOut className="w-4 h-4" /> Salir
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-black text-slate-800 text-lg">Cola de Trabajo</h2>
                    <button onClick={fetchTickets}
                        className="text-xs font-bold text-slate-500 hover:text-orange-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-orange-300 transition-colors">
                        Actualizar
                    </button>
                </div>

                {/* Kanban */}
                <div className="flex-1 overflow-x-auto p-5">
                    <div className="flex gap-4 h-full min-w-[760px]">

                        {/* Pendientes */}
                        <div className="flex-1 flex flex-col min-w-[240px]">
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                <span className="font-black text-slate-700 text-sm">Nuevas</span>
                                <span className="ml-auto bg-rose-100 text-rose-700 text-xs font-black px-2 py-0.5 rounded-full">{kanban.pending.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {kanban.pending.map(t => <TicketCard key={t.id} ticket={t} col="pending" />)}
                                {kanban.pending.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                                        <CheckCircle2 className="w-8 h-8 mb-2" />
                                        <p className="text-sm font-medium">Sin averías</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* En progreso */}
                        <div className="flex-1 flex flex-col min-w-[240px]">
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Clock className="w-4 h-4 text-orange-500" />
                                <span className="font-black text-slate-700 text-sm">Trabajando</span>
                                <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-black px-2 py-0.5 rounded-full">{kanban.inProgress.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {kanban.inProgress.map(t => <TicketCard key={t.id} ticket={t} col="inProgress" />)}
                                {kanban.inProgress.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                                        <p className="text-sm font-medium">Nada en progreso</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Resueltos */}
                        <div className="flex-1 flex flex-col min-w-[240px]">
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="font-black text-slate-700 text-sm">Resueltos</span>
                                <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-0.5 rounded-full">{kanban.resolved.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {kanban.resolved.map(t => <TicketCard key={t.id} ticket={t} col="resolved" />)}
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
