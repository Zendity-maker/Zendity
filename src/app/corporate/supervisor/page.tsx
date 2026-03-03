"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Brain, CalendarClock, Users, Loader2, Sparkles, Send, Trash2, CheckCircle2 } from "lucide-react";

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

    useEffect(() => {
        fetchSupervisorData();
    }, []);

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
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2.5rem] p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-teal-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-black mb-4 flex items-center gap-4">
                        <Brain className="w-12 h-12 text-teal-400" />
                        Cabina del Supervisor
                    </h1>
                    <p className="text-xl text-slate-300 font-medium max-w-2xl">
                        Centro de Control Logístico B2B. Asigna horarios del Staff y apóyate en Zendi AI para redactar reportes disciplinarios o de mérito.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* PANEL IZQUIERDO: ROSTER & TURNOS */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                        <CalendarClock className="w-7 h-7 text-teal-600" />
                        Roster de Cuidadores
                    </h2>

                    <form onSubmit={handleAddShift} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 space-y-4">
                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-widest">Asignar Nuevo Turno</h3>
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">Empleado</label>
                            <select required value={shiftForm.employeeId} onChange={e => setShiftForm({ ...shiftForm, employeeId: e.target.value })} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 bg-white">
                                <option value="">Selecciona un Cuidador/Enfermera</option>
                                {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-1">Inicio (Ingreso)</label>
                                <input type="datetime-local" required value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 bg-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-1">Fin (Salida)</label>
                                <input type="datetime-local" required value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 bg-white text-sm" />
                            </div>
                        </div>
                        <button type="submit" disabled={isSavingShift} className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold shadow-md transition-colors flex justify-center items-center gap-2">
                            {isSavingShift ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fijar Horario"}
                        </button>
                    </form>

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
