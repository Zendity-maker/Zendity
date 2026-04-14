"use client";

import { useState, useEffect } from "react";
import { CaregiverSession, TriageTicket, FastActionAssignment, LiveDataPayload, MissingHandover } from "@/types/care";
import { useAuth } from "@/context/AuthContext";
import { Brain, CalendarClock, Users, Loader2, Sparkles, Send, Trash2, CheckCircle2, Activity, Droplets, Coffee, Siren, Play, Square, Volume2, AlertTriangle, Info, ShieldAlert, FileText, Clock, XCircle, ChevronDown } from "lucide-react";
import TaskAssignmentButton from "@/components/TaskAssignmentButton";
import ReactMarkdown from 'react-markdown';
import ZendiAssist from "@/components/ZendiAssist";
import InfoTooltip from "@/components/ui/InfoTooltip";
import WriteIncidentModal from "@/components/hr/WriteIncidentModal";

// --- SUB-COMPONENT: Zendi Morning Briefing ---
const ZendiMorningBriefing = ({ text }: { text: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => {};
    }, []);

    if (!isMounted) return (
        <div className="bg-slate-900 rounded-[2rem] h-32 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-teal-500/50 animate-spin" />
        </div>
    );

    const handlePlayPause = async () => {
        if (isPlaying) {
            setIsPlaying(false);
            return;
        }
        setIsPlaying(true);
        try {
            const plainText = text.replace(/[*_#]/g, '');
            const res = await fetch("/api/zendi/speak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: plainText })
            });
            if (!res.ok) throw new Error("TTS failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(url);
            };
            await audio.play();
        } catch (err) {
            console.error("Zendi voice error:", err);
            setIsPlaying(false);
        }
    };

    return (
        <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-800 mb-8 relative overflow-hidden group">
                        <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-widest mb-1">
                            <Sparkles className="w-4 h-4" /> Zendi AI Engine
                        </div>
                        <h2 className="text-3xl font-black text-white">Prólogo del Turno (05:45 AM)</h2>
                        <p className="text-slate-500 text-sm mt-1">Resumen Ejecutivo del Turno Precedente y Focos de Atención Diario.</p>
                    </div>
                    <button 
                        onClick={handlePlayPause}
                        className={`flex items-center justify-center w-16 h-16 rounded-[1.5rem] shadow-lg transition-all active:scale-95 ${isPlaying ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse' : 'bg-slate-800 border-2 border-slate-700 hover:border-teal-500 text-white'}`}
                    >
                        {isPlaying ? <Square className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                    </button>
                </div>
                
                {isPlaying && (
                    <div className="flex items-end gap-1 h-6 mb-6">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="w-1.5 bg-teal-400 rounded-t-sm animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.05}s` }}></div>
                        ))}
                        <span className="text-xs text-teal-300 ml-2 font-bold animate-pulse">Reproduciendo...</span>
                    </div>
                )}

                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-li:marker:text-teal-400 font-medium">
                    <ReactMarkdown>{text}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
};
// ----------------------------------------------

// --- SUB-COMPONENT: Kitchen Feedback Widget ---
const KitchenFeedbackWidget = ({ user, onSaved }: { user: any; onSaved: () => void }) => {
    const [mealType, setMealType] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER'>('LUNCH');
    const [feedbackType, setFeedbackType] = useState<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'>('NEUTRAL');
    const [score, setScore] = useState(4);
    const [comments, setComments] = useState('');
    const [portionsOk, setPortionsOk] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSend = async () => {
        if (!comments.trim() || !user) return;
        setSaving(true);
        try {
            const hqId = user.hqId || user.headquartersId || '';
            const res = await fetch('/api/kitchen/observations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    headquartersId: hqId,
                    supervisorId: user.id,
                    satisfactionScore: score,
                    comments,
                    mealType,
                    feedbackType,
                    portionsAdequate: portionsOk,
                })
            });
            const data = await res.json();
            if (data.success) {
                setSaved(true);
                setComments('');
                setTimeout(() => setSaved(false), 3000);
                onSaved();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map(m => (
                    <button key={m} onClick={() => setMealType(m)}
                        className={`flex-1 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all border ${mealType === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                        {m === 'BREAKFAST' ? '🌅 Desayuno' : m === 'LUNCH' ? '☀️ Almuerzo' : '🌙 Cena'}
                    </button>
                ))}
            </div>
            <div className="flex gap-2">
                {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map(f => (
                    <button key={f} onClick={() => setFeedbackType(f)}
                        className={`flex-1 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all border ${
                            feedbackType === f
                                ? f === 'POSITIVE' ? 'bg-emerald-500 text-white border-emerald-500'
                                : f === 'NEGATIVE' ? 'bg-rose-500 text-white border-rose-500'
                                : 'bg-slate-400 text-white border-slate-400'
                                : 'bg-white text-slate-500 border-slate-200'}`}>
                        {f === 'POSITIVE' ? '✓ Positivo' : f === 'NEGATIVE' ? '✗ Negativo' : '— Neutro'}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Porciones</span>
                <button onClick={() => setPortionsOk(!portionsOk)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${portionsOk ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {portionsOk ? '✓ Adecuadas' : '✗ Inadecuadas'}
                </button>
                <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                    {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setScore(s)}
                            className={`text-xl transition-transform hover:scale-110 ${s <= score ? 'opacity-100' : 'opacity-25'}`}>⭐</button>
                    ))}
                </div>
            </div>
            <ZendiAssist
                value={comments}
                onChange={setComments}
                type="KITCHEN_OBS"
                context="observación del servicio de cocina"
                placeholder="Observación sobre el servicio de cocina..."
                rows={3}
            />
            {saved ? (
                <div className="w-full py-4 rounded-[2rem] bg-teal-50 text-teal-700 font-black text-sm text-center border border-teal-200">
                    ✓ Feedback enviado a cocina
                </div>
            ) : (
                <button onClick={handleSend} disabled={!comments.trim() || saving}
                    className="w-full py-4 rounded-[2rem] bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {saving ? 'Enviando...' : 'Enviar Feedback a Cocina'}
                </button>
            )}
        </div>
    );
};
// -----------------------------------------------

export default function SupervisorDashboardPage() {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const [staff, setStaff] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [shiftForm, setShiftForm] = useState({ employeeId: "", startTime: "", endTime: "" });
    const [isSavingShift, setIsSavingShift] = useState(false);

    const [rawMemo, setRawMemo] = useState("");
    const [processedMemo, setProcessedMemo] = useState("");
    const [isThinking, setIsThinking] = useState(false);

    const [liveData, setLiveData] = useState<LiveDataPayload | null>(null);

    // Zone Inspection Rounds (structured)
    const FLOORS = [
        { floor: 1, zones: ['Habitaciones 1-10', 'Baños P1', 'Comedor', 'Recepción', 'Pasillo Principal'] },
        { floor: 2, zones: ['Habitaciones 11-20', 'Baños P2', 'Sala de Estar P2', 'Pasillo P2'] },
    ];
    const ROUND_TYPES = [
        { id: 'INICIO', label: 'Ronda 1 — Inicio de Turno', time: '9:00 AM' },
        { id: 'MEDIO', label: 'Ronda 2 — Medio Turno', time: '12:30 PM' },
        { id: 'CIERRE', label: 'Ronda 3 — Cierre', time: '5:30 PM' },
    ];
    const [selectedRound, setSelectedRound] = useState('INICIO');
    const [selectedFloor, setSelectedFloor] = useState(1);
    const [zoneChecks, setZoneChecks] = useState<Record<string, { limpieza: boolean; seguridad: boolean; residentes: boolean; equipo: boolean; observations: string }>>({});
    const [isSavingRound, setIsSavingRound] = useState(false);
    const [todayInspections, setTodayInspections] = useState<any[]>([]);

    const initZoneChecks = () => {
        const checks: Record<string, { limpieza: boolean; seguridad: boolean; residentes: boolean; equipo: boolean; observations: string }> = {};
        FLOORS.forEach(f => f.zones.forEach(z => { checks[`${f.floor}-${z}`] = { limpieza: false, seguridad: false, residentes: false, equipo: false, observations: '' }; }));
        return checks;
    };

    useEffect(() => { setZoneChecks(initZoneChecks()); }, []);

    const fetchTodayInspections = async () => {
        if (!user) return;
        try {
            const hqId = user.hqId || user.headquartersId || '';
            const res = await fetch(`/api/care/zone-inspection?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) setTodayInspections(data.inspections || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (user) fetchTodayInspections(); }, [user]);

    const [dispatchingTicket, setDispatchingTicket] = useState<any>(null);
    const [isDispatching, setIsDispatching] = useState(false);

    const [incidentModalOpen, setIncidentModalOpen] = useState(false);

    // Fast Actions: countdown tick + history
    const [tickNow, setTickNow] = useState(Date.now());
    const [showTaskHistory, setShowTaskHistory] = useState(false);
    const [taskHistory, setTaskHistory] = useState<any[]>([]);
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

    useEffect(() => {
        const tick = setInterval(() => setTickNow(Date.now()), 30000);
        return () => clearInterval(tick);
    }, []);

    const fetchTaskHistory = async () => {
        if (!user) return;
        const hqId = user.hqId || user.headquartersId || '';
        try {
            const res = await fetch(`/api/care/supervisor/live?hqId=${hqId}`);
            const data = await res.json();
            // activeFastActions only has PENDING; we need COMPLETED/FAILED from today
            // Use a lightweight direct query
        } catch (e) { console.error(e); }
    };

    const handleUpdateTaskStatus = async (id: string, status: 'COMPLETED' | 'FAILED') => {
        setUpdatingTaskId(id);
        try {
            const res = await fetch('/api/care/fast-actions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            const data = await res.json();
            if (data.success || data.task) {
                setToast({ msg: status === 'COMPLETED' ? 'Tarea completada ✓' : 'Tarea marcada como fallida', type: status === 'COMPLETED' ? 'ok' : 'err' });
                fetchLiveData(); // Refresh live data to remove from pending
            } else {
                setToast({ msg: data.error || 'Error actualizando tarea', type: 'err' });
            }
        } catch (e) {
            console.error(e);
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setUpdatingTaskId(null);
        }
    };

    useEffect(() => {
        if (user) {
            fetchSupervisorData();
            fetchLiveData();
            const interval = setInterval(fetchLiveData, 15000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchLiveData = async () => {
        if (!user) return;
        const hqId = user.hqId || user.headquartersId || "hq-demo-1";
        try {
            const res = await fetch(`/api/care/supervisor/live?hqId=${hqId}`);
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
            const res = await fetch("/api/care/supervisor");
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

    const handleDispatchTask = async (caregiverId: string) => {
        if (!dispatchingTicket || !user) return;
        setIsDispatching(true);
        try {
            const hqId = user.hqId || user.headquartersId || "hq-demo-1";
            const payload = {
                headquartersId: hqId,
                supervisorId: user.id,
                caregiverId,
                sourceType: dispatchingTicket.sourceType,
                sourceId: dispatchingTicket.sourceType === 'ZENDI_GROUP' ? dispatchingTicket.items.map((i:any)=>i.id) : dispatchingTicket.sourceId,
                description: `[${dispatchingTicket.id}] Triage: ${dispatchingTicket.title} - ${dispatchingTicket.description}`.substring(0, 800)
            };
            const res = await fetch("/api/care/supervisor/dispatch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setDispatchingTicket(null);
                fetchLiveData(); 
            } else {
                setToast({ msg: "Error en despacho 1-Click: " + data.error, type: 'err' });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDispatching(false);
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
                setToast({ msg: "Queja ruteada exitosamente.", type: 'ok' });
                fetchLiveData();
            } else {
                setToast({ msg: "Error de Triaje: " + data.error, type: 'err' });
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
            const res = await fetch("/api/care/supervisor", {
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
            const res = await fetch(`/api/care/supervisor?id=${id}`, { method: "DELETE" });
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

    const handleSaveRound = async () => {
        if (!user) return;
        setIsSavingRound(true);
        const hqId = user.hqId || user.headquartersId || '';
        const currentFloorZones = FLOORS.find(f => f.floor === selectedFloor)?.zones || [];
        let savedCount = 0;
        try {
            for (const zoneName of currentFloorZones) {
                const key = `${selectedFloor}-${zoneName}`;
                const check = zoneChecks[key];
                if (!check) continue;
                const res = await fetch('/api/care/zone-inspection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        headquartersId: hqId,
                        supervisorId: user.id,
                        roundType: selectedRound,
                        floor: selectedFloor,
                        zoneName,
                        checklistData: { limpieza: check.limpieza, seguridad: check.seguridad, residentes: check.residentes, equipo: check.equipo },
                        observations: check.observations || null,
                    }),
                });
                const data = await res.json();
                if (data.success) savedCount++;
            }
            if (savedCount > 0) {
                setToast({ msg: `Ronda ${selectedRound} Piso ${selectedFloor}: ${savedCount} zonas registradas ✓`, type: 'ok' });
                setZoneChecks(initZoneChecks());
                fetchTodayInspections();
            } else {
                setToast({ msg: 'Error guardando ronda.', type: 'err' });
            }
        } catch (error) {
            console.error(error);
            setToast({ msg: 'Error de conexión.', type: 'err' });
        } finally {
            setIsSavingRound(false);
        }
    };



    const copyToClipboard = () => {
        navigator.clipboard.writeText(processedMemo);
        setToast({ msg: "Memo copiado al portapapeles. Listo para enviar a RRHH o imprimir.", type: 'ok' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-32">
                <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
            </div>
        );
    }

    const nowTime = new Date().getTime();
    const activeSessions = liveData?.activeSessions || [];
    const missingHandovers = liveData?.missingHandovers || [];
    const activeEmployeeIds = activeSessions.map((s: CaregiverSession) => s.caregiverId);

    const enPiso = activeSessions.filter((s: CaregiverSession) => (nowTime - new Date(s.startTime).getTime()) / 3600000 < 12);
    const zombis = activeSessions.filter((s: CaregiverSession) => (nowTime - new Date(s.startTime).getTime()) / 3600000 >= 12);
    
    const progMissing = (schedules || []).filter((s: any) => {
        const empId = s.userId || s.employeeId;
        return empId && !activeEmployeeIds.includes(empId);
    });

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-8 font-sans">
            <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-8 pb-16">
                
                {/* GLOBAL HUD ROW (KPIs) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Header Mission Control */}
                    <div className="lg:col-span-5 bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-xl flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h1 className="text-3xl lg:text-4xl font-black text-white mb-2 flex items-center gap-3">
                                <ShieldAlert className="w-8 h-8 text-teal-400" />
                                Triage Central
                            </h1>
                            <p className="text-slate-500 font-medium text-sm md:text-base mb-8">
                                Monitoreo Operativo y Despacho en Tiempo Real.
                            </p>
                            <TaskAssignmentButton user={user} buttonLabel="Asignar Meta Libre (15m)" buttonStyle="bg-teal-500 hover:bg-teal-400 text-slate-900 font-black px-6 py-4 rounded-[1.5rem] shadow-lg active:scale-95 transition-all text-sm w-max" />
                        </div>
                    </div>

                    {/* Live KPIs Bento */}
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center transition-colors hover:border-slate-300">
                            <Users className="w-8 h-8 text-teal-600 mb-3" />
                            <p className="text-4xl font-black text-slate-800 leading-none">{liveData ? liveData.activeCaregivers : "-"}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1">En Piso <InfoTooltip text="Cuidadores con sesión activa en este momento. No incluye personal programado que aún no ha hecho login." /></p>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center transition-colors hover:border-slate-300">
                            <Droplets className="w-8 h-8 text-slate-500 mb-3" />
                            <p className="text-4xl font-black text-slate-800 leading-none">{liveData ? liveData.liveStats.baths : "-"}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1">Baños <InfoTooltip text="Registros de baño completados en el turno actual. Se actualiza cada vez que un cuidador documenta el aseo de un residente." /></p>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center transition-colors hover:border-slate-300">
                            <Coffee className="w-8 h-8 text-slate-500 mb-3" />
                            <p className="text-4xl font-black text-slate-800 leading-none">{liveData ? Object.values(liveData.liveStats.meals).reduce((a:any, b:any) => a + b, 0) : "-"}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1">Dietas <InfoTooltip text="Comidas documentadas en el turno. Incluye desayuno, almuerzo y cena según el horario del turno activo." /></p>
                        </div>
                        
                        {/* Indicador de Incidentes (Crítico si > 0) */}
                        <div className={`rounded-[2rem] p-6 shadow-sm border flex flex-col items-center justify-center text-center transition-all ${liveData && liveData.liveStats.incidents > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
                            <Siren className={`w-8 h-8 mb-3 transition-colors ${liveData && liveData.liveStats.incidents > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
                            <p className={`text-4xl font-black leading-none ${liveData && liveData.liveStats.incidents > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                                {liveData ? liveData.liveStats.incidents : "-"}
                            </p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1 ${liveData && liveData.liveStats.incidents > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                Incidentes <InfoTooltip text="Tickets de triage abiertos o sin resolver. Se vuelve rojo cuando hay incidentes activos que requieren atención inmediata." />
                            </p>
                        </div>
                    </div>
                </div>

                {/* Panel de Ausencias — solo visible si hay personal programado sin sesión */}
                {progMissing && progMissing.length > 0 && (
                    <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                    Personal No Presentado <InfoTooltip text="Empleados programados en el horario que no han iniciado sesión. Usa 'Marcar Ausente' para activar la redistribución automática de residentes entre el equipo activo." />
                                </h3>
                                <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                                    {progMissing.length}
                                </span>
                            </div>
                            <span className="text-red-400 text-xs font-medium">
                                Turno activo sin sesión abierta
                            </span>
                        </div>
                        <div className="space-y-2">
                            {progMissing.map((emp: any) => {
                                const empName = emp.employee?.name || emp.name || emp.userName || 'Empleado';
                                const empColor = emp.zoneColor || emp.colorGroup || null;
                                const empRole = emp.employee?.role || emp.role || '';
                                const empShiftId = emp.id || emp.shiftId;
                                return (
                                    <div key={empShiftId}
                                        className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3 border border-red-500/20">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-red-900/60 flex items-center justify-center">
                                                <span className="text-red-400 text-xs font-black">
                                                    {empName[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm">{empName}</p>
                                                <p className="text-slate-500 text-xs">
                                                    {empColor ? `Grupo ${empColor}` : empRole || 'Sin grupo asignado'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`¿Marcar a ${empName} como ausente? Se iniciará redistribución en 15 minutos.`)) return;
                                                try {
                                                    const hq = (user as any)?.hqId || (user as any)?.headquartersId || '';
                                                    const res = await fetch('/api/hr/schedule/absent', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            scheduledShiftId: empShiftId,
                                                            markedById: user?.id,
                                                            hqId: hq
                                                        })
                                                    });
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        alert(`✓ ${empName} marcado como ausente. Redistribución en 15 minutos.`);
                                                    } else {
                                                        alert('Error al marcar ausencia. Intenta de nuevo.');
                                                    }
                                                } catch (e) {
                                                    alert('Error de conexión.');
                                                }
                                            }}
                                            className="bg-red-500 hover:bg-red-600 text-white text-xs font-black px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                                        >
                                            Marcar Ausente
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ZENDI ZONES (Briefing & ATC Detection) */}
                <div className="flex flex-col gap-6">
                    {liveData?.morningBriefing && (
                        <ZendiMorningBriefing text={liveData.morningBriefing} />
                    )}

                    {/* ATC Detection */}
                    {(() => {
                        if (!liveData) return null;
                        const pxClusters = liveData.triageFeed.filter((t: TriageTicket) => t.sourceType === 'ZENDI_PX_CLUSTER').length;
                        const overloadedCaregivers = liveData.activeSessions.filter((s: CaregiverSession) => {
                            return (liveData.activeFastActions?.filter((fa: FastActionAssignment) => fa.caregiverId === s.caregiverId && fa.status === 'PENDING').length || 0) >= 3;
                        }).length;
                        
                        if (pxClusters > 0 || overloadedCaregivers > 0) {
                            return (
                                <div className="bg-amber-50 rounded-[2rem] p-6 border-l-[8px] border-amber-400 border-y border-r border-amber-200 shadow-sm flex items-center gap-5">
                                    <div className="w-14 h-14 bg-amber-100 rounded-[1.5rem] flex items-center justify-center shrink-0">
                                        <Sparkles className="w-7 h-7 text-amber-600 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-amber-900 font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2">Zendi ATC: Ruido Operativo Estructural <InfoTooltip text="Air Traffic Control — Zendi detecta automáticamente cuando un cuidador tiene 3 o más tareas pendientes simultáneas o cuando hay múltiples residentes vulnerables sin atención reciente." /></p>
                                        <p className="text-amber-700 font-bold text-sm">
                                            {[
                                                pxClusters > 0 ? `${pxClusters} Clúster(s) de Vulnerabilidad Múltiple` : null,
                                                overloadedCaregivers > 0 ? `${overloadedCaregivers} Cuidador(es) Sobresaturado(s)` : null
                                            ].filter(Boolean).join(' | ')}
                                        </p>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>

                {/* LAYOUT REDISEÑADO — 3 filas */}
                <div className="flex flex-col gap-6">

                    {/* FILA 1 — Inbox Operativo, ancho completo */}
                    <div className="w-full">
                        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 min-h-[500px] flex flex-col">
                            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-5">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                                        <Activity className="w-8 h-8 text-teal-600" /> Inbox Operativo
                                        <InfoTooltip text="Tickets clínicos ordenados por urgencia: INMINENTE (rojo) requiere acción inmediata, ATENCIÓN (ámbar) en las próximas 2 horas, RUTINA (gris) antes del cierre del turno." />
                                    </h2>
                                    <p className="text-slate-500 font-medium mt-1">
                                        Tickets clínicos, preventivos y reportes familiares en espera.
                                    </p>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <span className="bg-white border text-rose-800 border-rose-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex gap-2 items-center">
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div> Inminente ({liveData?.triageFeed?.filter((t: TriageTicket) => t.urgency === 'INMINENTE').length || 0})
                                    </span>
                                    <span className="bg-white border text-amber-800 border-amber-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex gap-2 items-center">
                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div> Atención ({liveData?.triageFeed?.filter((t: TriageTicket) => t.urgency === 'ATENCION').length || 0})
                                    </span>
                                </div>
                            </div>

                            {!liveData ? (
                                <div className="flex-1 flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-slate-500" /></div>
                            ) : liveData.triageFeed?.length > 0 ? (
                                <div className="space-y-4">
                                    {[...liveData.triageFeed].sort((a,b) => {
                                        const rank = { INMINENTE: 3, ATENCION: 2, RUTINA: 1 };
                                        return (rank[b.urgency as keyof typeof rank] || 0) - (rank[a.urgency as keyof typeof rank] || 0);
                                    }).map((ticket: TriageTicket) => {
                                        
                                        const isCrisis = ticket.urgency === 'INMINENTE';
                                        const isAttention = ticket.urgency === 'ATENCION';
                                        
                                        // Semántica Estricta: Full background descartado, se usa borde denso y fondo blanco/tenue
                                        const cardBorderLayout = isCrisis ? 'border-l-[8px] border-l-rose-500 bg-white border-y border-r border-slate-200 shadow-sm' 
                                            : isAttention ? 'border-l-[8px] border-l-amber-400 bg-white border-y border-r border-slate-200 shadow-sm' 
                                            : 'border-l-[8px] border-l-slate-300 bg-white border-y border-r border-slate-200 shadow-sm';

                                        const pillColor = isCrisis ? 'bg-rose-100 text-rose-800' 
                                            : isAttention ? 'bg-amber-100 text-amber-800' 
                                            : 'bg-slate-100 text-slate-600';

                                        return (
                                            <div key={ticket.id} className={`rounded-[1.5rem] p-6 flex flex-col lg:flex-row gap-6 items-start lg:items-center transition-all hover:shadow-md ${cardBorderLayout}`}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${pillColor}`}>
                                                            {ticket.urgency}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                                                            {ticket.category.replace('_', ' ')}
                                                        </span>
                                                        {ticket.sourceType === 'ZENDI_GROUP' && (
                                                            <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-100 font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                                                <Sparkles className="w-3 h-3" /> Zendi Agrupación
                                                            </span>
                                                        )}
                                                        {ticket.sourceType === 'CLINICAL_ALERT' && (
                                                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                                                <AlertTriangle className="w-3 h-3" /> {ticket.category === 'UPP_PIEL' ? 'Alerta UPP' : 'Alerta Clínica'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 leading-tight mb-2">
                                                        {ticket.title}
                                                    </h3>
                                                    <p className="text-sm font-semibold text-slate-500 mb-3">
                                                        Sujeto: <span className="text-slate-800 ml-1">{ticket.patientName}</span>
                                                    </p>
                                                    <div className="bg-slate-50 text-slate-700 font-medium text-sm p-4 rounded-[1rem] border border-slate-200 shadow-inner">
                                                        "{ticket.description}"
                                                    </div>
                                                </div>
                                                
                                                <div className="w-full lg:w-64 shrink-0 mt-4 lg:mt-0">
                                                    {(() => {
                                                        const assignedTask = liveData.activeFastActions?.find((fa: FastActionAssignment) => fa.description.startsWith(`[${ticket.id}]`));
                                                        if (assignedTask) {
                                                            const caregiverMatch = liveData.activeSessions?.find((s: CaregiverSession)=>s.caregiverId === assignedTask.caregiverId);
                                                            const employeeName = caregiverMatch?.caregiver?.name || "Cuidador";
                                                            const isExpired = new Date(assignedTask.expiresAt).getTime() < new Date().getTime();
                                                            
                                                            return (
                                                                <div className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center justify-center text-center ${isExpired ? 'bg-rose-50 border-rose-200' : 'bg-teal-50 border-teal-200'}`}>
                                                                    <div className={`font-black text-[10px] uppercase tracking-widest mb-2 flex items-center gap-1 ${isExpired ? 'text-rose-600' : 'text-teal-600'}`}>
                                                                        {isExpired ? <Siren className="w-4 h-4 animate-pulse" /> : <Activity className="w-4 h-4" />}
                                                                        {isExpired ? "SLA Vencido" : "Resolución Activa"}
                                                                    </div>
                                                                    <span className={`font-bold text-lg leading-tight ${isExpired ? 'text-rose-900' : 'text-teal-900'}`}>{employeeName}</span>
                                                                </div>
                                                            );
                                                        }

                                                        // Action Block: Fast dispatch
                                                        return (
                                                            <div className="w-full flex flex-col items-center gap-2">
                                                                <button
                                                                    onClick={() => setDispatchingTicket(ticket)}
                                                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-5 rounded-[1.5rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 group"
                                                                >
                                                                    <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> Despachar (1-Click)
                                                                </button>
                                                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                                                    <InfoTooltip text="Asigna este ticket a un cuidador en piso. Zendi sugiere automáticamente al cuidador con menor carga de tareas activas." position="left" />
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[2rem] border-2 border-slate-100 border-dashed">
                                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                                        <CheckCircle2 className="w-10 h-10 text-teal-400" />
                                    </div>
                                    <h3 className="font-black text-slate-800 text-2xl">Bandeja Cero</h3>
                                    <p className="text-slate-500 font-medium mt-2">No existen métricas de crisis ni quejas pendientes.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* FILA 2 — 3 columnas iguales: En Piso | Brechas Handover | Feedback Cocina */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* COLUMNA 1 — En Piso + Zombis */}
                        <div className="flex flex-col gap-4">
                            {/* Alertas Administrativas Ocultas (Zombis) */}
                            {zombis.length > 0 && (
                                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border-2 border-rose-200 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500 rounded-full blur-[60px] opacity-10 pointer-events-none"></div>
                                    <h3 className="font-extrabold text-rose-700 text-xl mb-6 flex items-center gap-3 relative z-10">
                                        <Siren className="w-6 h-6 animate-pulse" /> Sesiones Sin Cerrar
                                    </h3>
                                    <div className="space-y-3 relative z-10">
                                        {zombis.map((s: CaregiverSession) => {
                                            const h = (nowTime - new Date(s.startTime).getTime()) / 3600000;
                                            return (
                                                <div key={s.id} className="bg-white border border-rose-200 p-4 rounded-[2rem] flex justify-between items-center shadow-sm">
                                                    <span className="font-bold text-slate-800 text-sm">{s.caregiver?.name}</span>
                                                    <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-wider">{h.toFixed(1)}h ABIERTA</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Plantilla Conectada */}
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 flex flex-col flex-1">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-extrabold text-slate-800 text-xl flex items-center gap-3">
                                        <Users className="w-6 h-6 text-teal-600" /> En Piso
                                        <InfoTooltip text="Sesiones activas del turno. Una sesión ZOMBIE (borde rojo) significa que un cuidador lleva más de 12 horas logueado sin cerrar su turno — requiere intervención del supervisor." />
                                    </h3>
                                    <span className="bg-slate-100 text-slate-500 font-black px-4 py-1.5 rounded-full shadow-inner">{enPiso.length}</span>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {(!liveData || enPiso.length === 0) ? (
                                        <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-[2rem]">
                                            <p className="text-slate-500 font-medium text-sm">Sin usuarios activos.</p>
                                        </div>
                                    ) : (
                                        enPiso.map((s: CaregiverSession) => {
                                            const hrs = (nowTime - new Date(s.startTime).getTime()) / 3600000;
                                            const tasks = liveData?.activeFastActions?.filter((fa: FastActionAssignment) => fa.caregiverId === s.caregiverId && fa.status === 'PENDING').length || 0;
                                            return (
                                                <div key={s.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-4 rounded-[1.5rem] hover:bg-white hover:border-slate-200 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 border border-teal-100 font-black flex items-center justify-center text-lg">
                                                            {s.caregiver?.name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{s.caregiver?.name}</p>
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{hrs.toFixed(1)} hrs logueado</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {tasks > 0 && (
                                                            <div className="bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">
                                                                {tasks}
                                                            </div>
                                                        )}
                                                        <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COLUMNA 2 — Brechas Handover */}
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 text-xl mb-6 flex items-center gap-3">
                                <AlertTriangle className="w-6 h-6 text-amber-500" /> Brechas Handovers
                                <InfoTooltip text="Turnos que terminaron sin que el cuidador firmara el cierre oficial. Cada brecha es un riesgo legal y clínico — el equipo entrante no tiene el traspaso documentado." />
                            </h3>
                            {(!liveData || missingHandovers.length === 0) ? (
                                <div className="bg-slate-50 p-6 rounded-[1.5rem] flex items-start gap-4 border border-slate-100">
                                    <CheckCircle2 className="w-8 h-8 text-teal-500 shrink-0" />
                                    <div>
                                        <p className="font-bold text-slate-700">Continuidad Aprobada</p>
                                        <p className="text-xs text-slate-500 mt-1">Cero turnos sin cerrar oficialmente.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {missingHandovers.map((mh: MissingHandover, i: number) => {
                                        const diffHrs = (nowTime - new Date(mh.endTime).getTime()) / 3600000;
                                        const isCritical = diffHrs > 2;
                                        return (
                                            <div key={i} className={`p-5 rounded-[1.5rem] border-l-[6px] shadow-sm relative overflow-hidden flex flex-col gap-2 ${isCritical ? 'bg-white border-l-rose-500 border-y border-r border-slate-200' : 'bg-white border-l-amber-400 border-y border-r border-slate-200'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`font-black text-[10px] uppercase tracking-widest ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>Falta Firma Legal</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md text-white ${isCritical ? 'bg-rose-600' : 'bg-amber-500'}`}>hace {diffHrs.toFixed(1)}h</span>
                                                </div>
                                                <p className="font-bold text-slate-800 text-lg">{mh.employeeName}</p>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg w-max">{mh.shiftType}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* COLUMNA 3 — Feedback de Cocina */}
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-6">
                                🍽 Feedback de Cocina
                            </h3>
                            <KitchenFeedbackWidget user={user} onSaved={fetchLiveData} />
                        </div>

                    </div>

                    {/* FILA 2.5 — Tareas Activas (Fast Actions SLA) */}
                    {(() => {
                        const pendingActions: FastActionAssignment[] = liveData?.activeFastActions?.filter((fa: FastActionAssignment) => fa.status === 'PENDING') || [];
                        const hasCritical = pendingActions.some((fa: FastActionAssignment) => {
                            const remaining = new Date(fa.expiresAt).getTime() - tickNow;
                            return remaining < 5 * 60 * 1000;
                        });

                        const getSlaColor = (expiresAt: string | Date) => {
                            const remaining = new Date(expiresAt).getTime() - tickNow;
                            if (remaining <= 0) return { bg: 'bg-rose-100 border-rose-300', text: 'text-rose-700', label: 'VENCIDO', pulse: true };
                            if (remaining < 5 * 60 * 1000) return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', label: formatCountdown(remaining), pulse: true };
                            if (remaining < 10 * 60 * 1000) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600', label: formatCountdown(remaining), pulse: false };
                            return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600', label: formatCountdown(remaining), pulse: false };
                        };

                        function formatCountdown(ms: number): string {
                            const totalSec = Math.max(0, Math.floor(ms / 1000));
                            const min = Math.floor(totalSec / 60);
                            const sec = totalSec % 60;
                            return `${min}:${sec.toString().padStart(2, '0')}`;
                        }

                        return (
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                        <Activity className="w-6 h-6 text-indigo-600" /> Tareas Activas
                                        <InfoTooltip text="Fast Actions con SLA de 15 minutos. Cada tarea asignada a un cuidador tiene un temporizador. Si se vence, se penaliza automáticamente el Score de Cumplimiento (-5 puntos)." />
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {hasCritical && (
                                            <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse flex items-center gap-1">
                                                <Siren className="w-3 h-3" /> SLA Crítico
                                            </span>
                                        )}
                                        <span className={`font-black px-4 py-1.5 rounded-full shadow-inner text-sm ${pendingActions.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {pendingActions.length}
                                        </span>
                                    </div>
                                </div>

                                {pendingActions.length === 0 ? (
                                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-4">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                                        <div>
                                            <p className="font-bold text-emerald-800">Sin tareas activas — turno en orden</p>
                                            <p className="text-xs text-emerald-600 mt-0.5">Todas las asignaciones han sido completadas o no hay pendientes.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {pendingActions.map((fa: FastActionAssignment) => {
                                            const sla = getSlaColor(fa.expiresAt);
                                            const caregiverName = (fa as any).caregiver?.name || 'Cuidador';
                                            const isUpdating = updatingTaskId === fa.id;
                                            return (
                                                <div key={fa.id} className={`flex items-center gap-4 p-4 rounded-[1.5rem] border-2 transition-all ${sla.bg}`}>
                                                    {/* Avatar */}
                                                    <div className="w-11 h-11 rounded-full bg-white border border-slate-200 text-slate-700 font-black flex items-center justify-center text-lg shrink-0 shadow-sm">
                                                        {caregiverName.charAt(0)}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-800 text-sm leading-tight">{caregiverName}</p>
                                                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{fa.description}</p>
                                                    </div>

                                                    {/* Countdown */}
                                                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-sm shrink-0 ${sla.text} ${sla.pulse ? 'animate-pulse' : ''}`}>
                                                        <Clock className="w-4 h-4" />
                                                        {sla.label}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => handleUpdateTaskStatus(fa.id, 'COMPLETED')}
                                                            disabled={isUpdating}
                                                            className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                                                            title="Completada"
                                                        >
                                                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateTaskStatus(fa.id, 'FAILED')}
                                                            disabled={isUpdating}
                                                            className="w-10 h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                                                            title="Fallida"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Historial colapsable */}
                                <button
                                    onClick={() => {
                                        setShowTaskHistory(!showTaskHistory);
                                        if (!showTaskHistory && taskHistory.length === 0) {
                                            // Fetch history: COMPLETED and FAILED from today
                                            const hqId = user?.hqId || user?.headquartersId || '';
                                            fetch(`/api/care/fast-actions?caregiverId=__ALL__&hqId=${hqId}&history=true`)
                                                .catch(() => {});
                                            // History comes from the already-expired tasks auto-failed in live data
                                            // For now, show a placeholder — real history would need a dedicated endpoint
                                        }
                                    }}
                                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest transition-colors"
                                >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showTaskHistory ? 'rotate-180' : ''}`} />
                                    {showTaskHistory ? 'Ocultar historial' : 'Ver historial del día'}
                                </button>

                                {showTaskHistory && (
                                    <div className="mt-2 bg-slate-50 rounded-[1.5rem] border border-slate-100 p-4">
                                        {(() => {
                                            // Show expired tasks from liveData (they would have been auto-failed)
                                            // The live endpoint only returns PENDING + not expired, so completed/failed aren't in liveData
                                            // Show a message that the history is based on the current session
                                            return (
                                                <div className="text-center py-4">
                                                    <p className="text-xs text-slate-500 font-medium">Las tareas completadas o fallidas durante este turno se reflejan automáticamente en el Score de Cumplimiento de cada cuidador.</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Historial detallado disponible en el módulo de RRHH → Evaluaciones.</p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* FILA 3 — Generador HR + Inspección Zonal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Zendi AI Writer */}
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    <Brain className="w-6 h-6 text-teal-600" /> Generador HR (IA)
                                </h3>
                                <button onClick={() => setIncidentModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all">
                                    <FileText className="w-4 h-4" />
                                    Reporte Disciplinario
                                </button>
                            </div>
                            <ZendiAssist
                                value={rawMemo}
                                onChange={setRawMemo}
                                type="SUPERVISOR_MEMO"
                                context="nota cruda de supervisor para memorándum RRHH"
                                placeholder="Dicta: El empleado ignoró un protocolo de limpieza..."
                                rows={3}
                            />
                            {processedMemo && (
                                <div className="mt-6 p-5 bg-slate-900 text-slate-500 rounded-[2rem] text-xs font-medium whitespace-pre-wrap shadow-inner cursor-pointer hover:bg-black transition-colors" onClick={copyToClipboard} title="Copiar al portapapeles">
                                    {processedMemo}
                                </div>
                            )}
                        </div>

                        {/* Inspección Zonal Estructurada */}
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-800">
                            <h3 className="text-xl font-black text-white flex items-center gap-3 mb-6">
                                <CalendarClock className="w-6 h-6 text-teal-400" /> Rondas de Inspección
                                <InfoTooltip text="3 rondas por turno. Cada zona se evalúa con 4 criterios: Limpieza, Seguridad, Residentes y Equipo. Queda en el log de auditoría con firma electrónica." />
                            </h3>

                            {/* Selector de Ronda */}
                            <div className="flex gap-2 mb-4">
                                {ROUND_TYPES.map(r => {
                                    const completedCount = todayInspections.filter(i => i.roundType === r.id).length;
                                    return (
                                        <button key={r.id} onClick={() => setSelectedRound(r.id)}
                                            className={`flex-1 py-3 rounded-2xl text-[10px] uppercase tracking-widest font-black transition-all border relative ${selectedRound === r.id ? 'bg-teal-500 border-teal-500 text-slate-900' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                            {r.id === 'INICIO' ? '🌅' : r.id === 'MEDIO' ? '☀️' : '🌙'} {r.id}
                                            <span className="block text-[8px] opacity-70 mt-0.5">{r.time}</span>
                                            {completedCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{completedCount}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selector de Piso */}
                            <div className="flex gap-2 mb-5">
                                {FLOORS.map(f => (
                                    <button key={f.floor} onClick={() => setSelectedFloor(f.floor)}
                                        className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${selectedFloor === f.floor ? 'bg-white text-slate-900 border-white' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                        Piso {f.floor} ({f.zones.length} zonas)
                                    </button>
                                ))}
                            </div>

                            {/* Checklist por Zona */}
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar mb-5">
                                {(FLOORS.find(f => f.floor === selectedFloor)?.zones || []).map(zoneName => {
                                    const key = `${selectedFloor}-${zoneName}`;
                                    const check = zoneChecks[key] || { limpieza: false, seguridad: false, residentes: false, equipo: false, observations: '' };
                                    const checkCount = [check.limpieza, check.seguridad, check.residentes, check.equipo].filter(Boolean).length;
                                    const alreadyDone = todayInspections.some(i => i.roundType === selectedRound && i.floor === selectedFloor && i.zoneName === zoneName);

                                    return (
                                        <div key={key} className={`p-4 rounded-2xl border transition-all ${alreadyDone ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-slate-800/50 border-slate-700/50'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-white flex items-center gap-2">
                                                    {alreadyDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                                    {zoneName}
                                                </span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${checkCount === 4 ? 'bg-emerald-500/20 text-emerald-400' : checkCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-500'}`}>
                                                    {checkCount}/4
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-1.5 mb-2">
                                                {(['limpieza', 'seguridad', 'residentes', 'equipo'] as const).map(field => (
                                                    <button key={field}
                                                        onClick={() => setZoneChecks(prev => ({ ...prev, [key]: { ...prev[key], [field]: !prev[key]?.[field] } }))}
                                                        className={`py-2 rounded-xl text-[9px] uppercase tracking-widest font-black transition-all border ${check[field] ? 'bg-teal-500 border-teal-500 text-slate-900' : 'bg-transparent border-slate-600 text-slate-500 hover:border-slate-400'}`}>
                                                        {field === 'limpieza' ? '🧹' : field === 'seguridad' ? '🛡️' : field === 'residentes' ? '👥' : '⚙️'} {field.slice(0, 4).toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                type="text"
                                                value={check.observations}
                                                onChange={(e) => setZoneChecks(prev => ({ ...prev, [key]: { ...prev[key], observations: e.target.value } }))}
                                                placeholder="Observaciones (opcional)"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Firma Electrónica */}
                            <button
                                onClick={handleSaveRound}
                                disabled={isSavingRound}
                                className="w-full bg-white hover:bg-slate-200 text-slate-900 font-bold py-4 rounded-[2rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isSavingRound ? <Loader2 className="w-5 h-5 animate-spin" /> : `Firmar Ronda ${selectedRound} — Piso ${selectedFloor}`}
                            </button>
                        </div>
                    </div>

                </div>

            </div>


            {toast && (
                <div 
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'}`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}

{/* SPRINT 3: DISPATCH INTELLIGENT MODAL */}
            {dispatchingTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <Send className="w-6 h-6 text-teal-600" />
                                Ruteo Táctico 1-Click
                            </h3>
                            <button onClick={() => setDispatchingTicket(null)} className="text-slate-500 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 w-10 h-10 rounded-full transition-colors active:scale-95 flex items-center justify-center text-lg font-bold">
                                ×
                            </button>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-5 rounded-[1.5rem] mb-6 shadow-inner">
                            <p className="font-bold text-slate-800 mb-1 leading-tight">{dispatchingTicket.title}</p>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">OBJETIVO: {dispatchingTicket.patientName}</p>
                        </div>

                        <h4 className="font-black text-slate-500 text-[10px] uppercase tracking-widest mb-3 flex items-center justify-between">
                            <span>Fuerza de Trabajo en Piso</span>
                            <span>Carga Actual</span>
                        </h4>
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 pb-2 custom-scrollbar">
                            {(() => {
                                const nowTime = new Date().getTime();
                                const validSessions = liveData?.activeSessions?.filter((s: CaregiverSession) => s.startTime && (nowTime - new Date(s.startTime).getTime()) / 3600000 < 12) || [];
                                
                                if (validSessions.length === 0) return (
                                    <div className="p-8 bg-rose-50 border border-rose-200 rounded-[1.5rem] text-center">
                                        <Siren className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                                        <p className="text-rose-800 font-bold mb-1">Piso Comprometido</p>
                                        <p className="text-xs text-rose-600">No hay cuidadores logueados para recibir este ruteo.</p>
                                    </div>
                                );
                                
                                let suggestedId = validSessions[0].caregiverId;
                                let minTasks = Infinity;
                                validSessions.forEach((s: CaregiverSession) => {
                                    const tasks = liveData?.activeFastActions?.filter((fa: FastActionAssignment) => fa.caregiverId === s.caregiverId && fa.status === 'PENDING').length || 0;
                                    if (tasks < minTasks) {
                                        minTasks = tasks;
                                        suggestedId = s.caregiverId;
                                    }
                                });

                                return validSessions.map((session: CaregiverSession) => {
                                    const tasksPending = liveData?.activeFastActions?.filter((fa: FastActionAssignment) => fa.caregiverId === session.caregiverId && fa.status === 'PENDING').length || 0;
                                    const isSuggested = session.caregiverId === suggestedId;
                                    return (
                                        <button 
                                            key={session.id} 
                                            onClick={() => handleDispatchTask(session.caregiverId)}
                                            disabled={isDispatching}
                                            className={`relative w-full flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all cursor-pointer ${isSuggested ? 'bg-teal-50 border-teal-400 hover:bg-teal-100 hover:shadow-md' : 'bg-white border-slate-100 hover:border-slate-300'} text-left disabled:opacity-50 disabled:cursor-wait active:scale-95 group`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${isSuggested ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                                                    {session.caregiver?.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className={`font-black leading-none mb-1.5 transition-colors ${isSuggested ? 'text-teal-900' : 'text-slate-800'}`}>{session.caregiver?.name}</p>
                                                    {isSuggested ? (
                                                        <span className="text-[9px] bg-white text-teal-700 font-black px-2 py-0.5 rounded-md flex items-center gap-1 w-max tracking-widest uppercase shadow-sm border border-teal-100">
                                                            <Sparkles className="w-3 h-3 text-amber-500" /> Zendi Sugiere Despacho
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">Lista / En Piso</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center bg-white shadow-sm border border-slate-100 w-14 py-2 rounded-[2rem]">
                                                <span className={`block font-black text-xl leading-none ${tasksPending >= 3 ? 'text-rose-600' : (tasksPending >= 2 ? 'text-amber-500' : 'text-slate-800')}`}>{tasksPending}</span>
                                                <span className="block text-[8px] uppercase tracking-widest text-slate-500 font-bold mt-0.5">Tareas</span>
                                            </div>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Reporte Disciplinario HR */}
            <WriteIncidentModal
                isOpen={incidentModalOpen}
                onClose={() => setIncidentModalOpen(false)}
                hqId={user?.hqId || user?.headquartersId || ''}
                supervisorId={user?.id || ''}
                employees={staff}
                onSuccess={() => {
                    setIncidentModalOpen(false);
                    setToast({ msg: 'Reporte disciplinario creado exitosamente.', type: 'ok' });
                }}
            />
        </div>
    );
}
