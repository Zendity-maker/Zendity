"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const ALLOWED_ROLES = ["NURSE", "SUPERVISOR", "DIRECTOR", "ADMIN"];

const COLOR_GROUPS = [
    { key: "RED", label: "Grupo Rojo", bg: "bg-red-500/10", border: "border-red-500", text: "text-red-400" },
    { key: "YELLOW", label: "Grupo Amarillo", bg: "bg-yellow-400/10", border: "border-yellow-400", text: "text-yellow-400" },
    { key: "GREEN", label: "Grupo Verde", bg: "bg-green-500/10", border: "border-green-500", text: "text-green-400" },
    { key: "BLUE", label: "Grupo Azul", bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-400" },
    { key: "UNASSIGNED", label: "Sin Asignar", bg: "bg-slate-700/50", border: "border-slate-600", text: "text-slate-400" },
];

function isCritical(field: string, value: number | null | undefined): boolean {
    if (value == null) return false;
    if (field === "systolic") return value > 140 || value < 90;
    if (field === "temperature") return value > 100.4;
    if (field === "heartRate") return value > 100 || value < 60;
    return false;
}

function CellValue({ field, value }: { field: string; value: number | null | undefined }) {
    if (value == null) return <span className="text-slate-600">—</span>;
    const critical = isCritical(field, value);
    return <span className={critical ? "text-red-400 font-black" : "text-slate-200"}>{field === "temperature" ? value.toFixed(1) : value}</span>;
}

export default function VitalsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<"today" | "history">("today");

    // Today state
    const [todayVitals, setTodayVitals] = useState<any[]>([]);
    const [activePatients, setActivePatients] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [loadingToday, setLoadingToday] = useState(true);

    // History state
    const [historyVitals, setHistoryVitals] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState("");
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(Date.now() - 7 * 86400000);
        return d.toISOString().split("T")[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [allPatients, setAllPatients] = useState<any[]>([]);

    useEffect(() => {
        if (user && !ALLOWED_ROLES.includes(user.role || "")) {
            router.replace("/care");
        }
    }, [user, router]);

    const fetchToday = useCallback(async () => {
        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch(`/api/care/vitals?date=${today}`);
            const data = await res.json();
            if (data.success) {
                setTodayVitals(data.vitals || []);
                setActivePatients(data.activePatients || []);
                setLastUpdated(new Date());
            }
        } catch (e) {
            console.error("Error fetching today vitals:", e);
        } finally {
            setLoadingToday(false);
        }
    }, []);

    // Fetch today on mount + polling
    useEffect(() => {
        fetchToday();
        const interval = setInterval(fetchToday, 30000);
        return () => clearInterval(interval);
    }, [fetchToday]);

    // Fetch all patients for history dropdown (reuse activePatients)
    useEffect(() => {
        if (activePatients.length > 0) {
            setAllPatients([...activePatients].sort((a, b) => a.name.localeCompare(b.name, "es")));
        }
    }, [activePatients]);

    const fetchHistory = async () => {
        if (!selectedPatient) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/care/vitals?patientId=${selectedPatient}&from=${dateFrom}&to=${dateTo}`);
            const data = await res.json();
            if (data.success) setHistoryVitals(data.vitals || []);
        } catch (e) {
            console.error("Error fetching history:", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Group today vitals by color
    const groupedToday = COLOR_GROUPS.map(group => {
        const groupPats = activePatients.filter(p => (p.colorGroup || "UNASSIGNED") === group.key);
        const patsWithVitals = groupPats.map(pat => {
            const patVitals = todayVitals.filter(v => v.patientId === pat.id);
            return { ...pat, vitals: patVitals };
        });
        return { ...group, patients: patsWithVitals };
    }).filter(g => g.patients.length > 0);

    const printTitle = tab === "today"
        ? `Vitales — ${new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" })}`
        : `Vitales — ${allPatients.find(p => p.id === selectedPatient)?.name || "Residente"}`;

    if (!user || !ALLOWED_ROLES.includes(user.role || "")) return null;

    return (
        <>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white !important; color: black !important; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; color: black; }
                    th { background: #f1f5f9; font-weight: bold; }
                    .print-group-header { font-size: 14px; font-weight: bold; margin: 16px 0 8px; page-break-after: avoid; }
                    .print-title { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
                    .print-subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
                    .vitals-table-wrapper { page-break-inside: avoid; margin-bottom: 16px; }
                }
            `}</style>

            <div className="min-h-screen bg-slate-900 text-white print:bg-white print:text-black">
                {/* Print header */}
                <div className="print-only hidden px-8 pt-8">
                    <p className="print-title">{printTitle}</p>
                    <p className="print-subtitle">Zendity Healthcare — {user?.hqName || ""}</p>
                </div>

                {/* Screen header */}
                <div className="no-print px-6 py-4 flex items-center justify-between border-b border-slate-700">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push("/care")} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">← Volver</button>
                        <h1 className="text-xl font-black text-white tracking-tight">Vitales</h1>
                    </div>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors border border-slate-700">
                        🖨️ Imprimir
                    </button>
                </div>

                {/* Tabs */}
                <div className="no-print px-6 py-3 flex gap-2 border-b border-slate-800">
                    <button onClick={() => setTab("today")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "today" ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>Hoy</button>
                    <button onClick={() => setTab("history")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "history" ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>Historial</button>
                </div>

                <div className="px-6 py-6">
                    {/* ── TAB HOY ── */}
                    {tab === "today" && (
                        <div>
                            {lastUpdated && (
                                <p className="text-slate-500 text-xs mb-4 no-print">Actualizado a las {lastUpdated.toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                            )}

                            {loadingToday ? (
                                <div className="text-slate-500 text-center py-20 animate-pulse">Cargando vitales del dia...</div>
                            ) : groupedToday.length === 0 ? (
                                <div className="text-slate-500 text-center py-20">No hay residentes activos.</div>
                            ) : (
                                <div className="space-y-6">
                                    {groupedToday.map(group => (
                                        <div key={group.key} className="vitals-table-wrapper">
                                            <div className={`print-group-header ${group.text} font-black text-sm uppercase tracking-widest mb-3`}>{group.label}</div>
                                            <div className={`${group.bg} border ${group.border} rounded-2xl overflow-hidden print:rounded-none print:border-slate-300`}>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="border-b border-slate-700/50 print:border-slate-300">
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Residente</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Hab.</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Sistolica</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Diastolica</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Temp (F)</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Pulso</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Glucosa</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Tomado por</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Hora</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-700/30 print:divide-slate-200">
                                                            {group.patients.map(pat => {
                                                                if (pat.vitals.length === 0) {
                                                                    return (
                                                                        <tr key={pat.id} className="text-sm">
                                                                            <td className="px-4 py-3 font-bold text-slate-300 print:text-black">{pat.name}</td>
                                                                            <td className="px-4 py-3 text-slate-400 print:text-black">{pat.roomNumber || "—"}</td>
                                                                            <td className="px-4 py-3"><span className="text-slate-600">—</span></td>
                                                                            <td className="px-4 py-3"><span className="text-slate-600">—</span></td>
                                                                            <td className="px-4 py-3"><span className="text-slate-600">—</span></td>
                                                                            <td className="px-4 py-3"><span className="text-slate-600">—</span></td>
                                                                            <td className="px-4 py-3"><span className="text-slate-600">—</span></td>
                                                                            <td className="px-4 py-3"><span className="text-slate-600">—</span></td>
                                                                            <td className="px-4 py-3"><span className="text-slate-600">—</span></td>
                                                                        </tr>
                                                                    );
                                                                }
                                                                return pat.vitals.map((v: any, idx: number) => (
                                                                    <tr key={v.id} className="text-sm">
                                                                        {idx === 0 ? (
                                                                            <td className="px-4 py-3 font-bold text-slate-300 print:text-black" rowSpan={pat.vitals.length}>{pat.name}</td>
                                                                        ) : null}
                                                                        {idx === 0 ? (
                                                                            <td className="px-4 py-3 text-slate-400 print:text-black" rowSpan={pat.vitals.length}>{pat.roomNumber || "—"}</td>
                                                                        ) : null}
                                                                        <td className="px-4 py-3"><CellValue field="systolic" value={v.systolic} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="diastolic" value={v.diastolic} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="temperature" value={v.temperature} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="heartRate" value={v.heartRate} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="glucose" value={v.glucose} /></td>
                                                                        <td className="px-4 py-3 text-slate-400 text-xs print:text-black">{v.measuredBy?.name || "—"}</td>
                                                                        <td className="px-4 py-3 text-slate-400 text-xs print:text-black">{new Date(v.createdAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" })}</td>
                                                                    </tr>
                                                                ));
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB HISTORIAL ── */}
                    {tab === "history" && (
                        <div>
                            <div className="flex flex-col sm:flex-row gap-3 mb-6 no-print">
                                <select
                                    value={selectedPatient}
                                    onChange={e => setSelectedPatient(e.target.value)}
                                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-500"
                                >
                                    <option value="">Seleccionar residente...</option>
                                    {allPatients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} — {p.roomNumber || "S/N"}</option>
                                    ))}
                                </select>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-500" />
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-500" />
                                <button onClick={fetchHistory} disabled={!selectedPatient || loadingHistory} className="px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors text-sm">
                                    {loadingHistory ? "Buscando..." : "Buscar"}
                                </button>
                            </div>

                            {historyVitals.length > 0 ? (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden print:rounded-none print:border-slate-300">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-slate-700 print:border-slate-300">
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Fecha</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Hora</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Sistolica</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Diastolica</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Temp (F)</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Pulso</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Glucosa</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black">Tomado por</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/30 print:divide-slate-200">
                                                {historyVitals.map((v: any) => (
                                                    <tr key={v.id} className="text-sm">
                                                        <td className="px-4 py-3 text-slate-300 print:text-black">{new Date(v.createdAt).toLocaleDateString("es-PR")}</td>
                                                        <td className="px-4 py-3 text-slate-400 print:text-black">{new Date(v.createdAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" })}</td>
                                                        <td className="px-4 py-3"><CellValue field="systolic" value={v.systolic} /></td>
                                                        <td className="px-4 py-3"><CellValue field="diastolic" value={v.diastolic} /></td>
                                                        <td className="px-4 py-3"><CellValue field="temperature" value={v.temperature} /></td>
                                                        <td className="px-4 py-3"><CellValue field="heartRate" value={v.heartRate} /></td>
                                                        <td className="px-4 py-3"><CellValue field="glucose" value={v.glucose} /></td>
                                                        <td className="px-4 py-3 text-slate-400 text-xs print:text-black">{v.measuredBy?.name || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-slate-500 text-center py-16 text-sm">
                                    {selectedPatient ? "No se encontraron vitales en ese rango." : "Selecciona un residente y rango de fechas."}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
