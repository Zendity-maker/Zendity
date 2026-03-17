"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';

export default function CorporateDashboardPage() {
    const [selectedFacility, setSelectedFacility] = useState("ALL");
    const [facilities, setFacilities] = useState<{ id: string, name: string }[]>([{ id: "ALL", name: "🌍 Consolidado Global (Todas las Sedes)" }]);
    const [rankingData, setRankingData] = useState<any[]>([]);
    const [kpis, setKpis] = useState({
        activeHqs: 0,
        totalCapacity: 0,
        totalPatients: 0,
        totalCriticalIncidents: 0,
        globalMedCompliance: 0
    });
    const [loading, setLoading] = useState(true);

    // Family Link (Fase 13)
    const [showInbox, setShowInbox] = useState(false);
    const [inboxThreads, setInboxThreads] = useState<any[]>([]);
    const [activeThread, setActiveThread] = useState<any>(null);
    const [replyContent, setReplyContent] = useState("");
    const [sendingReply, setSendingReply] = useState(false);

    useEffect(() => {
        async function loadDashboard() {
            try {
                const res = await fetch('/api/corporate');
                const data = await res.json();

                if (data.facilities) {
                    setFacilities([
                        { id: "ALL", name: "🌍 Consolidado Global (Todas las Sedes)" },
                        ...data.facilities.map((f: any) => ({ id: f.id, name: `🏥 ${f.name}` }))
                    ]);
                }
                if (data.ranking) setRankingData(data.ranking);
                if (data.kpis) setKpis(data.kpis);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        loadDashboard();
    }, []);

    // --- Family Link Polling ---
    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 30000); // Polling cada 30s
        return () => clearInterval(interval);
    }, []);

    const fetchMessages = async () => {
        try {
            const res = await fetch("/api/care/messages");
            const data = await res.json();
            if (data.success) {
                setInboxThreads(data.threads);
                if (activeThread) {
                    const updated = data.threads.find((t: any) => t.patient.id === activeThread.patient.id);
                    if (updated) setActiveThread(updated);
                }
            }
        } catch (e) {
            console.error("Error fetching inbox threads", e);
        }
    };

    const sendReply = async (patientId: string) => {
        if (!replyContent.trim()) return;
        setSendingReply(true);
        try {
            const res = await fetch("/api/care/messages", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId, content: replyContent })
            });
            const data = await res.json();
            if (data.success) {
                setReplyContent("");
                fetchMessages(); // Refrescar hilos
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSendingReply(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-teal-600 font-bold animate-pulse">Sincronizando Mando Central...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 1. Header & Global Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Gerencial</h1>
                    <p className="text-slate-500 mt-1">Visión consolidada y mando central de todas las dependencias.</p>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <select
                            value={selectedFacility}
                            onChange={(e) => setSelectedFacility(e.target.value)}
                            className="appearance-none bg-white border border-slate-200 text-slate-800 text-sm rounded-xl font-bold px-4 py-2.5 pr-10 hover:border-teal-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm transition-all cursor-pointer"
                        >
                            {facilities.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    {/* Botón Bandeja Family Link */}
                    <button
                        onClick={() => { setShowInbox(true); setActiveThread(null); }}
                        className="relative bg-white text-slate-800 border border-slate-200 hover:border-teal-400 font-bold py-2.5 px-5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                    >
                        <span>📨</span> Chats Familiares
                        {inboxThreads.some(t => t.unreadCount > 0) && (
                            <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                                {inboxThreads.reduce((acc, t) => acc + t.unreadCount, 0)}
                            </span>
                        )}
                    </button>

                    <Link href="/corporate/hr" className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        Directorio RRHH
                    </Link>

                    <Link href="/corporate/triage" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Centro de Triage
                    </Link>
                </div>
            </div>

            {/* 2. Top-Level KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: "Sedes Activas", value: kpis.activeHqs.toString(), sub: `Capacidad Total: ${kpis.totalCapacity} camas`, icon: "🏢", color: "bg-blue-50 text-blue-700 border-blue-100" },
                    { label: "Residentes Actuales", value: kpis.totalPatients.toString(), sub: `${kpis.totalCapacity > 0 ? Math.round((kpis.totalPatients / kpis.totalCapacity) * 100) : 0}% Ocupación`, icon: "👥", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                    { label: "Incidentes Críticos", value: kpis.totalCriticalIncidents.toString(), sub: "Consolidado total", icon: "⚠️", color: "bg-red-50 text-red-700 border-red-100" },
                    { label: "Cumplimiento Salud", value: `${kpis.globalMedCompliance}%`, sub: "Global eMAR", icon: "⚕️", color: "bg-purple-50 text-purple-700 border-purple-100" }
                ].map((kpi, i) => (
                    <div key={i} className={`rounded-2xl p-5 border shadow-sm ${kpi.color} transition-all hover:shadow-md`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{kpi.label}</p>
                                <h3 className="text-3xl font-black mt-1">{kpi.value}</h3>
                            </div>
                            <div className="text-2xl opacity-80">{kpi.icon}</div>
                        </div>
                        <p className="text-xs font-medium mt-3 opacity-90">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 3. Leaderboard & RRHH */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                🏆 Ranking de Desempeño por Sede
                            </h3>
                            <span className="text-xs font-semibold bg-teal-100 text-teal-800 px-2.5 py-1 rounded-md">Tiempo Real</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Sede / Facility</th>
                                        <th className="px-6 py-4 text-center">Score Empleados (RRHH)</th>
                                        <th className="px-6 py-4 text-center">Satisfacción Familiar</th>
                                        <th className="px-6 py-4 text-center">Cumplimiento eMAR</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rankingData && rankingData.map((row) => (
                                        <tr key={row.rank} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${row.rank === 1 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {row.rank}
                                                </span>
                                                {row.facility}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded font-bold text-xs ${row.empScore >= 90 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {row.empScore}/100
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-amber-400 text-base">★</span>
                                                    <span className="font-bold text-slate-700">{row.famSatisfaction}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-bold text-teal-700">{row.medsCompliance}%</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {rankingData.length === 0 && (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No hay datos de sedes registrados. Añade una sede para comenzar.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 4. Módulos Adicionales Panel */}
                <div className="space-y-6">


                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Módulos Corporativos</h3>
                        <div className="space-y-3">
                            {[
                                { title: 'Portal de Familiares', desc: 'Gestionar diarios y encuestas.', icon: '👨‍👩‍👧‍👦', active: true, href: '/family' },
                                { title: 'Evaluaciones RRHH', desc: 'Scorecard de empleados.', icon: '📋', active: true, href: '/hr' },
                                { title: 'Auditorías Dept. Familia', desc: 'Reportes regulatorios PR.', icon: '⚖️', active: true, href: '/corporate/hq' }
                            ].map((mod, i) => (
                                <Link href={mod.href} key={i} className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${mod.active ? 'border-slate-200 hover:border-teal-400 hover:shadow-sm bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                                    <div className="text-2xl mr-3">{mod.icon}</div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800">{mod.title}</h4>
                                        <p className="text-xs text-slate-500">{mod.desc}</p>
                                    </div>
                                    <div className="text-slate-300">›</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* INBOX MODAL (Family Link) FASE 13 */}
            {showInbox && (
                <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white rounded-[3rem] p-8 w-full max-w-lg shadow-2xl relative">
                        <button onClick={() => setShowInbox(false)} className="absolute top-6 right-6 w-12 h-12 bg-slate-100 text-slate-500 rounded-full font-bold">X</button>
                        <h3 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">📨 Centro de Mensajes</h3>

                        <div className="flex flex-col h-[600px] -mt-4">
                            {!activeThread ? (
                                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                    <p className="text-sm font-bold text-slate-400 mb-4 px-1">Consultas y Requerimientos de Familiares</p>
                                    {inboxThreads.length === 0 ? (
                                        <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold">Sin mensajes hoy. 😊</div>
                                    ) : (
                                        inboxThreads.map((thread: any, idx) => (
                                            <div key={idx} onClick={() => { setActiveThread(thread); fetchMessages(); }} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-teal-500 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-lg group-hover:text-teal-600">{thread.patient.name}</h4>
                                                    <p className="text-xs text-slate-400 font-bold uppercase">Cuarto {thread.patient.room} • {thread.messages.length} Mensajes Totales</p>
                                                </div>
                                                {thread.unreadCount > 0 && (
                                                    <span className="bg-rose-500 text-white font-black text-sm px-3 py-1 rounded-full">{thread.unreadCount} Nuevos</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative">
                                    {/* Hilo Específico */}
                                    <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                                        <button onClick={() => { setActiveThread(null); fetchMessages(); }} className="text-slate-400 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg">← Volver</button>
                                        <span className="font-black text-slate-800 text-lg">{activeThread.patient.name}</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col">
                                        {activeThread.messages.map((msg: any) => {
                                            const isStaff = msg.senderType === 'STAFF';
                                            return (
                                                <div key={msg.id} className={`max-w-[85%] p-4 rounded-2xl ${isStaff ? 'bg-teal-600 text-white self-end rounded-br-none shadow-md' : 'bg-white border border-slate-200 text-slate-800 self-start rounded-bl-none shadow-sm'}`}>
                                                    <p className="text-sm font-medium">{msg.content}</p>
                                                    <div className={`text-[10px] mt-2 font-bold text-right ${isStaff ? 'text-teal-200' : 'text-slate-400'}`}>
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {isStaff && '✓'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="p-4 bg-white border-t border-slate-200">
                                        <form onSubmit={(e) => { e.preventDefault(); sendReply(activeThread.patient.id); }} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={replyContent}
                                                onChange={(e) => setReplyContent(e.target.value)}
                                                placeholder="Escribe una respuesta autorizada..."
                                                className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-medium rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                                            />
                                            <button type="submit" disabled={sendingReply || !replyContent.trim()} className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black px-6 rounded-xl shadow-md transition-all">
                                                Enviar
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
