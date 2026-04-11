"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    SprayCan, CheckCircle2, Camera, AlertTriangle, Clock,
    Loader2, ChevronDown, ImageIcon, TrendingUp, Award
} from "lucide-react";

const CATEGORY_STYLES: Record<string, string> = {
    BATHROOM: "bg-blue-100 text-blue-700",
    ROOM: "bg-teal-100 text-teal-700",
    COMMON: "bg-slate-100 text-slate-600",
    TRASH: "bg-amber-100 text-amber-700",
};

const CATEGORY_LABELS: Record<string, string> = {
    BATHROOM: "Bano",
    ROOM: "Habitacion",
    COMMON: "Area Comun",
    TRASH: "Zafacones",
};

type Area = { id: string; name: string; floor: string; category: string; roomNumber: string | null; requiresPhoto: boolean; order: number };
type Log = { id: string; areaId: string; status: string; photoUrl: string | null; notes: string | null; cleanedAt: string; area: { id: string; name: string }; cleanedBy: { id: string; name: string } };
type DayStat = { date: string; total: number; completed: number; skipped: number; percentage: number };
type SkippedArea = { name: string; count: number };
type TopEmployee = { name: string; completed: number; total: number; rate: number };

export default function CorporateCleaningDashboard() {
    const { user } = useAuth();
    const hqId = user?.hqId || user?.headquartersId || "";
    const [loading, setLoading] = useState(true);

    // KPIs
    const [todayStats, setTodayStats] = useState<{ totalAreas: number; completionByDay: DayStat[]; photoCompliance: { requested: number; taken: number; rate: number } } | null>(null);

    // Floor view
    const [firstFloor, setFirstFloor] = useState<Area[]>([]);
    const [secondFloor, setSecondFloor] = useState<Area[]>([]);
    const [todayLogs, setTodayLogs] = useState<Log[]>([]);
    const [floorTab, setFloorTab] = useState<"FIRST_FLOOR" | "SECOND_FLOOR">("FIRST_FLOOR");

    // History (7 days)
    const [weekStats, setWeekStats] = useState<{ completionByDay: DayStat[]; mostSkipped: SkippedArea[]; topEmployees: TopEmployee[]; photoCompliance: { requested: number; taken: number; rate: number } } | null>(null);

    // Photo preview
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    useEffect(() => {
        if (!hqId) return;
        fetchAll();
    }, [hqId]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [areasRes, logsRes, todayStatsRes, weekStatsRes] = await Promise.all([
                fetch(`/api/cleaning/areas?hqId=${hqId}`),
                fetch(`/api/cleaning/log?hqId=${hqId}&date=${today}`),
                fetch(`/api/cleaning/stats?hqId=${hqId}&from=${today}&to=${today}`),
                fetch(`/api/cleaning/stats?hqId=${hqId}&from=${sevenDaysAgo}&to=${today}`),
            ]);

            const areasData = await areasRes.json();
            const logsData = await logsRes.json();
            const todayData = await todayStatsRes.json();
            const weekData = await weekStatsRes.json();

            if (areasData.success) {
                setFirstFloor(areasData.firstFloor);
                setSecondFloor(areasData.secondFloor);
            }
            if (logsData.success) setTodayLogs(logsData.logs);
            if (todayData.success) setTodayStats(todayData);
            if (weekData.success) setWeekStats(weekData);
        } catch (e) {
            console.error("Error loading cleaning dashboard:", e);
        } finally {
            setLoading(false);
        }
    };

    const getLogForArea = (areaId: string) => todayLogs.find(l => l.areaId === areaId);

    const todayDay = todayStats?.completionByDay?.[0];
    const todayCompleted = todayDay?.completed ?? 0;
    const todayTotal = todayStats?.totalAreas ?? 0;
    const todayPct = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;
    const todayPending = todayTotal - todayCompleted;
    const todayPhotos = todayStats?.photoCompliance?.taken ?? 0;

    const activeFloorAreas = floorTab === "FIRST_FLOOR" ? firstFloor : secondFloor;

    // Chart max for bar scaling
    const chartMax = Math.max(...(weekStats?.completionByDay?.map(d => d.percentage) || [1]), 1);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page header */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <SprayCan className="w-8 h-8 text-teal-600" />
                    Limpieza & Sanitizacion
                </h1>
                <p className="text-slate-500 font-medium mt-1">Panel de supervision — desempeno de limpieza de la sede</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Completado Hoy</p>
                    <p className="text-3xl font-black text-teal-700">{todayPct}%</p>
                    <p className="text-xs text-slate-400 mt-1">{todayCompleted} de {todayTotal} areas</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Registros Hoy</p>
                    <p className="text-3xl font-black text-slate-800">{todayLogs.length}</p>
                    <p className="text-xs text-slate-400 mt-1">logs de limpieza</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Fotos Tomadas</p>
                    <p className="text-3xl font-black text-blue-700">{todayPhotos}</p>
                    <p className="text-xs text-slate-400 mt-1">evidencia fotografica</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pendientes</p>
                    <p className={`text-3xl font-black ${todayPending > 0 ? "text-rose-600" : "text-emerald-600"}`}>{todayPending}</p>
                    <p className="text-xs text-slate-400 mt-1">{todayPending === 0 ? "todo al dia" : "areas sin registrar"}</p>
                </div>
            </div>

            {/* Floor view */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-800 text-lg">Vista por Piso</h2>
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setFloorTab("FIRST_FLOOR")}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${floorTab === "FIRST_FLOOR" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Primer Piso
                        </button>
                        <button
                            onClick={() => setFloorTab("SECOND_FLOOR")}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${floorTab === "SECOND_FLOOR" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Segundo Piso
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 text-left">
                                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Area</th>
                                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Categoria</th>
                                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Hora</th>
                                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Empleado</th>
                                <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Foto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeFloorAreas.map(area => {
                                const log = getLogForArea(area.id);
                                return (
                                    <tr key={area.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <p className="font-bold text-slate-800 text-sm">{area.name}</p>
                                            {area.roomNumber && <p className="text-xs text-slate-400">Hab. {area.roomNumber}</p>}
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CATEGORY_STYLES[area.category] || CATEGORY_STYLES.COMMON}`}>
                                                {CATEGORY_LABELS[area.category] || area.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            {log ? (
                                                <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                                                    <CheckCircle2 className="w-4 h-4" /> Completada
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-rose-600 font-bold text-xs">
                                                    <AlertTriangle className="w-4 h-4" /> Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 text-sm text-slate-600 font-medium">
                                            {log ? new Date(log.cleanedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                                        </td>
                                        <td className="px-6 py-3.5 text-sm text-slate-600 font-medium">
                                            {log?.cleanedBy?.name || "—"}
                                        </td>
                                        <td className="px-6 py-3.5">
                                            {log?.photoUrl ? (
                                                <button onClick={() => setPreviewPhoto(log.photoUrl)} className="group">
                                                    <img src={log.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 group-hover:border-teal-400 transition-colors" />
                                                </button>
                                            ) : (
                                                <span className="text-slate-400 text-sm">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* History - Last 7 days */}
            {weekStats && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-teal-600" />
                            Cumplimiento Ultimos 7 Dias
                        </h3>
                        <div className="flex items-end gap-3 h-48">
                            {weekStats.completionByDay.map((day) => {
                                const barH = chartMax > 0 ? (day.percentage / chartMax) * 100 : 0;
                                const isToday = day.date === today;
                                return (
                                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                                        <span className="text-xs font-black text-slate-600">{day.percentage}%</span>
                                        <div className="w-full bg-slate-100 rounded-t-lg relative" style={{ height: "160px" }}>
                                            <div
                                                className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-500 ${isToday ? "bg-teal-500" : "bg-teal-300"}`}
                                                style={{ height: `${barH}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold ${isToday ? "text-teal-700" : "text-slate-400"}`}>
                                            {new Date(day.date + "T12:00:00").toLocaleDateString("es-PR", { weekday: "short", day: "numeric" })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Side stats */}
                    <div className="space-y-4">
                        {/* Most skipped */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h4 className="font-black text-slate-700 text-sm mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Areas Mas Omitidas
                            </h4>
                            {weekStats.mostSkipped.length === 0 ? (
                                <p className="text-xs text-slate-400 font-medium">Sin omisiones esta semana</p>
                            ) : (
                                <div className="space-y-2">
                                    {weekStats.mostSkipped.slice(0, 3).map((area, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-sm font-medium text-slate-700 truncate flex-1">{area.name}</span>
                                            <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full shrink-0 ml-2">{area.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Top employee */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h4 className="font-black text-slate-700 text-sm mb-3 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" />
                                Mejor Cumplimiento
                            </h4>
                            {weekStats.topEmployees.length === 0 ? (
                                <p className="text-xs text-slate-400 font-medium">Sin datos esta semana</p>
                            ) : (
                                <div className="space-y-2">
                                    {weekStats.topEmployees.slice(0, 3).map((emp, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}`}>
                                                    {i + 1}
                                                </span>
                                                <span className="text-sm font-medium text-slate-700 truncate">{emp.name}</span>
                                            </div>
                                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 ml-2">{emp.rate}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Photo compliance */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h4 className="font-black text-slate-700 text-sm mb-3 flex items-center gap-2">
                                <Camera className="w-4 h-4 text-blue-500" />
                                Cumplimiento Fotografico
                            </h4>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-black text-blue-700">{weekStats.photoCompliance?.rate ?? 100}%</span>
                                <span className="text-xs text-slate-400 font-medium mb-1">
                                    ({weekStats.photoCompliance?.taken ?? 0} de {weekStats.photoCompliance?.requested ?? 0} fotos)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo preview modal */}
            {previewPhoto && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setPreviewPhoto(null)}>
                    <img src={previewPhoto} alt="Evidencia" className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border-4 border-white" />
                </div>
            )}
        </div>
    );
}
