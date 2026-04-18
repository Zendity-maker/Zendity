"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useInterval } from "@/hooks/useInterval";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  MessageSquare, Download, TrendingUp, TrendingDown, Minus,
  ArrowRight, Activity, Users, Building, X, AlertOctagon, BarChart3, MapPin,
  Droplets, Utensils, Pill, UserCheck, HeartPulse, AlertTriangle, ShieldAlert, Sparkles, Clock
} from 'lucide-react';

interface LeaderboardItem {
  name: string;
  role: string;
  hq: string;
  photoUrl?: string | null;
  currentScore: number;
  trend: "UP" | "DOWN" | "STABLE";
}

interface LiveStats {
  activeCaregivers: number;
  baths: number;
  mealsServed: number;
  pendingMeds: number;
}

interface ClinicalAlerts {
  falls: { count: number };
  upps: { count: number; items: Array<{ patientId: string; patientName: string; room: string | null }> };
  omittedMeds: { count: number };
  criticalVitals: { count: number };
}

interface ResidentStats {
  active: number;
  hospital: number;
  leave: number;
  downtonRisk: number;
}

interface DigestData {
  id: string;
  shiftType: string;
  summary: string;
  createdAt: string;
  outgoingNurse: string | null;
}

export default function InsightsDashboard() {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [headquarters, setHeadquarters] = useState<string[]>([]);
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [clinicalRisk, setClinicalRisk] = useState<any[]>([]);
  const [globalAvg, setGlobalAvg] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Widgets nuevos
  const [liveStats, setLiveStats] = useState<LiveStats>({ activeCaregivers: 0, baths: 0, mealsServed: 0, pendingMeds: 0 });
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlerts>({
    falls: { count: 0 },
    upps: { count: 0, items: [] },
    omittedMeds: { count: 0 },
    criticalVitals: { count: 0 },
  });
  const [residentStats, setResidentStats] = useState<ResidentStats>({ active: 0, hospital: 0, leave: 0, downtonRisk: 0 });
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [fallHotspots, setFallHotspots] = useState<Array<{ id: string; patientId: string; name: string; room: string | null }>>([]);

  // Family Link (Fase 13)
  const [showInbox, setShowInbox] = useState(false);
  const [inboxThreads, setInboxThreads] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  // Colores dinámicos para las líneas de HQ
  const colors = ["#0d9488", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

  // ── Estado de polling / refresh indicator ──
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [isTabVisible, setIsTabVisible] = useState<boolean>(true);

  // Detectar si el tab está visible (para pausar polling en background)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setIsTabVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // ── Loaders extraídos (reutilizables por polling) ──
  const loadDashboard = async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (data.success) {
        setChartData(data.chartData);
        setLeaderboard(data.leaderboard);
        setHeadquarters(data.headquarters);
        setOccupancyData(data.occupancyData || []);
        setClinicalRisk(data.clinicalRisk || []);
        setGlobalAvg(typeof data.globalAvg === 'number' ? data.globalAvg : 0);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error("Error loading insights:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const loadWidgets = async () => {
    if (!user || user.role === 'FAMILY') return;
    const hqId = user?.hqId || user?.headquartersId;
    if (!hqId) return;

    try {
      const [liveRes, alertsRes, careRes, digestRes] = await Promise.all([
        fetch(`/api/care/supervisor/live?hqId=${hqId}`).catch(() => null),
        fetch(`/api/insights/clinical-alerts`).catch(() => null),
        fetch(`/api/care?color=ALL&hqId=${hqId}`).catch(() => null),
        fetch(`/api/insights/digest`).catch(() => null),
      ]);

      // Widget A — Actividad del Turno
      if (liveRes && liveRes.ok) {
        const live = await liveRes.json();
        if (live.success) {
          const meals = live.liveStats?.meals || {};
          const totalMeals = Object.values(meals as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
          setLiveStats({
            activeCaregivers: live.activeCaregivers || 0,
            baths: live.liveStats?.baths || 0,
            mealsServed: totalMeals,
            pendingMeds: 0, // se completa desde careRes más abajo
          });
        }
      }

      // Widget B — Alertas Clínicas
      if (alertsRes && alertsRes.ok) {
        const alerts = await alertsRes.json();
        if (alerts.success) {
          setClinicalAlerts({
            falls: { count: alerts.falls?.count || 0 },
            upps: { count: alerts.upps?.count || 0, items: alerts.upps?.items || [] },
            omittedMeds: { count: alerts.omittedMeds?.count || 0 },
            criticalVitals: { count: alerts.criticalVitals?.count || 0 },
          });
          // Hotspots de caídas para integrar en heatmap clínico
          const fallItems = (alerts.falls?.items || []).slice(0, 10).map((f: any) => ({
            id: f.id,
            patientId: f.patientId,
            name: f.patientName,
            room: f.room,
          }));
          setFallHotspots(fallItems);
        }
      }

      // Widget C — Estado de Residentes + meds pendientes
      if (careRes && careRes.ok) {
        const care = await careRes.json();
        if (care.success) {
          const patients: any[] = care.patients || [];
          const active = patients.filter(p => p.status === 'ACTIVE').length;
          const hospital = patients.filter(p => p.status === 'TEMPORARY_LEAVE' && p.leaveType === 'HOSPITAL').length;
          const leave = patients.filter(p => p.status === 'TEMPORARY_LEAVE' && p.leaveType !== 'HOSPITAL').length;
          const downtonRisk = patients.filter(p => p.downtonRisk).length;
          setResidentStats({ active, hospital, leave, downtonRisk });

          // Contar meds PENDING del turno (medications[].administrations[].status === PENDING del día)
          // Aproximación: # medications activas x residentes ACTIVE (tendencia de carga)
          let pending = 0;
          patients.forEach(p => {
            if (p.status === 'ACTIVE' && Array.isArray(p.medications)) {
              pending += p.medications.length;
            }
          });
          setLiveStats(prev => ({ ...prev, pendingMeds: pending }));
        }
      }

      // Widget D — Zendi Digest
      if (digestRes && digestRes.ok) {
        const dig = await digestRes.json();
        if (dig.success && dig.digest) {
          setDigest(dig.digest);
        }
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading widget data:', err);
    }
  };

  const fetchMessages = async () => {
    if (!user || user.role === "FAMILY") return;
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

  // ── Carga inicial (una sola vez con spinner) ──
  useEffect(() => {
    loadDashboard(true);
  }, []);

  // ── Carga inicial widgets + inbox cuando user esté disponible ──
  useEffect(() => {
    if (!user || user.role === 'FAMILY') return;
    loadWidgets();
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Polling 30s: pausa automáticamente si el tab está oculto (delay=null) ──
  const POLL_MS = 30000;
  const pollDelay = isTabVisible ? POLL_MS : null;

  useInterval(() => { loadDashboard(false); }, pollDelay);
  useInterval(() => { loadWidgets(); }, pollDelay);
  useInterval(() => { fetchMessages(); }, pollDelay);

  // Tick de 1s para actualizar el texto "Actualizado hace Xs" (pausa si oculto)
  useInterval(() => setNow(Date.now()), isTabVisible ? 1000 : null);

  // Refrescar inmediatamente al volver a foco (si ya hubo una carga previa)
  useEffect(() => {
    if (isTabVisible && lastRefresh) {
      loadDashboard(false);
      loadWidgets();
      fetchMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTabVisible]);

  // Texto relativo del último refresh
  const refreshLabel = (() => {
    if (!lastRefresh) return "Actualizando…";
    const secs = Math.max(0, Math.floor((now - lastRefresh.getTime()) / 1000));
    if (!isTabVisible) return "Polling en pausa (tab oculto)";
    if (secs < 5) return "Actualizado ahora";
    if (secs < 60) return `Actualizado hace ${secs}s`;
    const mins = Math.floor(secs / 60);
    return `Actualizado hace ${mins}m`;
  })();

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

  const exportPdf = () => {
    window.print();
  };

  const renderTrendIcon = (trend: string) => {
    if (trend === "UP") return <TrendingUp className="text-emerald-500 w-5 h-5 mx-auto" />;
    if (trend === "DOWN") return <TrendingDown className="text-rose-500 w-5 h-5 mx-auto" />;
    return <Minus className="text-amber-500 w-5 h-5 mx-auto" />;
  };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse pb-12">
                {/* Header Skeleton */}
                <div className="flex justify-between items-end border-b border-slate-100 pb-6">
                    <div className="space-y-3">
                        <div className="h-8 w-56 bg-slate-200 rounded-lg"></div>
                        <div className="h-4 w-72 bg-slate-100 rounded-md"></div>
                    </div>
                    <div className="h-10 w-32 bg-slate-200 rounded-xl hidden md:block"></div>
                </div>
                {/* Top Metrics Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-slate-100/80 rounded-[1.5rem] border border-slate-200/60 p-6">
                            <div className="flex justify-between">
                                <div className="h-3 w-20 bg-slate-200 rounded-md"></div>
                                <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                            </div>
                            <div className="h-10 w-16 bg-slate-200 rounded-xl mt-4"></div>
                        </div>
                    ))}
                </div>
                {/* Master Chart Skeleton */}
                <div className="h-96 w-full bg-slate-100/80 rounded-[1.5rem] border border-slate-200/60 p-6"></div>
            </div>
        );
    }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-[0.99] duration-500 print:m-0 print:p-0 pb-12">

      {/* Ocultar Cabecera y Botón en Documento PDF */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden border-b border-slate-200/60 pb-6">
        <div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent flex items-center gap-3 tracking-tight">
            Zendity <span className="text-teal-500">Insights</span>
            {/* Dot animado: verde + ping continuo cuando tab visible, gris cuando oculto */}
            <span className="relative inline-flex w-2.5 h-2.5" aria-hidden="true">
              {isTabVisible && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isTabVisible ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </span>
          </h2>
          <p className="text-slate-500 mt-2 font-medium text-sm flex items-center gap-2">
            Dashboard Maestro de Cumplimiento Multitenant
            <span className="text-slate-400">·</span>
            <span className={`text-xs font-semibold ${isTabVisible ? 'text-emerald-600' : 'text-slate-400'}`}>
              {refreshLabel}
            </span>
          </p>
        </div>
        <div className="flex space-x-3">
          {/* Botón Bandeja Family Link */}
          <button
            onClick={() => { setShowInbox(true); setActiveThread(null); }}
            className="relative bg-white text-slate-700 border border-slate-200 hover:border-teal-300 hover:text-teal-700 font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-sm"
          >
            <MessageSquare className="w-4 h-4" /> Sala de Enfermería
            {inboxThreads.some(t => t.unreadCount > 0) && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-sm">
                {inboxThreads.reduce((acc, t) => acc + t.unreadCount, 0)}
              </span>
            )}
          </button>

          <button
            onClick={exportPdf}
            disabled={generatingPdf}
            className={`bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-sm px-5 py-2.5 shadow-md shadow-slate-900/10 transition-all flex items-center gap-2 ${generatingPdf ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Download className="w-4 h-4" />
            <span>{generatingPdf ? "Generando..." : "Exportar Evidencia"}</span>
          </button>
        </div>
      </div>

      {/* Contenedor a exportar en PDF */}
      <div ref={reportRef} className="space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between hover:border-teal-200 transition-colors">
            <div className="flex justify-between items-start">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Promedio Global</h3>
              <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Activity className="w-4 h-4" /></div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-800 tracking-tight">
                {globalAvg}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase">Pts</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between hover:border-indigo-200 transition-colors">
            <div className="flex justify-between items-start">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Sedes Evaluadas</h3>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Building className="w-4 h-4" /></div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-800 tracking-tight">{headquarters.length}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">HQs</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between hover:border-amber-200 transition-colors">
            <div className="flex justify-between items-start">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Empleados Auditados</h3>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Users className="w-4 h-4" /></div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-800 tracking-tight">{leaderboard.length}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Staff</span>
            </div>
          </div>
        </div>

        {/* WIDGET A — Actividad del Turno Actual */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" /> Actividad del Turno Actual
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Telemetría en vivo del piso clínico</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-teal-100 text-teal-700 rounded-md"><UserCheck className="w-3.5 h-3.5" /></div>
                <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Cuidadores</p>
              </div>
              <p className="text-3xl font-black text-slate-800">{liveStats.activeCaregivers}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">En piso ahora</p>
            </div>
            <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-teal-100 text-teal-700 rounded-md"><Droplets className="w-3.5 h-3.5" /></div>
                <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Baños</p>
              </div>
              <p className="text-3xl font-black text-slate-800">{liveStats.baths}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Completados hoy</p>
            </div>
            <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-teal-100 text-teal-700 rounded-md"><Utensils className="w-3.5 h-3.5" /></div>
                <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Comidas</p>
              </div>
              <p className="text-3xl font-black text-slate-800">{liveStats.mealsServed}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Servidas hoy</p>
            </div>
            <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-teal-100 text-teal-700 rounded-md"><Pill className="w-3.5 h-3.5" /></div>
                <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Meds</p>
              </div>
              <p className="text-3xl font-black text-slate-800">{liveStats.pendingMeds}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Activos en eMAR</p>
            </div>
          </div>
        </div>

        {/* WIDGET B — Alertas Clínicas Activas */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" /> Alertas Clínicas Activas
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Eventos que requieren atención del equipo clínico</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Caídas 24h', count: clinicalAlerts.falls.count, icon: <AlertTriangle className="w-3.5 h-3.5" />, href: '/corporate/medical/fall-risk' },
              { label: 'UPPs Activas', count: clinicalAlerts.upps.count, icon: <AlertOctagon className="w-3.5 h-3.5" />, href: '/corporate/medical/upp-dashboard' },
              { label: 'Meds Omitidos', count: clinicalAlerts.omittedMeds.count, icon: <Pill className="w-3.5 h-3.5" />, href: '/corporate/medical/emar' },
              { label: 'Vitales Críticos', count: clinicalAlerts.criticalVitals.count, icon: <HeartPulse className="w-3.5 h-3.5" />, href: '/care/vitals' },
            ].map((a, i) => {
              const isAlert = a.count > 0;
              return (
                <Link
                  key={i}
                  href={a.href}
                  className={`group rounded-xl p-4 border transition-all hover:shadow-sm ${isAlert ? 'bg-rose-50/60 border-rose-200 hover:border-rose-300' : 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-md ${isAlert ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {a.icon}
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isAlert ? 'text-rose-700' : 'text-emerald-700'}`}>{a.label}</p>
                  </div>
                  <p className={`text-3xl font-black ${isAlert ? 'text-rose-700' : 'text-emerald-700'}`}>{a.count}</p>
                  <p className={`text-[10px] font-semibold mt-0.5 flex items-center gap-1 ${isAlert ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {isAlert ? 'Requiere revisión' : 'Sin alertas'}
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* WIDGET C + D en 2 cols */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* WIDGET C — Estado de Residentes */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80">
            <div className="mb-5">
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Estado de Residentes
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Censo actual de la sede</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">Activos</p>
                <p className="text-3xl font-black text-indigo-700">{residentStats.active}</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">En residencia</p>
              </div>
              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Hospital</p>
                <p className="text-3xl font-black text-amber-700">{residentStats.hospital}</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Traslado temporal</p>
              </div>
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Licencia</p>
                <p className="text-3xl font-black text-blue-700">{residentStats.leave}</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Permiso familiar</p>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-4">
                <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-1">Downton Risk</p>
                <p className="text-3xl font-black text-rose-700">{residentStats.downtonRisk}</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Alto riesgo caída</p>
              </div>
            </div>
          </div>

          {/* WIDGET D — Zendi Digest del Día */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-xl p-6 shadow-sm border border-slate-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-teal-400/10 blur-3xl rounded-full"></div>
            <div className="mb-5 relative">
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-400" /> Zendi Digest del Día
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Resumen clínico del último turno</p>
            </div>
            {digest ? (
              <div className="relative space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                    Turno {digest.shiftType === 'MORNING' ? 'Mañana' : digest.shiftType === 'EVENING' ? 'Tarde' : 'Noche'}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {(() => {
                      const mins = Math.floor((Date.now() - new Date(digest.createdAt).getTime()) / 60000);
                      if (mins < 60) return `hace ${mins} min`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `hace ${hrs}h`;
                      return `hace ${Math.floor(hrs / 24)}d`;
                    })()}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-100 leading-relaxed line-clamp-6">
                  {digest.summary}
                </p>
                {digest.outgoingNurse && (
                  <p className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-700">
                    Generado por Zendi · Turno entregado por {digest.outgoingNurse}
                  </p>
                )}
              </div>
            ) : (
              <div className="relative flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-700/50 border border-slate-600 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-slate-500" />
                </div>
                <p className="text-sm font-bold text-slate-300">Sin resumen aún</p>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">Zendi generará el digest al cierre del próximo turno</p>
              </div>
            )}
          </div>
        </div>

        {/* Master Chart - Recharts */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Crecimiento Histórico Comparativo</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Evaluación de desempeño RRHH mes a mes.</p>
          </div>

          <div className="h-96 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontWeight: 600, fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontWeight: 600 }}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontWeight: 600 }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '20px', fontWeight: 600, color: '#475569', fontSize: '12px' }}
                  />
                  {headquarters.map((hq, idx) => (
                    <Line
                      key={hq}
                      type="monotone"
                      dataKey={hq}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={3}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      dot={{ r: 3, strokeWidth: 2, fill: 'white' }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Activity className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-slate-500 font-bold text-sm">No hay datos históricos suficientes.</p>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard y Tendencias */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Leaderboard de Personal & Tendencias</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Métricas de desempeño clínico y administrativo del mes actual.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-4 px-4">Empleado</th>
                  <th className="py-4 px-4">Rol en Sede</th>
                  <th className="py-4 px-4">Sede (HQ)</th>
                  <th className="py-4 px-4 text-center">Score Actual</th>
                  <th className="py-4 px-4 text-center">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leaderboard.map((emp, i) => (
                  <tr key={i} className={`hover:bg-slate-50/80 transition-colors group ${emp.trend === 'DOWN' ? 'bg-rose-50/20' : ''}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {emp.photoUrl ? (
                          <img
                            src={emp.photoUrl}
                            alt={emp.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200/60 shadow-inner"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 border border-slate-200/60 shadow-inner group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                            {emp.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold text-slate-800 text-sm">{emp.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-md border border-slate-200/60 tracking-wide">
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold text-slate-500">{emp.hq}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex font-black text-sm px-3 py-1 rounded-full border shadow-sm ${emp.currentScore >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : emp.currentScore <= 75 ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'}`}>
                        {emp.currentScore}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-xl">
                      {renderTrendIcon(emp.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FASE 67: Predictive Analytics & Clinical Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Occupancy Projection */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" /> Proyección de Ocupación
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Capacidad Instalada vs Disponible por Sede</p>
            </div>
            
            <div className="space-y-5">
              {occupancyData.map((hq, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-700">{hq.hqName}</span>
                    <span className={hq.rate >= 90 ? 'text-rose-600' : 'text-slate-500'}>
                      {hq.rate}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/50">
                    <div
                      className={`h-3 rounded-full transition-all duration-1000 ${hq.rate >= 90 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : hq.rate >= 75 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-teal-500 to-teal-400'}`}
                      style={{ width: `${hq.rate}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    <span className="font-black text-slate-700">{hq.installed}</span> de <span className="font-black text-slate-700">{hq.capacity}</span> camas ocupadas
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Risk Heatmap */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/80">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-rose-600" /> Mapa de Calor Clínico
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Downton (rojo) + caídas últimas 24h (naranja)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-rose-100 text-rose-700 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-rose-200">
                  {clinicalRisk.length} Downton
                </span>
                {fallHotspots.length > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-orange-200 animate-pulse">
                    {fallHotspots.length} Caídas 24h
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {/* Caídas 24h — naranja */}
              {fallHotspots.map((pt, idx) => (
                <div key={`fall-${idx}`} className="p-4 bg-orange-50 border border-orange-200 hover:border-orange-300 rounded-xl transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black shadow-inner">
                      {pt.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm group-hover:text-orange-700 transition-colors leading-tight">{pt.name}</h4>
                      <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" /> Cuarto {pt.room || 'N/A'}
                      </p>
                      <span className="inline-block mt-2 text-[9px] uppercase tracking-widest font-bold bg-white text-orange-600 px-2 py-0.5 rounded border border-orange-200">
                        Caída 24h
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {/* Downton Risk — rojo */}
              {clinicalRisk.map((pt, idx) => (
                <div key={`downton-${idx}`} className="p-4 bg-rose-50 border border-rose-100 hover:border-rose-300 rounded-xl transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black shadow-inner">
                      {pt.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm group-hover:text-rose-700 transition-colors leading-tight">{pt.name}</h4>
                      <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" /> Cuarto {pt.room || 'N/A'}
                      </p>
                      <span className="inline-block mt-2 text-[9px] uppercase tracking-widest font-bold bg-white text-rose-600 px-2 py-0.5 rounded border border-rose-200">
                        Downton
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {clinicalRisk.length === 0 && fallHotspots.length === 0 && (
                <div className="col-span-2 text-center py-10 bg-emerald-50 text-emerald-600 font-bold border border-emerald-100 border-dashed rounded-xl">
                   Riesgo Cero Reportado Globalmente
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* INBOX MODAL (Slide-over Panel) FASE 13 */}
      {showInbox && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowInbox(false)}
          ></div>

          {/* Slide-over Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-teal-600" /> Sala de Enfermería
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Family Link</p>
              </div>
              <button onClick={() => setShowInbox(false)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/30">
              {!activeThread ? (
                <div className="p-4 space-y-3">
                  {inboxThreads.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 font-bold flex flex-col items-center gap-3">
                      <MessageSquare className="w-8 h-8 opacity-40" />
                      <span>Sin mensajes hoy. </span>
                    </div>
                  ) : (
                    inboxThreads.map((thread: any, idx) => (
                      <div key={idx} onClick={() => { setActiveThread(thread); fetchMessages(); }} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-teal-400 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-teal-600">{thread.patient.name}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Cuarto {thread.patient.room}</p>
                        </div>
                        {thread.unreadCount > 0 ? (
                          <span className="bg-rose-500 text-white font-black text-[10px] px-2.5 py-1 rounded-full">{thread.unreadCount} Nuevos</span>
                        ) : (
                          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-500 transition-colors" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden relative">
                  {/* Hilo Específico Header */}
                  <div className="p-3 px-4 bg-white border-b border-slate-200 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
                    <button onClick={() => { setActiveThread(null); fetchMessages(); }} className="text-slate-500 hover:text-slate-800 font-bold p-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </button>
                    <span className="font-black text-slate-800 text-sm">{activeThread.patient.name}</span>
                  </div>

                  {/* Mensajes */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col scroll-smooth">
                    {activeThread.messages.map((msg: any) => {
                      const isStaff = msg.senderType === 'STAFF';
                      return (
                        <div key={msg.id} className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${isStaff ? 'bg-teal-600 text-white self-end rounded-br-sm shadow-sm' : 'bg-white border border-slate-200 text-slate-700 self-start rounded-bl-sm shadow-sm'}`}>
                          <p className="font-medium">{msg.content}</p>
                          <div className={`text-[9px] mt-1.5 font-bold text-right uppercase tracking-wider ${isStaff ? 'text-teal-200' : 'text-slate-500'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.02)]">
                    <form onSubmit={(e) => { e.preventDefault(); sendReply(activeThread.patient.id); }} className="flex gap-2">
                      <input
                        type="text"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Escribe al familiar..."
                        className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm font-medium rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all placeholder:text-slate-500"
                      />
                      <button type="submit" disabled={sendingReply || !replyContent.trim()} className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold px-4 rounded-xl shadow-sm transition-all flex items-center justify-center">
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
