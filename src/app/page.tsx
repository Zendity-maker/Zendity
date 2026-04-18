"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  MessageSquare, Download, TrendingUp, TrendingDown, Minus,
  ArrowRight, Activity, Users, Building, X, AlertOctagon, BarChart3, MapPin
} from 'lucide-react';

interface LeaderboardItem {
  name: string;
  role: string;
  hq: string;
  currentScore: number;
  trend: "UP" | "DOWN" | "STABLE";
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

  // Family Link (Fase 13)
  const [showInbox, setShowInbox] = useState(false);
  const [inboxThreads, setInboxThreads] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  // Colores dinámicos para las líneas de HQ
  const colors = ["#0d9488", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

  useEffect(() => {
    async function fetchInsights() {
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
        }
      } catch (err) {
        console.error("Error loading insights:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, []);

  // --- Family Link Polling (solo Staff, no Family) ---
  useEffect(() => {
    if (!user || user.role === "FAMILY") return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [user]);

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
          </h2>
          <p className="text-slate-500 mt-2 font-medium text-sm">
            Dashboard Maestro de Cumplimiento Multitenant
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
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 border border-slate-200/60 shadow-inner group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                          {emp.name.substring(0, 2).toUpperCase()}
                        </div>
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
                      {hq.installed} / {hq.capacity} ({hq.rate}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/50">
                    <div 
                      className={`h-3 rounded-full transition-all duration-1000 ${hq.rate >= 90 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : hq.rate >= 75 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-teal-500 to-teal-400'}`} 
                      style={{ width: `${hq.rate}%` }}
                    ></div>
                  </div>
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
                <p className="text-sm text-slate-500 font-medium mt-1">Riesgo Inminente de Caídas (Downton Hotspots)</p>
              </div>
              <span className="bg-rose-100 text-rose-700 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-rose-200 animate-pulse">
                {clinicalRisk.length} Alertas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {clinicalRisk.map((pt, idx) => (
                <div key={idx} className="p-4 bg-rose-50 border border-rose-100 hover:border-rose-300 rounded-xl transition-all group">
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
                        {pt.hqName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {clinicalRisk.length === 0 && (
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
