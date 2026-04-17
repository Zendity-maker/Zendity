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

function PrintCellValue({ field, value }: { field: string; value: number | null | undefined }) {
    if (value == null) return <>—</>;
    const critical = isCritical(field, value);
    const display = field === "temperature" ? (value as number).toFixed(1) : String(value);
    return critical ? <strong>{display} *</strong> : <>{display}</>;
}

export default function VitalsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<"today" | "history">("today");

    // HQ info
    const [hqInfo, setHqInfo] = useState<{ name: string; address: string; phone: string; email: string }>({
        name: "", address: "", phone: "", email: ""
    });

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

    // Fetch HQ info
    useEffect(() => {
        const hqId = user?.hqId || user?.headquartersId;
        if (!hqId) return;
        fetch(`/api/corporate?headquartersId=${hqId}`)
            .then(r => r.json())
            .then(data => {
                const hq = data?.headquarters || data;
                setHqInfo({
                    name: hq?.name || user?.hqName || "",
                    address: hq?.billingAddress || "",
                    phone: hq?.ownerPhone || "",
                    email: hq?.ownerEmail || ""
                });
            })
            .catch(() => {
                setHqInfo({ name: user?.hqName || "", address: "", phone: "", email: "" });
            });
    }, [user]);

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

    useEffect(() => {
        fetchToday();
        const interval = setInterval(fetchToday, 30000);
        return () => clearInterval(interval);
    }, [fetchToday]);

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

    const todayFormatted = new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
    const nowFormatted = new Date().toLocaleString("es-PR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const selectedPatientData = allPatients.find(p => p.id === selectedPatient);

    if (!user || !ALLOWED_ROLES.includes(user.role || "")) return null;

    return (
        <>
            <style>{`
                @media print {
                    @page { margin: 2cm; }
                    body, html { background: white !important; color: black !important; font-family: Arial, sans-serif !important; font-size: 11px !important; }
                    * { box-shadow: none !important; text-shadow: none !important; }
                    .no-print { display: none !important; }
                    #print-document { display: block !important; }
                    #print-document table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
                    #print-document th, #print-document td { border: 1px solid #999; padding: 5px 8px; font-size: 11px; color: black; text-align: left; }
                    #print-document th { background: #e2e8f0; font-weight: bold; font-size: 10px; text-transform: uppercase; }
                    .print-group-section { page-break-inside: avoid; margin-bottom: 20px; }
                    .print-group-title { font-size: 13px; font-weight: bold; padding: 4px 8px; background: #f1f5f9; border: 1px solid #999; border-bottom: none; }
                    .print-header-block { margin-bottom: 20px; }
                    .print-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 4px; }
                }
            `}</style>

            {/* ════════ PRINT DOCUMENT (hidden on screen) ════════ */}
            <div id="print-document" className="hidden" style={{ display: 'none' }}>
                {/* Header institucional */}
                <div className="print-header-block">
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '2px' }}>{hqInfo.name || "Zendity Healthcare"}</div>
                    {hqInfo.address && <div style={{ fontSize: '11px' }}>{hqInfo.address}</div>}
                    <div style={{ fontSize: '11px' }}>
                        {hqInfo.phone && <span>Tel: {hqInfo.phone}</span>}
                        {hqInfo.phone && hqInfo.email && <span> | </span>}
                        {hqInfo.email && <span>{hqInfo.email}</span>}
                    </div>
                    <hr style={{ borderTop: '2px solid black', margin: '8px 0' }} />

                    {tab === "today" ? (
                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', margin: '12px 0 4px' }}>
                            Reporte de Signos Vitales — {todayFormatted}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', margin: '12px 0 4px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Historial de Signos Vitales — {selectedPatientData?.name || "Residente"}</div>
                            <div style={{ fontSize: '11px', color: '#444' }}>Periodo: {dateFrom} al {dateTo}</div>
                        </div>
                    )}

                    <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', marginBottom: '4px' }}>
                        Generado el {nowFormatted} por {user?.name || "Sistema"}
                    </div>
                    <hr style={{ borderTop: '1px solid black', margin: '8px 0 16px' }} />
                </div>

                {/* Body — Tab Hoy */}
                {tab === "today" && groupedToday.map(group => (
                    <div key={group.key} className="print-group-section">
                        <div className="print-group-title">{group.label}</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Residente</th><th>Hab.</th><th>Sistolica</th><th>Diastolica</th>
                                    <th>Temp °F</th><th>Pulso</th><th>Glucosa</th><th>Tomado por</th><th>Hora</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.patients.map(pat => {
                                    if (pat.vitals.length === 0) {
                                        return (
                                            <tr key={pat.id}>
                                                <td><strong>{pat.name}</strong></td>
                                                <td>{pat.roomNumber || "—"}</td>
                                                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                                            </tr>
                                        );
                                    }
                                    return pat.vitals.map((v: any, idx: number) => (
                                        <tr key={v.id}>
                                            {idx === 0 && <td rowSpan={pat.vitals.length}><strong>{pat.name}</strong></td>}
                                            {idx === 0 && <td rowSpan={pat.vitals.length}>{pat.roomNumber || "—"}</td>}
                                            <td><PrintCellValue field="systolic" value={v.systolic} /></td>
                                            <td><PrintCellValue field="diastolic" value={v.diastolic} /></td>
                                            <td><PrintCellValue field="temperature" value={v.temperature} /></td>
                                            <td><PrintCellValue field="heartRate" value={v.heartRate} /></td>
                                            <td><PrintCellValue field="glucose" value={v.glucose} /></td>
                                            <td>{v.measuredBy?.name || "—"}</td>
                                            <td>{new Date(v.createdAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" })}</td>
                                        </tr>
                                    ));
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}

                {/* Body — Tab Historial */}
                {tab === "history" && historyVitals.length > 0 && (
                    <div className="print-group-section">
                        {selectedPatientData && (
                            <div style={{ marginBottom: '8px', fontSize: '11px' }}>
                                <strong>Residente:</strong> {selectedPatientData.name} | <strong>Habitacion:</strong> {selectedPatientData.roomNumber || "S/N"} | <strong>Grupo:</strong> {selectedPatientData.colorGroup || "Sin asignar"}
                            </div>
                        )}
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th><th>Hora</th><th>Sistolica</th><th>Diastolica</th>
                                    <th>Temp °F</th><th>Pulso</th><th>Glucosa</th><th>Tomado por</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyVitals.map((v: any) => (
                                    <tr key={v.id}>
                                        <td>{new Date(v.createdAt).toLocaleDateString("es-PR")}</td>
                                        <td>{new Date(v.createdAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" })}</td>
                                        <td><PrintCellValue field="systolic" value={v.systolic} /></td>
                                        <td><PrintCellValue field="diastolic" value={v.diastolic} /></td>
                                        <td><PrintCellValue field="temperature" value={v.temperature} /></td>
                                        <td><PrintCellValue field="heartRate" value={v.heartRate} /></td>
                                        <td><PrintCellValue field="glucose" value={v.glucose} /></td>
                                        <td>{v.measuredBy?.name || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Leyenda y pie */}
                <div style={{ fontSize: '10px', color: '#666', marginTop: '16px' }}>* Valor fuera de rango normal</div>
                <div className="print-footer">Zendity Healthcare Management Platform — Documento Confidencial</div>
            </div>

            {/* ════════ SCREEN UI ════════ */}
            <div className="min-h-screen bg-slate-900 text-white no-print">
                {/* Screen header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700">
                    <div className="flex items-center gap-4 pl-32">
                        <h1 className="text-xl font-black text-white tracking-tight">Vitales</h1>
                    </div>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors border border-slate-700">
                        🖨️ Imprimir
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 py-3 flex gap-2 border-b border-slate-800">
                    <button onClick={() => setTab("today")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "today" ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>Hoy</button>
                    <button onClick={() => setTab("history")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${tab === "history" ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>Historial</button>
                </div>

                <div className="px-6 py-6">
                    {/* ── TAB HOY ── */}
                    {tab === "today" && (
                        <div>
                            {lastUpdated && (
                                <p className="text-slate-500 text-xs mb-4">Actualizado a las {lastUpdated.toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                            )}

                            {loadingToday ? (
                                <div className="text-slate-500 text-center py-20 animate-pulse">Cargando vitales del dia...</div>
                            ) : groupedToday.length === 0 ? (
                                <div className="text-slate-500 text-center py-20">No hay residentes activos.</div>
                            ) : (
                                <div className="space-y-6">
                                    {groupedToday.map(group => (
                                        <div key={group.key}>
                                            <div className={`${group.text} font-black text-sm uppercase tracking-widest mb-3`}>{group.label}</div>
                                            <div className={`${group.bg} border ${group.border} rounded-2xl overflow-hidden`}>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="border-b border-slate-700/50">
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Residente</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hab.</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Sistolica</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Diastolica</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Temp (F)</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Pulso</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Glucosa</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Tomado por</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hora</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-700/30">
                                                            {group.patients.map(pat => {
                                                                if (pat.vitals.length === 0) {
                                                                    return (
                                                                        <tr key={pat.id} className="text-sm">
                                                                            <td className="px-4 py-3 font-bold text-slate-300">{pat.name}</td>
                                                                            <td className="px-4 py-3 text-slate-400">{pat.roomNumber || "—"}</td>
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
                                                                        {idx === 0 && <td className="px-4 py-3 font-bold text-slate-300" rowSpan={pat.vitals.length}>{pat.name}</td>}
                                                                        {idx === 0 && <td className="px-4 py-3 text-slate-400" rowSpan={pat.vitals.length}>{pat.roomNumber || "—"}</td>}
                                                                        <td className="px-4 py-3"><CellValue field="systolic" value={v.systolic} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="diastolic" value={v.diastolic} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="temperature" value={v.temperature} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="heartRate" value={v.heartRate} /></td>
                                                                        <td className="px-4 py-3"><CellValue field="glucose" value={v.glucose} /></td>
                                                                        <td className="px-4 py-3 text-slate-400 text-xs">{v.measuredBy?.name || "—"}</td>
                                                                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(v.createdAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" })}</td>
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
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
                                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-slate-700">
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hora</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Sistolica</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Diastolica</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Temp (F)</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Pulso</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Glucosa</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Tomado por</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/30">
                                                {historyVitals.map((v: any) => (
                                                    <tr key={v.id} className="text-sm">
                                                        <td className="px-4 py-3 text-slate-300">{new Date(v.createdAt).toLocaleDateString("es-PR")}</td>
                                                        <td className="px-4 py-3 text-slate-400">{new Date(v.createdAt).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" })}</td>
                                                        <td className="px-4 py-3"><CellValue field="systolic" value={v.systolic} /></td>
                                                        <td className="px-4 py-3"><CellValue field="diastolic" value={v.diastolic} /></td>
                                                        <td className="px-4 py-3"><CellValue field="temperature" value={v.temperature} /></td>
                                                        <td className="px-4 py-3"><CellValue field="heartRate" value={v.heartRate} /></td>
                                                        <td className="px-4 py-3"><CellValue field="glucose" value={v.glucose} /></td>
                                                        <td className="px-4 py-3 text-slate-400 text-xs">{v.measuredBy?.name || "—"}</td>
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
