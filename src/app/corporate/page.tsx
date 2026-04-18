"use client";

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, MessageSquare, CalendarDays, ArrowRight, Building2, Users, ClipboardList } from 'lucide-react';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

interface DynamicModules {
    openTriage: number;
    unreadFamily: number;
    draftSchedules: number;
}

export default function CorporateDashboardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [selectedFacility, setSelectedFacility] = useState("ALL");
    const [facilities, setFacilities] = useState<{ id: string, name: string }[]>([{ id: "ALL", name: " Consolidado Global (Todas las Sedes)" }]);
    const [canSelectFacility, setCanSelectFacility] = useState(false);
    const [rankingData, setRankingData] = useState<any[]>([]);
    const [dynamicModules, setDynamicModules] = useState<DynamicModules | null>(null);
    const [kpis, setKpis] = useState<{
        activeHqs: number;
        totalCapacity: number | null;
        totalPatients: number;
        totalCriticalIncidents: number;
        globalMedCompliance: number | null;
    }>({
        activeHqs: 0,
        totalCapacity: null,
        totalPatients: 0,
        totalCriticalIncidents: 0,
        globalMedCompliance: null
    });
    const [loading, setLoading] = useState(true);

    // Family Link (Fase 13)
    const [showInbox, setShowInbox] = useState(false);
    const [inboxThreads, setInboxThreads] = useState<any[]>([]);
    const [activeThread, setActiveThread] = useState<any>(null);
    const [replyContent, setReplyContent] = useState("");
    const [sendingReply, setSendingReply] = useState(false);

    // ── Guard de rol ──
    useEffect(() => {
        if (authLoading) return;
        if (!user) return;
        const role = (user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    // ── Cargar dashboard + polling 60s ──
    useEffect(() => {
        if (authLoading || !user) return;
        const role = (user as any).role;
        if (!ALLOWED_ROLES.includes(role)) return;

        let isMounted = true;

        async function loadDashboard(showSpinner: boolean) {
            if (showSpinner) setLoading(true);
            try {
                const timestamp = new Date().getTime();
                const res = await fetch(`/api/corporate?hqId=${selectedFacility}&t=${timestamp}`, {
                    cache: 'no-store'
                });
                const data = await res.json();
                if (!isMounted) return;

                if (data.success === false) {
                    console.warn('[corporate]', data.error);
                    return;
                }

                if (data.facilities) {
                    const canSelect = !!data.canSelectFacility;
                    setCanSelectFacility(canSelect);
                    if (canSelect) {
                        setFacilities([
                            { id: "ALL", name: " Consolidado Global (Todas las Sedes)" },
                            ...data.facilities.map((f: any) => ({ id: f.id, name: ` ${f.name}` }))
                        ]);
                    } else {
                        // SUPERVISOR: solo su sede, sin opción ALL
                        setFacilities(data.facilities.map((f: any) => ({ id: f.id, name: ` ${f.name}` })));
                        // Fijar el selector a la única sede
                        if (data.effectiveHqId && selectedFacility !== data.effectiveHqId) {
                            setSelectedFacility(data.effectiveHqId);
                        }
                    }
                }
                if (data.ranking) setRankingData(data.ranking);
                if (data.kpis) setKpis(data.kpis);
            } catch (error) {
                console.error(error);
            } finally {
                if (isMounted && showSpinner) setLoading(false);
            }
        }

        loadDashboard(true);
        const interval = setInterval(() => loadDashboard(false), 60000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [selectedFacility, user, authLoading]);

    // ── Cargar módulos dinámicos + polling 60s ──
    useEffect(() => {
        if (authLoading || !user) return;
        const role = (user as any).role;
        if (!ALLOWED_ROLES.includes(role)) return;

        let isMounted = true;

        async function loadModules() {
            try {
                const res = await fetch('/api/corporate/modules', { cache: 'no-store' });
                const data = await res.json();
                if (isMounted && data.success) {
                    setDynamicModules(data.modules);
                }
            } catch (err) {
                console.error('[modules]', err);
            }
        }

        loadModules();
        const interval = setInterval(loadModules, 60000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [user, authLoading]);

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

    if (loading) return (
        <div className="space-y-8 animate-pulse p-4 md:p-0">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center">
                <div className="space-y-3">
                    <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
                    <div className="h-4 w-48 bg-slate-100 rounded-md"></div>
                </div>
                <div className="h-12 w-48 bg-slate-200 rounded-xl hidden md:block"></div>
            </div>
            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-slate-100 rounded-2xl border border-slate-200/60 p-5">
                       <div className="h-4 w-24 bg-slate-200 rounded-md mb-4"></div>
                       <div className="h-8 w-16 bg-slate-200 rounded-lg"></div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Table Skeleton */}
                <div className="lg:col-span-2 h-96 bg-slate-100 rounded-2xl border border-slate-200/60"></div>
                {/* Modules Skeleton */}
                <div className="h-96 bg-slate-100 rounded-2xl border border-slate-200/60"></div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 1. Header & Global Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Gerencial</h1>
                    <p className="text-slate-500 mt-1">Visión consolidada y mando central de todas las dependencias.</p>
                </div>

                <div className="flex items-center space-x-4">
                    {canSelectFacility ? (
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
                    ) : facilities.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl font-bold px-4 py-2.5 inline-flex items-center gap-2 shadow-sm">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            {facilities[0].name.trim()}
                        </div>
                    )}

                    {/* Botón Bandeja Family Link */}
                    <button
                        onClick={() => { setShowInbox(true); setActiveThread(null); }}
                        className="relative bg-white text-slate-800 border border-slate-200 hover:border-teal-400 font-bold py-2.5 px-5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                    >
                        <span></span> Chats Familiares
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
                    {
                        label: "Sedes Activas",
                        value: kpis.activeHqs.toString(),
                        sub: kpis.totalCapacity !== null ? `Capacidad Total: ${kpis.totalCapacity} camas` : "Capacidad no registrada",
                        color: "bg-blue-50 text-blue-700 border-blue-100"
                    },
                    {
                        label: "Residentes Actuales",
                        value: kpis.totalPatients.toString(),
                        sub: (kpis.totalCapacity !== null && kpis.totalCapacity > 0)
                            ? `${Math.round((kpis.totalPatients / kpis.totalCapacity) * 100)}% Ocupación`
                            : "— Ocupación (sin capacidad)",
                        color: "bg-emerald-50 text-emerald-700 border-emerald-100"
                    },
                    {
                        label: "Incidentes Críticos",
                        value: kpis.totalCriticalIncidents.toString(),
                        sub: "Consolidado total",
                        color: "bg-red-50 text-red-700 border-red-100"
                    },
                    {
                        label: "Cumplimiento Salud",
                        value: kpis.globalMedCompliance !== null ? `${kpis.globalMedCompliance}%` : '—',
                        sub: kpis.globalMedCompliance !== null ? "Global eMAR" : "Sin administraciones registradas",
                        color: "bg-purple-50 text-purple-700 border-purple-100"
                    }
                ].map((kpi, i) => (
                    <div key={i} className={`rounded-2xl p-5 border shadow-sm ${kpi.color} transition-all hover:shadow-md`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{kpi.label}</p>
                                <h3 className="text-3xl font-black mt-1">{kpi.value}</h3>
                            </div>
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
                                 Ranking de Desempeño por Sede
                            </h3>
                            <span className="text-xs font-semibold bg-teal-100 text-teal-800 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
                                Tiempo Real · 60s
                            </span>
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
                                                {row.empScore !== null && row.empScore !== undefined ? (
                                                    <span className={`px-2.5 py-1 rounded font-bold text-xs ${row.empScore >= 90 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {row.empScore}/100
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold text-xs" title="Sin evaluaciones registradas">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {row.famSatisfaction !== null && row.famSatisfaction !== undefined ? (
                                                    <span className="font-bold text-slate-700">{row.famSatisfaction}%</span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold text-xs" title="Sin encuestas de satisfacción familiar">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {row.medsCompliance !== null && row.medsCompliance !== undefined ? (
                                                    <span className="font-bold text-teal-700">{row.medsCompliance}%</span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold text-xs" title="Sin administraciones de medicamentos">—</span>
                                                )}
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
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span>Módulos Corporativos</span>
                            {dynamicModules && (dynamicModules.openTriage + dynamicModules.unreadFamily + dynamicModules.draftSchedules) > 0 && (
                                <span className="text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                                    Acción requerida
                                </span>
                            )}
                        </h3>
                        <div className="space-y-3">
                            {(() => {
                                const dm = dynamicModules || { openTriage: 0, unreadFamily: 0, draftSchedules: 0 };
                                const hasAny = dm.openTriage + dm.unreadFamily + dm.draftSchedules > 0;

                                if (hasAny) {
                                    // Mostrar cards dinámicas basadas en actividad real
                                    const items: Array<{
                                        title: string;
                                        desc: string;
                                        href: string;
                                        count: number;
                                        badgeTone: 'rose' | 'teal' | 'amber';
                                        icon: React.ReactNode;
                                    }> = [];

                                    if (dm.openTriage > 0) {
                                        items.push({
                                            title: 'Triage Center',
                                            desc: `${dm.openTriage} ticket${dm.openTriage === 1 ? '' : 's'} abierto${dm.openTriage === 1 ? '' : 's'} hoy`,
                                            href: '/corporate/triage',
                                            count: dm.openTriage,
                                            badgeTone: 'rose',
                                            icon: <ShieldAlert className="w-4 h-4" />,
                                        });
                                    }
                                    if (dm.unreadFamily > 0) {
                                        items.push({
                                            title: 'Mensajes Familiares',
                                            desc: `${dm.unreadFamily} mensaje${dm.unreadFamily === 1 ? '' : 's'} sin leer hoy`,
                                            href: '/corporate/triage',
                                            count: dm.unreadFamily,
                                            badgeTone: 'teal',
                                            icon: <MessageSquare className="w-4 h-4" />,
                                        });
                                    }
                                    if (dm.draftSchedules > 0) {
                                        items.push({
                                            title: 'Horario Pendiente',
                                            desc: `${dm.draftSchedules} horario${dm.draftSchedules === 1 ? '' : 's'} sin publicar`,
                                            href: '/hr/schedule',
                                            count: dm.draftSchedules,
                                            badgeTone: 'amber',
                                            icon: <CalendarDays className="w-4 h-4" />,
                                        });
                                    }

                                    const toneClasses: Record<string, { card: string; badge: string; icon: string }> = {
                                        rose: {
                                            card: 'border-rose-200 hover:border-rose-300 bg-rose-50/40',
                                            badge: 'bg-rose-600 text-white',
                                            icon: 'bg-rose-100 text-rose-700',
                                        },
                                        teal: {
                                            card: 'border-teal-200 hover:border-teal-300 bg-teal-50/40',
                                            badge: 'bg-teal-600 text-white',
                                            icon: 'bg-teal-100 text-teal-700',
                                        },
                                        amber: {
                                            card: 'border-amber-200 hover:border-amber-300 bg-amber-50/40',
                                            badge: 'bg-amber-600 text-white',
                                            icon: 'bg-amber-100 text-amber-700',
                                        },
                                    };

                                    return items.map((mod, i) => {
                                        const tone = toneClasses[mod.badgeTone];
                                        return (
                                            <Link href={mod.href} key={i} className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${tone.card}`}>
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 ${tone.icon}`}>
                                                    {mod.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold text-slate-800">{mod.title}</h4>
                                                    <p className="text-xs text-slate-500 font-medium">{mod.desc}</p>
                                                </div>
                                                <span className={`min-w-[26px] h-6 px-2 rounded-full font-black text-xs flex items-center justify-center ${tone.badge}`}>
                                                    {mod.count}
                                                </span>
                                            </Link>
                                        );
                                    });
                                }

                                // Fallback: accesos rápidos estáticos cuando no hay actividad pendiente
                                const quickLinks = [
                                    { title: 'Triage Center', desc: 'Sin tickets abiertos hoy', href: '/corporate/triage', icon: <ShieldAlert className="w-4 h-4" /> },
                                    { title: 'Recursos Humanos', desc: 'Desempeño, evaluaciones y staff', href: '/hr', icon: <Users className="w-4 h-4" /> },
                                    { title: 'Zendity HQ', desc: 'Auditoría regulatoria', href: '/corporate/hq', icon: <ClipboardList className="w-4 h-4" /> },
                                ];
                                return quickLinks.map((mod, i) => (
                                    <Link href={mod.href} key={i} className="flex items-center p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer group">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mr-3 bg-slate-100 text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors">
                                            {mod.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-800">{mod.title}</h4>
                                            <p className="text-xs text-slate-500 font-medium">{mod.desc}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                                    </Link>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* INBOX MODAL (Family Link) FASE 13 */}
            {showInbox && (
                <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl relative">
                        <button onClick={() => setShowInbox(false)} className="absolute top-6 right-6 w-12 h-12 bg-slate-100 text-slate-500 rounded-full font-bold">X</button>
                        <h3 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3"> Centro de Mensajes</h3>

                        <div className="flex flex-col h-[600px] -mt-4">
                            {!activeThread ? (
                                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                    <p className="text-sm font-bold text-slate-500 mb-4 px-1">Consultas y Requerimientos de Familiares</p>
                                    {inboxThreads.length === 0 ? (
                                        <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 font-bold">Sin mensajes hoy. </div>
                                    ) : (
                                        inboxThreads.map((thread: any, idx) => (
                                            <div key={idx} onClick={() => { setActiveThread(thread); fetchMessages(); }} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-teal-500 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-lg group-hover:text-teal-600">{thread.patient.name}</h4>
                                                    <p className="text-xs text-slate-500 font-bold uppercase">Cuarto {thread.patient.room}  {thread.messages.length} Mensajes Totales</p>
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
                                        <button onClick={() => { setActiveThread(null); fetchMessages(); }} className="text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg">← Volver</button>
                                        <span className="font-black text-slate-800 text-lg">{activeThread.patient.name}</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col">
                                        {activeThread.messages.map((msg: any) => {
                                            const isStaff = msg.senderType === 'STAFF';
                                            return (
                                                <div key={msg.id} className={`max-w-[85%] p-4 rounded-2xl ${isStaff ? 'bg-teal-600 text-white self-end rounded-br-none shadow-md' : 'bg-white border border-slate-200 text-slate-800 self-start rounded-bl-none shadow-sm'}`}>
                                                    <p className="text-sm font-medium">{msg.content}</p>
                                                    <div className={`text-[10px] mt-2 font-bold text-right ${isStaff ? 'text-teal-200' : 'text-slate-500'}`}>
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {isStaff && ''}
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
