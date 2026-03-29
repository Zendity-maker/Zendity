"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Brain, CalendarClock, Users, Loader2, Sparkles, Send, Trash2, CheckCircle2, Activity, Droplets, Coffee, Siren } from "lucide-react";

export default function SupervisorDashboardPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Rosters State
    const [staff, setStaff] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [shiftForm, setShiftForm] = useState({ employeeId: "", startTime: "", endTime: "" });
    const [isSavingShift, setIsSavingShift] = useState(false);

    // AI Writer State
    const [rawMemo, setRawMemo] = useState("");
    const [processedMemo, setProcessedMemo] = useState("");
    const [isThinking, setIsThinking] = useState(false);

    // FASE 30: Live Mission Monitor State
    const [liveData, setLiveData] = useState<any>(null);

    useEffect(() => {
        if (user) {
            fetchSupervisorData();
            fetchLiveData();
            const interval = setInterval(fetchLiveData, 15000); // Poll every 15s
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchLiveData = async () => {
        if (!user) return;
        const hqId = user.hqId || user.headquartersId || "hq-demo-1";
        try {
            const res = await fetch(`/api/corporate/supervisor/live?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) {
                setLiveData(data);
            }
        } catch (e) {
            console.error("Live fetch error", e);
        }
    };

    const fetchSupervisorData = async () => {
        try {
            const res = await fetch("/api/corporate/supervisor");
            const data = await res.json();
            if (data.success) {
                setStaff(data.staff || []);
                setSchedules(data.schedules || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleTriageAction = async (complaintId: string, action: string) => {
        setIsSavingShift(true);
        try {
            const res = await fetch("/api/corporate/complaints/triage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    complaintId,
                    action,
                    notes: `Triaged via Supervisor Dashboard at ${new Date().toLocaleTimeString()}`,
                    supervisorId: user?.id
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(` Queja ruteada exitosamente.`);
                fetchLiveData(); // Refresh list immediately
            } else {
                alert("Error de Triaje: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingShift(false);
        }
    };

    const handleAddShift = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingShift(true);
        try {
            const res = await fetch("/api/corporate/supervisor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(shiftForm)
            });
            if (res.ok) {
                setShiftForm({ employeeId: "", startTime: "", endTime: "" });
                fetchSupervisorData();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingShift(false);
        }
    };

    const handleDeleteShift = async (id: string) => {
        if (!confirm("¿Eliminar este turno de la base de datos?")) return;
        try {
            const res = await fetch(`/api/corporate/supervisor?id=${id}`, { method: "DELETE" });
            if (res.ok) fetchSupervisorData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleZendiRewrite = async () => {
        if (!rawMemo.trim()) return;
        setIsThinking(true);
        try {
            const res = await fetch("/api/ai/shadow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "SUPERVISOR_MEMO", rawText: rawMemo })
            });
            const data = await res.json();
            if (data.success) {
                setProcessedMemo(data.formattedText);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsThinking(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(processedMemo);
        alert("Memo copiado al portapapeles. Listo para enviar a RRHH o imprimir.");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-teal-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-black mb-4 flex items-center gap-4">
                        <Brain className="w-12 h-12 text-teal-400" />
                        Triage & Supervisión Corporativa
                    </h1>
                    <p className="text-xl text-slate-300 font-medium max-w-2xl">
                        Centro de Control Logístico B2B. Asigna horarios del Staff y apóyate en Zendi AI para redactar reportes disciplinarios o de mérito.
                    </p>
                </div>
            </div>

            {/* MISSION MONITOR FASE 30 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <Activity className="w-8 h-8 text-rose-500 animate-pulse" />
                        Monitor de Misión (Live)
                    </h2>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Sincronizado
                    </div>
                </div>

                {liveData ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {/* KPI 1: Caregivers */}
                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col items-center text-center relative overflow-hidden transition-all hover:shadow-md hover:border-indigo-200">
                            <Users className="w-10 h-10 text-indigo-500 mb-2" />
                            <p className="text-4xl font-black text-indigo-900 mb-1">{liveData.activeCaregivers}</p>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Cuidadores Activos</p>
                            {liveData.activeCaregivers === 0 && <span className="absolute top-2 right-2 text-xl" title="Piso vacío"></span>}
                        </div>
                        {/* KPI 2: Baths */}
                        <div className="bg-sky-50 p-6 rounded-3xl border border-sky-100 flex flex-col items-center text-center relative overflow-hidden transition-all hover:shadow-md hover:border-sky-200">
                            <Droplets className="w-10 h-10 text-sky-500 mb-2" />
                            <p className="text-4xl font-black text-sky-900 mb-1">{liveData.liveStats.baths}</p>
                            <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">Baños Completados</p>
                            <div className="absolute bottom-0 left-0 h-1.5 bg-sky-500 transition-all duration-1000" style={{ width: `${Math.min((liveData.liveStats.baths / 15) * 100, 100)}%` }}></div>
                        </div>
                        {/* KPI 3: Meals */}
                        <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex flex-col items-center text-center relative overflow-hidden transition-all hover:shadow-md hover:border-orange-200">
                            <Coffee className="w-10 h-10 text-orange-500 mb-2" />
                            <p className="text-4xl font-black text-orange-900 mb-1">
                                {Object.values(liveData.liveStats.meals).reduce((a: any, b: any) => a + b, 0) as number}
                            </p>
                            <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Bandejas Servidas</p>
                        </div>
                        {/* KPI 4: Incidents & Complaints */}
                        <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 flex flex-col items-center text-center relative overflow-hidden transition-all hover:shadow-md hover:border-rose-200">
                            <Siren className="w-10 h-10 text-rose-500 mb-2" />
                            <p className="text-4xl font-black text-rose-900 mb-1">{liveData.liveStats.incidents}</p>
                            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Incidentes Clínicos</p>
                            {liveData.liveStats.triageInbox > 0 && (
                                <div className="absolute top-3 right-3 bg-rose-600 text-white w-8 h-8 rounded-full flex justify-center items-center font-black shadow-lg shadow-rose-500/50 animate-bounce cursor-help" title={`${liveData.liveStats.triageInbox} quejas familiares en cola de triaje`}>
                                    {liveData.liveStats.triageInbox}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="py-16 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
                        <span className="font-bold text-slate-400">Reuniendo telemetría de Zendity Care...</span>
                    </div>
                )}
            </div>

            {/* BANDEJA DE TRIAJE (QUEJAS) FASE 30 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-6">
                    <Send className="w-7 h-7 text-indigo-500" />
                    Bandeja de Triaje (Ruteo Pendiente)
                </h2>
                {liveData && liveData.pendingComplaints?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {liveData.pendingComplaints.map((complaint: any) => (
                            <div key={complaint.id} className="bg-slate-50 border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="pr-4">
                                        <p className="font-black text-slate-800 text-lg mb-1 leading-tight">{complaint.subject}</p>
                                        <p className="text-xs font-bold text-slate-500 flex flex-col gap-1 mt-2">
                                            <span> Familiar: {complaint.familyMemberName}</span>
                                            <span> Px: {complaint.patient?.name || 'General'}</span>
                                        </p>
                                    </div>
                                    <span className="bg-amber-100 text-amber-700 font-black px-3 py-1 rounded-full text-xs shrink-0">PENDIENTE</span>
                                </div>
                                <p className="text-slate-600 font-medium text-sm bg-white p-4 rounded-xl border border-slate-100 mb-4 h-28 overflow-y-auto">
                                    "{complaint.description}"
                                </p>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => handleTriageAction(complaint.id, 'APPROVE')} disabled={isSavingShift} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-95 text-xs uppercase tracking-wide flex justify-center items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Validar & Rutear Admin
                                    </button>
                                    <button onClick={() => handleTriageAction(complaint.id, 'ESCALATE')} disabled={isSavingShift} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-95 text-xs uppercase tracking-wide flex justify-center items-center gap-2">
                                        <Siren className="w-4 h-4" /> Alerta Clínica Enfermería
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                        <h3 className="font-black text-slate-700 text-lg">Bandeja Limpia</h3>
                        <p className="text-slate-500 font-medium">No hay quejas de familiares pendientes de validar o rutear.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* PANEL IZQUIERDO: ROSTER & TURNOS */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                        <CalendarClock className="w-7 h-7 text-teal-600" />
                        Roster de Cuidadores
                    </h2>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-3">
                            <CalendarClock className="w-6 h-6" />
                        </div>
                        <h3 className="font-black text-slate-800 text-lg mb-2">Planificador Semanal & Zonas</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            Accede a la nueva interfaz avanzada para planificar turnos por bloques semanales (Mañana, Tarde, Noche, Oficina) y asignar colores de zona para el equipo clínico.
                        </p>
                        <a href="/corporate/supervisor/shifts" className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-bold shadow-md transition-colors flex justify-center items-center gap-2">
                            Abrir Planificador Avanzado
                        </a>
                    </div>

                    <h3 className="font-bold text-slate-800 mb-4 text-lg">Turnos Programados Recientemente</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {schedules.length === 0 ? (
                            <p className="text-slate-500 text-center py-6">No hay turnos futuros registrados.</p>
                        ) : (
                            schedules.map(shift => {
                                const start = new Date(shift.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                                const end = new Date(shift.endTime).toLocaleTimeString([], { timeStyle: 'short' });
                                return (
                                    <div key={shift.id} className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-teal-300 transition-colors">
                                        <div>
                                            <p className="font-bold text-slate-800 flex items-center gap-2">
                                                <Users className="w-4 h-4 text-teal-600" />
                                                {shift.employee?.name}
                                            </p>
                                            <p className="text-sm text-slate-500 font-medium mt-1">
                                                {start} - {end}
                                            </p>
                                        </div>
                                        <button onClick={() => handleDeleteShift(shift.id)} className="text-rose-400 hover:text-rose-600 p-2 bg-rose-50 rounded-lg transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* PANEL DERECHO: ZENDI AI WRITER */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <Sparkles className="w-7 h-7 text-indigo-500" />
                            Zendi Asistente HR
                        </h2>
                        <span className="bg-indigo-50 text-indigo-600 font-bold px-3 py-1 rounded-full text-xs border border-indigo-100 uppercase tracking-widest">
                            Powered by GPT-4o
                        </span>
                    </div>

                    <p className="text-sm text-slate-500 mb-6 font-medium">
                        Escribe notas breves de lo que pasó con el empleado (Llegó tarde, trató mal a un familiar, o un reconocimiento por buen trato). Zendi lo transformará en un informe profesional para el expediente.
                    </p>

                    <div className="flex-1 flex flex-col gap-6">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Borrador del Supervisor</label>
                            <textarea
                                value={rawMemo}
                                onChange={e => setRawMemo(e.target.value)}
                                placeholder="Ej. Joaneliz llegó tarde 30 minutos hoy por 3ra vez en la semana y no quiso ayudar con la comida..."
                                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 font-medium"
                            ></textarea>

                            <button
                                onClick={handleZendiRewrite}
                                disabled={isThinking || !rawMemo.trim()}
                                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex justify-center items-center gap-2 active:scale-95"
                            >
                                {isThinking ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Procesando NLP Científico...</>
                                ) : (
                                    <><Sparkles className="w-5 h-5" /> Redactar Documento Oficial</>
                                )}
                            </button>
                        </div>

                        {processedMemo && (
                            <div className="flex-1 border-t border-slate-100 pt-6 animate-in fade-in slide-in-from-bottom-4">
                                <label className="block text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Resultado Corporativo
                                </label>
                                <div className="bg-slate-900 text-slate-300 p-6 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                    {processedMemo}
                                </div>
                                <button
                                    onClick={copyToClipboard}
                                    className="mt-4 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors flex justify-center items-center gap-2"
                                >
                                    Copiar para Portal RH
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
