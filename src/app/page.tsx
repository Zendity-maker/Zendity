"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

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
  const colors = ["#0f766e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch("/api/insights");
        const data = await res.json();
        if (data.success) {
          setChartData(data.chartData);
          setLeaderboard(data.leaderboard);
          setHeadquarters(data.headquarters);
        }
      } catch (err) {
        console.error("Error loading insights:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
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

  const exportPdf = () => {
    // La impresión nativa ignora las limitaciones de html2canvas con OkLCH/LAB y permite 
    // texto seleccionable en el PDF final. Ocultamos la UI con clases print: de Tailwind.
    window.print();
  };

  const renderTrendIcon = (trend: string) => {
    if (trend === "UP") return <span className="text-emerald-500 font-bold" title="En Crecimiento">🟢 ⬆️</span>;
    if (trend === "DOWN") return <span className="text-red-500 font-bold" title="Deficiente">🔴 ⬇️</span>;
    return <span className="text-amber-500 font-bold" title="Estable">🟡 ➖</span>;
  };

  if (loading) {
    return <div className="p-10 text-center text-teal-600 font-bold animate-pulse">Compilando Métricas Históricas...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 print:m-0 print:p-0">
      {/* Ocultar Cabecera y Botón en Documento PDF */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent flex items-center gap-3">
            Zendity Insights <span className="text-2xl">📈</span>
          </h2>
          <p className="text-slate-500 mt-1">
            Dashboard Maestro de Cumplimiento Multitenant
          </p>
        </div>
        <div className="flex space-x-3">
          {/* Botón Bandeja Family Link */}
          <button
            onClick={() => { setShowInbox(true); setActiveThread(null); }}
            className="relative bg-white text-slate-800 border border-slate-200 hover:border-teal-400 font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-md transition-all flex items-center gap-2"
          >
            <span>📨</span> Mensajes
            {inboxThreads.some(t => t.unreadCount > 0) && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {inboxThreads.reduce((acc, t) => acc + t.unreadCount, 0)}
              </span>
            )}
          </button>

          <button
            onClick={exportPdf}
            disabled={generatingPdf}
            className={`bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-sm px-6 py-3 shadow-lg hover:shadow-teal-500/20 transition-all flex items-center gap-2 ${generatingPdf ? "opacity-50 cursor-not-allowed" : ""
              }`}
          >
            <span>{generatingPdf ? "⏳ Generando..." : "📄 Exportar Evidencia Gubernamental"}</span>
          </button>
        </div>
      </div>

      {/* Contenedor a exportar en PDF */}
      <div ref={reportRef} className="space-y-6 bg-slate-50 p-2 rounded-xl">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Promedio Global</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-black text-teal-700">
                {chartData.length > 0 ? (
                  chartData[chartData.length - 1][headquarters[0]] || 0
                ) : 0}
              </span>
              <span className="text-sm font-bold text-slate-400">Pts</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Sedes Evaluadas</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-800">{headquarters.length}</span>
              <span className="text-sm font-bold text-slate-400">HQs</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Empleados Auditados</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-800">{leaderboard.length}</span>
              <span className="text-sm font-bold text-slate-400">Staff</span>
            </div>
          </div>
        </div>

        {/* Master Chart - Recharts */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-800">Crecimiento Histórico Comparativo (Sedes)</h3>
            <p className="text-sm text-slate-500">Evaluación de desempeño RRHH mes a mes.</p>
          </div>

          <div className="h-96 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
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
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '20px', fontWeight: 600, color: '#475569' }}
                  />
                  {headquarters.map((hq, idx) => (
                    <Line
                      key={hq}
                      type="monotone"
                      dataKey={hq}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={4}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">No hay datos históricos suficientes.</p>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard y Tendencias */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-800">Leaderboard de Empleados & Tendencias</h3>
            <p className="text-sm text-slate-500">Métricas de desempeño clínico y administrativo del mes actual frente al anterior.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100 text-sm font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-4 px-4">Empleado</th>
                  <th className="py-4 px-4">Rol</th>
                  <th className="py-4 px-4">Sede (HQ)</th>
                  <th className="py-4 px-4 text-center">Score Actual</th>
                  <th className="py-4 px-4 text-center">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((emp, i) => (
                  <tr key={i} className={`hover:bg-slate-50 transition-colors ${emp.trend === 'DOWN' ? 'bg-red-50/30' : ''}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {emp.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800">{emp.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-600">{emp.hq}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`font-black text-lg ${emp.currentScore >= 90 ? 'text-teal-600' : emp.currentScore <= 75 ? 'text-red-500' : 'text-amber-500'}`}>
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

      </div>

      {/* INBOX MODAL (Family Link) FASE 13 */}
      {showInbox && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setShowInbox(false)} className="absolute top-6 right-6 w-12 h-12 bg-slate-100 text-slate-500 rounded-full font-bold">X</button>
            <h3 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">📨 Sala de Enfermería</h3>

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
                        placeholder="Escribe una respuesta clínica..."
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
