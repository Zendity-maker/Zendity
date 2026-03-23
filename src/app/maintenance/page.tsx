"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Wrench, Clock, CheckCircle2, AlertTriangle, Loader2, PlayCircle } from "lucide-react";

export default function MaintenanceDashboardPage() {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [kanban, setKanban] = useState({
        pending: [] as any[],
        inProgress: [] as any[],
        resolved: [] as any[]
    });
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (user) fetchTickets();
    }, [user]);

    const fetchTickets = async () => {
        const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
        try {
            const res = await fetch(`/api/maintenance?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) {
                setKanban({
                    pending: data.pending,
                    inProgress: data.inProgress,
                    resolved: data.resolved
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (eventId: string, newStatus: string) => {
        setIsUpdating(true);
        try {
            const res = await fetch("/api/maintenance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId,
                    status: newStatus,
                    mechanicId: user?.id
                })
            });
            if (res.ok) {
                fetchTickets();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-900">
            <Loader2 className="w-12 h-12 animate-spin text-teal-500" />
        </div>
    );

    return (
        <div className="flex w-full h-screen bg-slate-50 font-sans overflow-hidden">
            {/* Sidebar Técnico Simplificado */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-xl flex-shrink-0 z-50">
                <div className="h-20 flex items-center px-5 border-b border-white/10 relative">
                    <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md">
                            <Wrench className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black tracking-tight text-white leading-tight">Planta Física</h1>
                            <span className="text-[10px] uppercase font-black tracking-widest text-orange-400">Maintenance Hub</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1">
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Mecánico de Turno</p>
                        <p className="text-white font-bold text-lg leading-none">{user?.name}</p>
                    </div>

                    <div className="mt-8">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3 px-2">Métricas SLA Hoy</p>
                        <div className="space-y-2">
                            <div className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center border border-slate-700/50">
                                <span className="text-slate-400 font-medium text-sm">Resueltos</span>
                                <span className="text-emerald-400 font-black">{kanban.resolved.length}</span>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center border border-slate-700/50">
                                <span className="text-slate-400 font-medium text-sm">Pendientes</span>
                                <span className="text-rose-400 font-black">{kanban.pending.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10">
                    <button onClick={logout} className="w-full bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 font-bold py-3 rounded-xl transition-colors border border-slate-700 flex justify-center items-center gap-2">
                        <span></span> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Kanban Content */}
            <main className="flex-1 overflow-x-auto p-8 relative">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <Clock className="w-8 h-8 text-orange-500" />
                            Cola de Infraestructura (SLA)
                        </h2>
                        <p className="text-slate-500 font-medium mt-1">Los tiempos de resolución afectan directamente el Score de Desempeño Técnico.</p>
                    </div>
                    <button onClick={fetchTickets} className="bg-white border border-slate-200 text-slate-600 hover:text-orange-600 font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-2">
                        Actualizar Radares
                    </button>
                </div>

                <div className="flex gap-6 h-[calc(100vh-180px)] items-start">

                    {/* COLUMNA 1: PENDIENTES RED ALERT */}
                    <div className="w-1/3 min-w-[320px] bg-slate-200/50 rounded-3xl p-5 border border-slate-200 flex flex-col h-full overflow-hidden">
                        <h3 className="font-black text-rose-800 mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                                Nuevas Averías
                            </span>
                            <span className="bg-rose-200 text-rose-800 px-3 py-1 rounded-full text-xs">{kanban.pending.length}</span>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 pb-4">
                            {kanban.pending.map(ticket => (
                                <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 hover:border-rose-300 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-800">{ticket.title}</h4>
                                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded uppercase tracking-wider tabular-nums">
                                            {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium line-clamp-2">{ticket.description}</p>

                                    {ticket.photoUrl && (
                                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-100 h-24 relative">
                                            <img src={ticket.photoUrl} alt="Evidencia" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    <button
                                        onClick={() => handleUpdateStatus(ticket.id, 'IN_PROGRESS')}
                                        disabled={isUpdating}
                                        className="mt-4 w-full bg-slate-50 hover:bg-orange-500 text-slate-600 hover:text-white font-bold py-2.5 rounded-xl transition-colors border border-slate-200 hover:border-orange-500 flex justify-center items-center gap-2 text-sm"
                                    >
                                        <PlayCircle className="w-4 h-4" /> Iniciar Reparación
                                    </button>
                                </div>
                            ))}
                            {kanban.pending.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <CheckCircle2 className="w-12 h-12 mb-2 text-slate-300" />
                                    <p className="font-medium text-sm">Sin averías pendientes</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMNA 2: EN PROGRESO (SLA ACTIVO) */}
                    <div className="w-1/3 min-w-[320px] bg-sky-50 rounded-3xl p-5 border border-sky-100 flex flex-col h-full overflow-hidden">
                        <h3 className="font-black text-sky-800 mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Wrench className="w-5 h-5 text-sky-600" />
                                Trabajando
                            </span>
                            <span className="bg-sky-200 text-sky-800 px-3 py-1 rounded-full text-xs">{kanban.inProgress.length}</span>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 pb-4">
                            {kanban.inProgress.map(ticket => (
                                <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-md border-2 border-sky-400 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-sky-400 to-transparent opacity-20 pointer-events-none rounded-bl-full"></div>
                                    <h4 className="font-bold text-slate-800 mb-1 pr-6">{ticket.title}</h4>
                                    <p className="text-xs font-bold text-sky-600 uppercase mb-3 flex items-center gap-1">
                                        <Clock className="w-3 h-3 animate-pulse" /> SLA corriendo
                                    </p>

                                    <button
                                        onClick={() => handleUpdateStatus(ticket.id, 'RESOLVED')}
                                        disabled={isUpdating}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/30 active:scale-95 flex justify-center items-center gap-2 text-sm"
                                    >
                                        <CheckCircle2 className="w-5 h-5" /> Listo (Frenar Reloj)
                                    </button>
                                </div>
                            ))}
                            {kanban.inProgress.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-sky-700/50">
                                    <p className="font-medium text-sm">Nadie está reparando en la zona</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMNA 3: COMPLETADOS (SLA RECORDED) */}
                    <div className="w-1/3 min-w-[320px] bg-slate-100 rounded-3xl p-5 border border-slate-200 flex flex-col h-full overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                        <h3 className="font-black text-slate-700 mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                Historial
                            </span>
                            <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs">{kanban.resolved.length}</span>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-4">
                            {kanban.resolved.map(ticket => (
                                <div key={ticket.id} className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-between items-start gap-2 line-through decoration-slate-300 text-slate-500">
                                    <h4 className="font-bold text-sm leading-tight">{ticket.title}</h4>
                                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full border border-emerald-100 whitespace-nowrap">
                                         TDR: {ticket.resolutionTimeMinutes || '?'} min
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
