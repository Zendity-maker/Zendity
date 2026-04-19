"use client";

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useActiveHq } from "@/contexts/ActiveHqContext";
import { ShieldAlert, MessageSquare, CalendarDays, ArrowRight, Building2, Users, ClipboardList, TrendingUp, TrendingDown, Minus, Activity, HeartPulse, Bath, UtensilsCrossed, FileSignature, Siren, Sparkles, RefreshCw, AlertOctagon, UserCheck, Stethoscope, Radio } from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart, Line,
    BarChart, Bar,
    AreaChart, Area,
    XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

interface DynamicModules {
    openTriage: number;
    unreadFamily: number;
    draftSchedules: number;
}

interface TrendsData {
    days: number;
    activePatients: number;
    series: {
        emar: Array<{ date: string; compliance: number | null; total: number }>;
        handovers: Array<{ date: string; total: number; signed: number; pending: number; avgLatencyHours: number | null }>;
        vitals: Array<{ date: string; total: number; abnormal: number }>;
        triage: Array<{ date: string; opened: number; resolved: number; avgMttrHours: number | null }>;
        baths: Array<{ date: string; total: number; perPatient: number }>;
        meals: Array<{ date: string; total: number; uniquePatientMeals: number; coverage: number | null }>;
    };
    totals: {
        emarCurrent: number | null;
        emarPrev: number | null;
        handoversCurrentSigned: number;
        handoversPrevSigned: number;
        handoversCurrentTotal: number;
        vitalsCurrentAbnormal: number;
        vitalsPrevAbnormal: number;
        triageCurrent: number;
        triagePrev: number;
        bathsCurrent: number;
        bathsPrev: number;
        mealsCurrent: number;
        mealsPrev: number;
    };
    deltas: {
        deltaMeds: number | null;
        deltaHandoversSigned: number | null;
        deltaVitalsAbnormal: number | null;
        deltaTriage: number | null;
        deltaBaths: number | null;
        deltaMeals: number | null;
    };
}

// Formateador de fecha corta para eje X
function formatShortDate(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
}

// Componente delta pill (flecha + porcentaje)
function DeltaPill({ value, suffix = '%', inverted = false }: { value: number | null; suffix?: string; inverted?: boolean }) {
    if (value === null) {
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400"><Minus size={10} /> s/d</span>;
    }
    const positive = value > 0;
    const negative = value < 0;
    // inverted=true significa "bajar es bueno" (ej: vitales anómalos, triage)
    const goodUp = !inverted;
    const isGood = (positive && goodUp) || (negative && !goodUp);
    const isBad = (negative && goodUp) || (positive && !goodUp);
    const color = value === 0 ? 'text-slate-500' : isGood ? 'text-[#22A06B]' : isBad ? 'text-[#D9534F]' : 'text-slate-500';
    const Icon = value === 0 ? Minus : positive ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${color}`}>
            <Icon size={10} />
            {value > 0 ? '+' : ''}{value}{suffix}
        </span>
    );
}

export default function CorporateDashboardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { activeHqId, activeHqName, setActiveHq, accessibleHqs, isMultiHqRole } = useActiveHq();
    // Compat: mantener el mismo nombre en el resto del archivo, pero ahora proviene del contexto global
    const selectedFacility = activeHqId;
    const setSelectedFacility = (id: string | 'ALL') => {
        if (id === 'ALL') {
            setActiveHq('ALL', 'Todas las sedes');
        } else {
            const hq = accessibleHqs.find(h => h.id === id);
            setActiveHq(id, hq?.name || 'Sede');
        }
    };
    const [facilities, setFacilities] = useState<{ id: string, name: string }[]>([{ id: "ALL", name: " Consolidado Global (Todas las Sedes)" }]);
    const canSelectFacility = isMultiHqRole;
    const [rankingData, setRankingData] = useState<any[]>([]);
    const [dynamicModules, setDynamicModules] = useState<DynamicModules | null>(null);
    const [trends, setTrends] = useState<TrendsData | null>(null);
    const [trendsLoading, setTrendsLoading] = useState(true);

    // Live chips (Sprint G-C)
    const [live, setLive] = useState<{
        chips: {
            activeCaregivers: number;
            bathsToday: number;
            mealsToday: number;
            incidentsWeek: number;
            triageOpen: number;
            handoversPending: number;
            zombiePatients: number;
            onHospitalLeave: number;
        };
        totals: { activePatients: number; handoversToday: number };
        timestamp: string;
    } | null>(null);

    // Zendi Director Briefing (Sprint G-B)
    const [briefing, setBriefing] = useState<{
        id: string;
        scope: string;
        clinicalDay: string;
        generatedAt: string;
        summary: string;
        bullets: Array<{ priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; title: string; description: string; action: string }>;
        model: string;
    } | null>(null);
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [briefingError, setBriefingError] = useState<string | null>(null);
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
                    // Sedes del selector: la lista ahora vive en el contexto global (accessibleHqs),
                    // pero mantenemos el array local para preservar el label "Consolidado Global".
                    if (isMultiHqRole) {
                        setFacilities([
                            { id: "ALL", name: " Consolidado Global (Todas las Sedes)" },
                            ...data.facilities.map((f: any) => ({ id: f.id, name: ` ${f.name}` }))
                        ]);
                    } else {
                        setFacilities(data.facilities.map((f: any) => ({ id: f.id, name: ` ${f.name}` })));
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
        const interval = setInterval(() => loadDashboard(false), 30000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [selectedFacility, user, authLoading]);

    // ── Live chips (Sprint G-C) + polling 30s ──
    useEffect(() => {
        if (authLoading || !user) return;
        const role = (user as any).role;
        if (!ALLOWED_ROLES.includes(role)) return;

        let isMounted = true;
        async function loadLive() {
            try {
                const res = await fetch(`/api/corporate/live?hqId=${selectedFacility}`, { cache: 'no-store' });
                const data = await res.json();
                if (!isMounted) return;
                if (data.success) {
                    setLive({ chips: data.chips, totals: data.totals, timestamp: data.timestamp });
                }
            } catch (err) {
                console.error('[live]', err);
            }
        }
        loadLive();
        const interval = setInterval(loadLive, 30000);
        return () => { isMounted = false; clearInterval(interval); };
    }, [selectedFacility, user, authLoading]);

    // ── Cargar módulos dinámicos + polling 30s ──
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
        const interval = setInterval(loadModules, 30000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [user, authLoading]);

    // ── Cargar tendencias + polling 60s ──
    useEffect(() => {
        if (authLoading || !user) return;
        const role = (user as any).role;
        if (!ALLOWED_ROLES.includes(role)) return;

        let isMounted = true;

        async function loadTrends(showSpinner: boolean) {
            if (showSpinner) setTrendsLoading(true);
            try {
                const res = await fetch(`/api/corporate/trends?hqId=${selectedFacility}&days=7`, { cache: 'no-store' });
                const data = await res.json();
                if (!isMounted) return;
                if (data.success) setTrends(data);
            } catch (err) {
                console.error('[trends]', err);
            } finally {
                if (isMounted && showSpinner) setTrendsLoading(false);
            }
        }

        loadTrends(true);
        const interval = setInterval(() => loadTrends(false), 30000);
        return () => { isMounted = false; clearInterval(interval); };
    }, [selectedFacility, user, authLoading]);

    // ── Cargar briefing del director al entrar / cambiar de sede ──
    useEffect(() => {
        if (authLoading || !user) return;
        const role = (user as any).role;
        if (!['DIRECTOR', 'ADMIN'].includes(role)) return;

        let isMounted = true;
        (async () => {
            try {
                const res = await fetch(`/api/corporate/director-briefing?hqId=${selectedFacility}`, { cache: 'no-store' });
                const data = await res.json();
                if (isMounted && data.success && data.briefing) {
                    setBriefing(data.briefing);
                }
            } catch (err) {
                console.error('[briefing GET]', err);
            }
        })();
        return () => { isMounted = false; };
    }, [selectedFacility, user, authLoading]);

    const regenerateBriefing = async (forceRefresh: boolean) => {
        setBriefingLoading(true);
        setBriefingError(null);
        try {
            const res = await fetch('/api/corporate/director-briefing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hqId: selectedFacility, forceRefresh }),
            });
            const data = await res.json();
            if (!data.success) {
                setBriefingError(data.error || 'No se pudo generar briefing');
            } else {
                setBriefing(data.briefing);
            }
        } catch (err: any) {
            setBriefingError(err.message || 'Error de red');
        } finally {
            setBriefingLoading(false);
        }
    };

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

    const isDirector = user && ['DIRECTOR', 'ADMIN'].includes((user as any).role);

    const priorityStyles: Record<string, { label: string; badge: string; card: string; icon: React.ReactNode }> = {
        CRITICAL: { label: 'Crítica', badge: 'bg-[#D9534F] text-white', card: 'bg-red-50 border-red-200', icon: <AlertOctagon size={14} /> },
        HIGH: { label: 'Alta', badge: 'bg-[#E5A93D] text-white', card: 'bg-amber-50 border-amber-200', icon: <AlertOctagon size={14} /> },
        MEDIUM: { label: 'Media', badge: 'bg-[#0F6B78] text-white', card: 'bg-teal-50 border-teal-200', icon: <Activity size={14} /> },
        LOW: { label: 'Baja', badge: 'bg-[#22A06B] text-white', card: 'bg-emerald-50 border-emerald-200', icon: <Sparkles size={14} /> },
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 0. Zendi Director Briefing (solo DIRECTOR/ADMIN) */}
            {isDirector && (
                <div className="bg-gradient-to-br from-[#0F6B78]/5 via-white to-[#E5A93D]/5 border border-[#0F6B78]/20 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#0F6B78] text-white flex items-center justify-center">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-[#1F2D3A] tracking-tight flex items-center gap-2">
                                    Zendi Director Briefing
                                    {briefing?.model === 'fallback' && (
                                        <span className="text-[9px] font-bold uppercase tracking-widest bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">heurístico</span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {briefing
                                        ? `Generado ${new Date(briefing.generatedAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })} · ${new Date(briefing.generatedAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short' })}`
                                        : 'Asistente estratégico con GPT-4o sobre el snapshot operativo.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!briefing && (
                                <button
                                    onClick={() => regenerateBriefing(false)}
                                    disabled={briefingLoading}
                                    className="bg-[#0F6B78] hover:bg-[#0d5a66] disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2"
                                >
                                    <Sparkles size={14} />
                                    {briefingLoading ? 'Generando...' : 'Generar briefing'}
                                </button>
                            )}
                            {briefing && (
                                <button
                                    onClick={() => regenerateBriefing(true)}
                                    disabled={briefingLoading}
                                    className="bg-white border border-[#0F6B78]/30 hover:border-[#0F6B78] text-[#0F6B78] text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                                >
                                    <RefreshCw size={14} className={briefingLoading ? 'animate-spin' : ''} />
                                    {briefingLoading ? 'Actualizando...' : 'Regenerar'}
                                </button>
                            )}
                        </div>
                    </div>

                    {briefingError && (
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm mb-3">
                            {briefingError}
                        </div>
                    )}

                    {briefing ? (
                        <>
                            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mb-3 text-sm text-[#1F2D3A] font-medium leading-relaxed">
                                {briefing.summary}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {briefing.bullets.map((b, i) => {
                                    const s = priorityStyles[b.priority] || priorityStyles.MEDIUM;
                                    return (
                                        <div key={i} className={`border rounded-xl p-3 ${s.card}`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${s.badge} px-2 py-0.5 rounded`}>
                                                    {s.icon} {s.label}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-[#1F2D3A] text-sm mb-1">{b.title}</h4>
                                            <p className="text-xs text-[#1F2D3A]/75 leading-relaxed mb-2">{b.description}</p>
                                            <p className="text-xs text-[#0F6B78] font-bold leading-relaxed flex items-start gap-1">
                                                <ArrowRight size={12} className="mt-0.5 flex-shrink-0" /> {b.action}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : !briefingLoading ? (
                        <div className="bg-white/60 rounded-xl border border-dashed border-[#0F6B78]/30 p-6 text-center">
                            <p className="text-sm text-[#1F2D3A]/70 font-medium">
                                Aún no hay briefing para hoy. Presiona <span className="font-bold text-[#0F6B78]">Generar briefing</span> para crear el análisis del día clínico.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white/60 rounded-xl border border-[#0F6B78]/20 p-6 text-center animate-pulse">
                            <p className="text-sm text-[#1F2D3A]/60 font-medium">Zendi está analizando el día clínico...</p>
                        </div>
                    )}
                </div>
            )}

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
                        <MessageSquare className="w-4 h-4" /> Chats Familiares
                        {inboxThreads.some(t => t.unreadCount > 0) && (
                            <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                                {inboxThreads.reduce((acc, t) => acc + t.unreadCount, 0)}
                            </span>
                        )}
                    </button>

                    {/* Botón Chat Staff (Sprint G-C) */}
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('zendity:open-staff-chat'))}
                        className="relative bg-[#0F6B78] hover:bg-[#0d5a66] text-white border border-[#0F6B78] font-bold py-2.5 px-5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                        title="Chat interno del equipo"
                    >
                        <Radio className="w-4 h-4" /> Chat Staff
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
                        color: "bg-blue-50 text-blue-700 border-blue-100",
                        delta: null as number | null,
                        deltaSuffix: '%',
                        deltaInverted: false,
                    },
                    {
                        label: "Residentes Actuales",
                        value: kpis.totalPatients.toString(),
                        sub: (kpis.totalCapacity !== null && kpis.totalCapacity > 0)
                            ? `${Math.round((kpis.totalPatients / kpis.totalCapacity) * 100)}% Ocupación`
                            : "— Ocupación (sin capacidad)",
                        color: "bg-emerald-50 text-emerald-700 border-emerald-100",
                        delta: null as number | null,
                        deltaSuffix: '%',
                        deltaInverted: false,
                    },
                    {
                        label: "Incidentes Críticos",
                        value: kpis.totalCriticalIncidents.toString(),
                        sub: trends ? `Triage semana: ${trends.totals.triageCurrent} (prev ${trends.totals.triagePrev})` : "Consolidado total",
                        color: "bg-red-50 text-red-700 border-red-100",
                        delta: trends?.deltas.deltaTriage ?? null,
                        deltaSuffix: '%',
                        deltaInverted: true, // bajar es bueno
                    },
                    {
                        label: "Cumplimiento Salud",
                        value: kpis.globalMedCompliance !== null ? `${kpis.globalMedCompliance}%` : '—',
                        sub: trends && trends.totals.emarPrev !== null
                            ? `Semana: ${trends.totals.emarCurrent ?? '—'}% · prev ${trends.totals.emarPrev}%`
                            : kpis.globalMedCompliance !== null ? "Global eMAR" : "Sin administraciones registradas",
                        color: "bg-purple-50 text-purple-700 border-purple-100",
                        delta: trends?.deltas.deltaMeds ?? null,
                        deltaSuffix: 'pp',
                        deltaInverted: false, // subir es bueno
                    }
                ].map((kpi, i) => (
                    <div key={i} className={`rounded-2xl p-5 border shadow-sm ${kpi.color} transition-all hover:shadow-md`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{kpi.label}</p>
                                <h3 className="text-3xl font-black mt-1">{kpi.value}</h3>
                            </div>
                            {kpi.delta !== null && (
                                <div className="mt-1">
                                    <DeltaPill value={kpi.delta} suffix={kpi.deltaSuffix} inverted={kpi.deltaInverted} />
                                </div>
                            )}
                        </div>
                        <p className="text-xs font-medium mt-3 opacity-90">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* 2.25 Sala de mando — "En este momento" (Sprint G-C) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                        <h3 className="text-lg font-bold text-[#1F2D3A] tracking-tight flex items-center gap-2">
                            <Radio size={18} className="text-[#0F6B78]" /> En este momento
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Agregado multi-sede en vivo · polling 30s
                            {live && ` · sincronizado ${new Date(live.timestamp).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#22A06B]/10 text-[#22A06B] border border-[#22A06B]/30 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-[#22A06B] rounded-full animate-pulse"></span>
                        En vivo
                    </span>
                </div>

                {live ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                        {[
                            { label: 'Cuidadores activos', value: live.chips.activeCaregivers, icon: UserCheck, tone: 'teal' },
                            { label: 'Baños hoy', value: live.chips.bathsToday, icon: Bath, tone: 'sky' },
                            { label: 'Comidas hoy', value: live.chips.mealsToday, icon: UtensilsCrossed, tone: 'amber' },
                            { label: 'Incidentes (7d)', value: live.chips.incidentsWeek, icon: AlertOctagon, tone: live.chips.incidentsWeek > 3 ? 'red' : 'slate' },
                            { label: 'Triage abierto', value: live.chips.triageOpen, icon: Siren, tone: live.chips.triageOpen > 0 ? 'amber' : 'slate' },
                            { label: 'Handovers pend.', value: live.chips.handoversPending, icon: FileSignature, tone: live.chips.handoversPending > 0 ? 'amber' : 'slate' },
                            { label: 'Residentes sin actividad', value: live.chips.zombiePatients, icon: Activity, tone: live.chips.zombiePatients > 0 ? 'red' : 'emerald' },
                            { label: 'En hospital', value: live.chips.onHospitalLeave, icon: Stethoscope, tone: live.chips.onHospitalLeave > 0 ? 'rose' : 'slate' },
                        ].map((chip, i) => {
                            const tones: Record<string, string> = {
                                teal: 'bg-[#0F6B78]/10 text-[#0F6B78] border-[#0F6B78]/20',
                                sky: 'bg-sky-50 text-sky-700 border-sky-200',
                                amber: 'bg-amber-50 text-amber-700 border-amber-200',
                                red: 'bg-red-50 text-red-700 border-red-200',
                                rose: 'bg-rose-50 text-rose-700 border-rose-200',
                                emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                slate: 'bg-slate-50 text-slate-700 border-slate-200',
                            };
                            const Icon = chip.icon;
                            return (
                                <div key={i} className={`rounded-xl border p-3 ${tones[chip.tone]} transition-all`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <Icon size={16} />
                                        <span className="text-2xl font-black leading-none">{chip.value}</span>
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 mt-2 leading-tight">{chip.label}</p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 h-20 animate-pulse" />
                        ))}
                    </div>
                )}
            </div>

            {/* 2.5 Tendencias 7 días — 6 gráficas */}
            <div className="bg-[#fafaf9] rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-[#1F2D3A] tracking-tight flex items-center gap-2">
                            <Activity size={18} className="text-[#0F6B78]" /> Tendencias · últimos 7 días
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Día clínico 6 AM AST · polling 60s · deltas vs semana anterior</p>
                    </div>
                    {trends && (
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-[#0F6B78]/10 text-[#0F6B78] border border-[#0F6B78]/20 px-2.5 py-1 rounded-full">
                            {trends.activePatients} residentes activos
                        </span>
                    )}
                </div>

                {trendsLoading && !trends ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-56 bg-white rounded-xl border border-slate-200 animate-pulse" />
                        ))}
                    </div>
                ) : !trends ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500 text-sm">
                        Sin datos de tendencia disponibles.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                        {/* 1. eMAR compliance */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-[#1F2D3A] flex items-center gap-1.5"><HeartPulse size={14} className="text-purple-600" /> Cumplimiento eMAR</h4>
                                    <p className="text-[10px] text-slate-400">% administrado por día</p>
                                </div>
                                <DeltaPill value={trends.deltas.deltaMeds} suffix="pp" />
                            </div>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trends.series.emar.map(d => ({ ...d, date: formatShortDate(d.date), compliance: d.compliance ?? 0 }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }} />
                                        <Line type="monotone" dataKey="compliance" stroke="#7e22ce" strokeWidth={2.5} dot={{ r: 3 }} name="Cumplimiento %" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. Handovers firmados vs pendientes */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-[#1F2D3A] flex items-center gap-1.5"><FileSignature size={14} className="text-[#0F6B78]" /> Handovers firmados</h4>
                                    <p className="text-[10px] text-slate-400">firmados vs pendientes · {trends.totals.handoversCurrentSigned}/{trends.totals.handoversCurrentTotal}</p>
                                </div>
                                <DeltaPill value={trends.deltas.deltaHandoversSigned} />
                            </div>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trends.series.handovers.map(d => ({ ...d, date: formatShortDate(d.date) }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }} />
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        <Bar dataKey="signed" stackId="a" fill="#22A06B" name="Firmados" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="pending" stackId="a" fill="#E5A93D" name="Pendientes" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 3. Vitales anómalos */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-[#1F2D3A] flex items-center gap-1.5"><Activity size={14} className="text-[#D9534F]" /> Vitales anómalos</h4>
                                    <p className="text-[10px] text-slate-400">fuera de rango clínico · semana: {trends.totals.vitalsCurrentAbnormal}</p>
                                </div>
                                <DeltaPill value={trends.deltas.deltaVitalsAbnormal} inverted />
                            </div>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trends.series.vitals.map(d => ({ ...d, date: formatShortDate(d.date) }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }} />
                                        <Bar dataKey="abnormal" fill="#D9534F" name="Anómalos" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 4. Triage — abiertos y resueltos */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-[#1F2D3A] flex items-center gap-1.5"><Siren size={14} className="text-[#E5A93D]" /> Actividad de triage</h4>
                                    <p className="text-[10px] text-slate-400">abiertos vs resueltos · semana: {trends.totals.triageCurrent}</p>
                                </div>
                                <DeltaPill value={trends.deltas.deltaTriage} inverted />
                            </div>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trends.series.triage.map(d => ({ ...d, date: formatShortDate(d.date) }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }} />
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        <Area type="monotone" dataKey="opened" stroke="#E5A93D" fill="#E5A93D" fillOpacity={0.35} name="Abiertos" />
                                        <Area type="monotone" dataKey="resolved" stroke="#22A06B" fill="#22A06B" fillOpacity={0.35} name="Resueltos" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 5. Baños por paciente */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-[#1F2D3A] flex items-center gap-1.5"><Bath size={14} className="text-sky-600" /> Baños registrados</h4>
                                    <p className="text-[10px] text-slate-400">total diario · semana: {trends.totals.bathsCurrent}</p>
                                </div>
                                <DeltaPill value={trends.deltas.deltaBaths} />
                            </div>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trends.series.baths.map(d => ({ ...d, date: formatShortDate(d.date) }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }} />
                                        <Bar dataKey="total" fill="#0F6B78" name="Baños" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 6. Cobertura de comidas */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-[#1F2D3A] flex items-center gap-1.5"><UtensilsCrossed size={14} className="text-amber-600" /> Cobertura comidas</h4>
                                    <p className="text-[10px] text-slate-400">% residentes × 3 comidas · semana: {trends.totals.mealsCurrent}</p>
                                </div>
                                <DeltaPill value={trends.deltas.deltaMeals} />
                            </div>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trends.series.meals.map(d => ({ ...d, date: formatShortDate(d.date), coverage: d.coverage ?? 0 }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }} />
                                        <Area type="monotone" dataKey="coverage" stroke="#E5A93D" fill="#E5A93D" fillOpacity={0.4} name="Cobertura %" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>
                )}
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
                                Tiempo Real · 30s
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
