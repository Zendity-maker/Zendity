"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    CaregiverSession,
    TriageTicket,
    FastActionAssignment,
    LiveDataPayload,
    MissingHandover,
    VitalsFeedItem,
    VitalsByCaregiver,
    TeamScore,
    HandoverFeedItem,
    ObservationFeedItem,
    IncidentAppealItem,
} from "@/types/care";
import { useAuth } from "@/context/AuthContext";
import {
    Brain, Users, Loader2, Sparkles, Send, CheckCircle2, Activity, Droplets, Coffee,
    Siren, Play, Square, AlertTriangle, ShieldAlert, FileText, Clock, XCircle, ChevronDown,
    Heart, Pill, ClipboardSignature, MessageSquareWarning, Utensils, CalendarClock, ArrowRight,
    Gavel, AlertCircle, FileWarning,
} from "lucide-react";
import TaskAssignmentButton from "@/components/TaskAssignmentButton";
import ReactMarkdown from 'react-markdown';
import ZendiAssist from "@/components/ZendiAssist";
import InfoTooltip from "@/components/ui/InfoTooltip";
import WriteIncidentModal from "@/components/hr/WriteIncidentModal";
import ForceCloseShiftButton from "@/components/ForceCloseShiftButton";

// --- SUB-COMPONENT: Zendi Morning Briefing ---
const ZendiMorningBriefing = ({ text }: { text: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => { setIsMounted(true); }, []);

    if (!isMounted) return (
        <div className="bg-slate-900 rounded-[2rem] h-32 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-teal-500/50 animate-spin" />
        </div>
    );

    const handlePlayPause = async () => {
        if (isPlaying) {
            audioRef.current?.pause();
            audioRef.current = null;
            setIsPlaying(false);
            return;
        }
        setIsPlaying(true);
        try {
            const plainText = text
                .replace(/#{1,6}\s/g, '')
                .replace(/[*_]/g, '')
                .replace(/•/g, '')
                .replace(/—/g, ', ')
                .replace(/\n{2,}/g, '. ')
                .replace(/\n/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
            const res = await fetch("/api/zendi/speak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: plainText })
            });
            if (!res.ok) throw new Error("TTS failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => { setIsPlaying(false); audioRef.current = null; URL.revokeObjectURL(url); };
            audio.onerror = () => { setIsPlaying(false); audioRef.current = null; URL.revokeObjectURL(url); };
            await audio.play();
        } catch (err) {
            console.error("Zendi voice error:", err);
            audioRef.current = null;
            setIsPlaying(false);
        }
    };

    return (
        <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-widest mb-1">
                            <Sparkles className="w-4 h-4" /> Zendi AI Engine
                        </div>
                        <h2 className="text-2xl font-black text-white">Prólogo del Turno (05:45 AM)</h2>
                        <p className="text-slate-500 text-sm mt-1">Resumen ejecutivo del turno precedente y focos del día.</p>
                    </div>
                    <button onClick={handlePlayPause}
                        className={`flex items-center justify-center w-14 h-14 rounded-[1.25rem] shadow-lg transition-all active:scale-95 ${isPlaying ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse' : 'bg-slate-800 border-2 border-slate-700 hover:border-teal-500 text-white'}`}>
                        {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </button>
                </div>
                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-li:marker:text-teal-400 font-medium">
                    <ReactMarkdown>{text}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

const SHIFT_LABELS: Record<string, { es: string; window: string; icon: string }> = {
    MORNING: { es: 'Turno Diurno', window: '6:00 AM – 2:00 PM', icon: '☀️' },
    EVENING: { es: 'Turno Vespertino', window: '2:00 PM – 10:00 PM', icon: '🌆' },
    NIGHT: { es: 'Turno Nocturno', window: '10:00 PM – 6:00 AM', icon: '🌙' },
};

export default function SupervisorMissionControlPage() {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    const { user } = useAuth();
    const router = useRouter();
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
    const [rawMemo, setRawMemo] = useState("");
    const [processedMemo, setProcessedMemo] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const [liveData, setLiveData] = useState<LiveDataPayload | null>(null);

    const [dispatchingTicket, setDispatchingTicket] = useState<any>(null);
    const [isDispatching, setIsDispatching] = useState(false);
    const [incidentModalOpen, setIncidentModalOpen] = useState(false);

    // Fast Actions: countdown + update
    const [tickNow, setTickNow] = useState(Date.now());
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

    useEffect(() => {
        const tick = setInterval(() => setTickNow(Date.now()), 30000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        if (user) {
            fetchSupervisorData();
            fetchLiveData();
            const interval = setInterval(() => { fetchLiveData(); }, 15000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchLiveData = async () => {
        if (!user) return;
        const hqId = (user as any).hqId || (user as any).headquartersId || "hq-demo-1";
        try {
            const res = await fetch(`/api/care/supervisor/live?hqId=${hqId}`);
            const data = await res.json();
            if (data.success) setLiveData(data);
        } catch (e) { console.error("Live fetch error", e); }
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
                fetchLiveData();
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

    const handleDispatchTask = async (caregiverId: string) => {
        if (!dispatchingTicket || !user) return;
        setIsDispatching(true);
        try {
            const hqId = (user as any).hqId || (user as any).headquartersId || "hq-demo-1";
            const payload = {
                headquartersId: hqId,
                supervisorId: user.id,
                caregiverId,
                sourceType: dispatchingTicket.sourceType,
                sourceId: dispatchingTicket.sourceType === 'ZENDI_GROUP' ? dispatchingTicket.items.map((i: any) => i.id) : dispatchingTicket.sourceId,
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
            if (data.success) setProcessedMemo(data.formattedText);
        } catch (error) { console.error(error); }
        finally { setIsThinking(false); }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(processedMemo);
        setToast({ msg: "Memo copiado al portapapeles.", type: 'ok' });
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

    const currentShift = liveData?.currentShift || 'MORNING';
    const shiftMeta = SHIFT_LABELS[currentShift];

    const vitalsFeed = liveData?.vitalsFeed || [];
    const vitalsByCaregiver = liveData?.vitalsByCaregiver || [];
    const vitalsTotals = liveData?.vitalsTotals || { total: 0, pending: 0, completed: 0, expired: 0 };
    const medsProgress = liveData?.medsProgress;
    const teamScores = liveData?.teamScores || [];
    const handoversFeed = liveData?.handoversFeed || [];
    const observationsFeed = liveData?.observationsFeed || [];
    const incidentAppeals = liveData?.incidentAppeals || [];
    const roundsSummary = liveData?.roundsSummary;

    const pendingActions: FastActionAssignment[] = (liveData?.activeFastActions || []).filter(
        (fa: FastActionAssignment) => fa.status === 'PENDING'
    );

    const formatCountdown = (ms: number): string => {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const getSlaColor = (expiresAt: string | Date) => {
        const remaining = new Date(expiresAt).getTime() - tickNow;
        if (remaining <= 0) return { bg: 'bg-rose-100 border-rose-300', text: 'text-rose-700', label: 'VENCIDO', pulse: true };
        if (remaining < 5 * 60 * 1000) return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', label: formatCountdown(remaining), pulse: true };
        if (remaining < 10 * 60 * 1000) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600', label: formatCountdown(remaining), pulse: false };
        return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600', label: formatCountdown(remaining), pulse: false };
    };

    const scoreColor = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return 'text-slate-400';
        if (score >= 80) return 'text-emerald-600';
        if (score >= 60) return 'text-amber-600';
        return 'text-rose-600';
    };
    const scoreBg = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return 'bg-slate-100 border-slate-200';
        if (score >= 80) return 'bg-emerald-50 border-emerald-200';
        if (score >= 60) return 'bg-amber-50 border-amber-200';
        return 'bg-rose-50 border-rose-200';
    };

    return (
        <div className="min-h-screen bg-slate-100 p-6 md:p-8 font-sans">
            <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-6 pb-16">

                {/* ============================================== */}
                {/* SECCIÓN 1 — HUD SUPERIOR (Título + KPIs + Chips) */}
                {/* ============================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Header Mission Control */}
                    <div className="lg:col-span-5 bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-xl flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h1 className="text-3xl lg:text-4xl font-black text-white mb-2 flex items-center gap-3">
                                <ShieldAlert className="w-8 h-8 text-teal-400" />
                                Mission Control
                            </h1>
                            <p className="text-slate-500 font-medium text-sm md:text-base mb-4">
                                Despacho clínico, cumplimiento y continuidad en tiempo real.
                            </p>
                            <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4 mb-5">
                                <div className="flex items-center gap-2 text-teal-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                                    <Clock className="w-3.5 h-3.5" /> Turno Activo
                                </div>
                                <p className="text-white font-black text-lg">{shiftMeta.icon} {shiftMeta.es}</p>
                                <p className="text-slate-500 text-xs font-bold mt-0.5">{shiftMeta.window} · Hora de Puerto Rico</p>
                            </div>
                            <TaskAssignmentButton user={user} buttonLabel="Asignar Meta Libre (15m)" buttonStyle="bg-teal-500 hover:bg-teal-400 text-slate-900 font-black px-6 py-4 rounded-[1.5rem] shadow-lg active:scale-95 transition-all text-sm w-max" />
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                            <Users className="w-8 h-8 text-teal-600 mb-3" />
                            <p className="text-4xl font-black text-slate-800 leading-none">{liveData ? liveData.activeCaregivers : "-"}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1">
                                En Piso <InfoTooltip text="Cuidadores con sesión activa en este momento." />
                            </p>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                            <Droplets className="w-8 h-8 text-slate-500 mb-3" />
                            <p className="text-4xl font-black text-slate-800 leading-none">{liveData ? liveData.liveStats.baths : "-"}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Baños</p>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                            <Coffee className="w-8 h-8 text-slate-500 mb-3" />
                            <p className="text-4xl font-black text-slate-800 leading-none">
                                {liveData ? Object.values(liveData.liveStats.meals).reduce((a: any, b: any) => a + b, 0) : "-"}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Dietas</p>
                        </div>
                        <div className={`rounded-[2rem] p-6 shadow-sm border flex flex-col items-center justify-center text-center ${liveData && liveData.liveStats.incidents > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
                            <Siren className={`w-8 h-8 mb-3 ${liveData && liveData.liveStats.incidents > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
                            <p className={`text-4xl font-black leading-none ${liveData && liveData.liveStats.incidents > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                                {liveData ? liveData.liveStats.incidents : "-"}
                            </p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${liveData && liveData.liveStats.incidents > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                Incidentes
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick-access chips (kitchen + rondas) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/care/supervisor/kitchen" className="bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                            <Utensils className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-sm">Feedback de Cocina</p>
                            <p className="text-xs text-slate-500 font-medium">Observaciones de servicio y satisfacción</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
                    </Link>
                    <Link href="/care/supervisor/rounds" className="bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                            <CalendarClock className="w-6 h-6 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-sm">Rondas de Inspección</p>
                            <p className="text-xs text-slate-500 font-medium">
                                {roundsSummary
                                    ? `${roundsSummary.completedSlots}/${roundsSummary.totalSlots} rondas iniciadas hoy`
                                    : 'Checklist de 3 rondas por turno'}
                            </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
                    </Link>
                </div>

                {/* Panel de Ausencias */}
                {progMissing && progMissing.length > 0 && (
                    <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <h3 className="text-white font-black text-sm uppercase tracking-widest">
                                Personal No Presentado
                            </h3>
                            <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{progMissing.length}</span>
                        </div>
                        <div className="space-y-2">
                            {progMissing.map((emp: any) => {
                                const empName = emp.employee?.name || emp.name || 'Empleado';
                                return (
                                    <div key={emp.id} className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3 border border-red-500/20">
                                        <span className="text-white font-bold text-sm">{empName}</span>
                                        <span className="text-red-400 text-xs font-medium">Turno activo sin sesión</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Zombis — Sesiones sin cerrar */}
                {zombis.length > 0 && (
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border-2 border-rose-200">
                        <h3 className="font-black text-rose-700 text-lg mb-4 flex items-center gap-3">
                            <Siren className="w-5 h-5 animate-pulse" /> Sesiones Sin Cerrar ({zombis.length})
                        </h3>
                        <div className="space-y-3">
                            {zombis.map((s: CaregiverSession) => {
                                const h = (nowTime - new Date(s.startTime).getTime()) / 3600000;
                                return (
                                    <div key={s.id} className="bg-white border border-rose-200 p-4 rounded-[1.5rem] flex flex-wrap justify-between items-center gap-3 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-slate-800 text-sm">{s.caregiver?.name}</span>
                                            <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full uppercase">{h.toFixed(1)}h ABIERTA</span>
                                        </div>
                                        <ForceCloseShiftButton
                                            shiftSessionId={s.id}
                                            caregiverName={s.caregiver?.name || 'Cuidador'}
                                            hoursOpen={h}
                                            variant="zombie"
                                            onClosed={fetchLiveData}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Zendi Briefing */}
                {liveData?.morningBriefing ? (
                    <ZendiMorningBriefing text={liveData.morningBriefing} />
                ) : liveData ? (
                    <div className="bg-slate-800 rounded-[2rem] p-5 shadow-xl border border-slate-700 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-slate-700 flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 text-teal-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                                <Sparkles className="w-3.5 h-3.5" /> Zendi AI Engine
                            </div>
                            <p className="text-slate-300 font-semibold text-sm">El briefing de Zendi estará disponible a las 5:45 AM.</p>
                            <p className="text-slate-500 text-xs font-medium mt-1">
                                {liveData.lastBriefingAt
                                    ? `Última actualización: ${new Date(liveData.lastBriefingAt).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                                    : 'Aún no se ha generado un briefing para esta sede.'}
                            </p>
                        </div>
                    </div>
                ) : null}

                {/* ============================================== */}
                {/* SECCIÓN 2 — INBOX OPERATIVO (Triage Feed)        */}
                {/* ============================================== */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200/60 min-h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 flex-wrap gap-3">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <Activity className="w-7 h-7 text-teal-600" /> Inbox Operativo
                                <InfoTooltip text="Tickets clínicos ordenados por urgencia: INMINENTE (rojo), ATENCIÓN (ámbar), RUTINA (gris)." />
                            </h2>
                            <p className="text-slate-500 font-medium text-sm mt-1">Tickets clínicos, preventivos y reportes familiares en espera.</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="bg-white border text-rose-800 border-rose-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                Inminente ({liveData?.triageFeed?.filter((t: TriageTicket) => t.urgency === 'INMINENTE').length || 0})
                            </span>
                            <span className="bg-white border text-amber-800 border-amber-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                Atención ({liveData?.triageFeed?.filter((t: TriageTicket) => t.urgency === 'ATENCION').length || 0})
                            </span>
                        </div>
                    </div>

                    {!liveData ? (
                        <div className="flex-1 flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-slate-500" /></div>
                    ) : liveData.triageFeed?.length > 0 ? (
                        <div className="space-y-3">
                            {[...liveData.triageFeed].sort((a, b) => {
                                const rank = { INMINENTE: 3, ATENCION: 2, RUTINA: 1 };
                                return (rank[b.urgency as keyof typeof rank] || 0) - (rank[a.urgency as keyof typeof rank] || 0);
                            }).slice(0, 8).map((ticket: TriageTicket) => {
                                const isCrisis = ticket.urgency === 'INMINENTE';
                                const isAttention = ticket.urgency === 'ATENCION';
                                const cardBorderLayout = isCrisis ? 'border-l-[8px] border-l-rose-500' : isAttention ? 'border-l-[8px] border-l-amber-400' : 'border-l-[8px] border-l-slate-300';
                                const pillColor = isCrisis ? 'bg-rose-100 text-rose-800' : isAttention ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
                                return (
                                    <div key={ticket.id} className={`rounded-[1.5rem] p-5 bg-white border-y border-r border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-start lg:items-center ${cardBorderLayout}`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${pillColor}`}>{ticket.urgency}</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100">
                                                    {ticket.category.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold text-slate-800 leading-tight mb-1">{ticket.title}</h3>
                                            <p className="text-xs font-semibold text-slate-500 mb-2">
                                                Sujeto: <span className="text-slate-800 ml-1">{ticket.patientName}</span>
                                            </p>
                                            <p className="text-sm font-medium text-slate-600 line-clamp-2">{ticket.description}</p>
                                        </div>
                                        <div className="w-full lg:w-48 shrink-0">
                                            {(() => {
                                                const assignedTask = liveData.activeFastActions?.find((fa: FastActionAssignment) => fa.description.startsWith(`[${ticket.id}]`));
                                                if (assignedTask) {
                                                    const caregiverMatch = liveData.activeSessions?.find((s: CaregiverSession) => s.caregiverId === assignedTask.caregiverId);
                                                    const employeeName = caregiverMatch?.caregiver?.name || "Cuidador";
                                                    const isExpired = new Date(assignedTask.expiresAt).getTime() < new Date().getTime();
                                                    return (
                                                        <div className={`p-3 rounded-[1.25rem] border-2 text-center ${isExpired ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-teal-50 border-teal-200 text-teal-700'}`}>
                                                            <p className="font-black text-[10px] uppercase tracking-widest mb-1">{isExpired ? 'SLA Vencido' : 'En Resolución'}</p>
                                                            <p className="font-bold text-sm leading-tight">{employeeName}</p>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <button onClick={() => setDispatchingTicket(ticket)}
                                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-[1.25rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
                                                        <Send className="w-4 h-4" /> Despachar
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                            {liveData.triageFeed.length > 8 && (
                                <p className="text-xs text-slate-400 font-bold text-center pt-2">
                                    + {liveData.triageFeed.length - 8} tickets adicionales
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 bg-slate-50 rounded-[2rem] border-2 border-slate-100 border-dashed">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <CheckCircle2 className="w-8 h-8 text-teal-400" />
                            </div>
                            <h3 className="font-black text-slate-800 text-xl">Bandeja Cero</h3>
                            <p className="text-slate-500 font-medium mt-1 text-sm">No existen métricas de crisis ni quejas pendientes.</p>
                        </div>
                    )}
                </div>

                {/* ============================================== */}
                {/* SECCIÓN 3 — EN PISO + SCORE CUMPLIMIENTO         */}
                {/* ============================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* En Piso */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <Users className="w-6 h-6 text-teal-600" /> En Piso
                                <InfoTooltip text="Sesiones activas del turno. Cada cuidador muestra horas logueadas y tareas pendientes." />
                            </h3>
                            <span className="bg-slate-100 text-slate-500 font-black px-3 py-1.5 rounded-full text-sm">{enPiso.length}</span>
                        </div>
                        <div className="space-y-3">
                            {enPiso.length === 0 ? (
                                <div className="p-6 text-center bg-slate-50 border border-slate-100 rounded-[1.5rem]">
                                    <p className="text-slate-500 font-medium text-sm">Sin usuarios activos.</p>
                                </div>
                            ) : (
                                enPiso.map((s: CaregiverSession) => {
                                    const hrs = (nowTime - new Date(s.startTime).getTime()) / 3600000;
                                    const tasks = liveData?.activeFastActions?.filter((fa: FastActionAssignment) => fa.caregiverId === s.caregiverId && fa.status === 'PENDING').length || 0;
                                    return (
                                        <div key={s.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-4 rounded-[1.25rem]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-full bg-teal-50 text-teal-700 border border-teal-100 font-black flex items-center justify-center text-lg">
                                                    {s.caregiver?.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{s.caregiver?.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{hrs.toFixed(1)} hrs logueado</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {tasks > 0 && (
                                                    <div className="bg-slate-200 text-slate-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black">{tasks}</div>
                                                )}
                                                <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
                                                <ForceCloseShiftButton
                                                    shiftSessionId={s.id}
                                                    caregiverName={s.caregiver?.name || 'Cuidador'}
                                                    hoursOpen={hrs}
                                                    variant="active"
                                                    onClosed={fetchLiveData}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Score de Cumplimiento */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <ShieldAlert className="w-6 h-6 text-indigo-600" /> Score Cumplimiento
                                <InfoTooltip text="Compliance Score actual de cada cuidador activo. Baja -2 pts cuando expira una ventana de vitales sin tomarlos, -5 pts por Fast Action vencida. Sube al completar entrenamientos Academy." />
                            </h3>
                            <span className="bg-indigo-100 text-indigo-700 font-black px-3 py-1.5 rounded-full text-sm">{teamScores.length}</span>
                        </div>
                        <div className="space-y-3">
                            {teamScores.length === 0 ? (
                                <div className="p-6 text-center bg-slate-50 border border-slate-100 rounded-[1.5rem]">
                                    <p className="text-slate-500 font-medium text-sm">Sin cuidadores activos.</p>
                                </div>
                            ) : (
                                teamScores.map((ts: TeamScore) => {
                                    const score = ts.complianceScore;
                                    return (
                                        <div key={ts.caregiverId} className={`border rounded-[1.25rem] p-4 ${scoreBg(score)}`}>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-slate-800 text-sm truncate">{ts.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{ts.role}</p>
                                                </div>
                                                <div className={`font-black text-2xl leading-none ${scoreColor(score)}`}>
                                                    {score ?? '—'}<span className="text-xs">/100</span>
                                                </div>
                                            </div>
                                            {score !== null && score !== undefined && (
                                                <div className="mt-2 w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* ============================================== */}
                {/* SECCIÓN 4 — VITALES DE ENTRADA + MEDS DEL TURNO  */}
                {/* ============================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vitales de Entrada 4h */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <Heart className="w-6 h-6 text-rose-500" /> Vitales de Entrada (4h)
                                <InfoTooltip text="Ventana automática de 4 horas al inicio del turno. Cada cuidador debe tomar vitales a sus residentes asignados. Penalidad -2 pts por ventana expirada sin vitales." />
                            </h3>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                                <p className="text-xl font-black text-slate-800 leading-none">{vitalsTotals.total}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                <p className="text-xl font-black text-amber-700 leading-none">{vitalsTotals.pending}</p>
                                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1">Pendientes</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                <p className="text-xl font-black text-emerald-700 leading-none">{vitalsTotals.completed}</p>
                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Tomados</p>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                                <p className="text-xl font-black text-rose-700 leading-none">{vitalsTotals.expired}</p>
                                <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mt-1">Vencidos</p>
                            </div>
                        </div>
                        {vitalsByCaregiver.length === 0 ? (
                            <div className="p-6 text-center bg-slate-50 border border-slate-100 rounded-[1.5rem]">
                                <p className="text-slate-500 font-medium text-sm">Sin ventanas de vitales hoy.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {vitalsByCaregiver.map((vb: VitalsByCaregiver) => {
                                    const totalCg = vb.pending + vb.completedOnTime + vb.completedLate + vb.expired;
                                    const doneCg = vb.completedOnTime + vb.completedLate;
                                    const pct = totalCg > 0 ? Math.round((doneCg / totalCg) * 100) : 0;
                                    return (
                                        <div key={vb.caregiverId || 'unassigned'} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-slate-800 text-sm truncate">{vb.caregiverName}</span>
                                                <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{doneCg}/{totalCg}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold">
                                                {vb.pending > 0 && <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{vb.pending} pend</span>}
                                                {vb.completedOnTime > 0 && <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{vb.completedOnTime} ok</span>}
                                                {vb.completedLate > 0 && <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{vb.completedLate} tarde</span>}
                                                {vb.expired > 0 && <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">{vb.expired} venc</span>}
                                            </div>
                                            <div className="mt-2 w-full h-1 bg-white rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Meds del Turno */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <Pill className="w-6 h-6 text-fuchsia-600" /> Meds del Turno
                                <InfoTooltip text={`Porcentaje de medicamentos administrados en el turno actual (${shiftMeta.es}, ${shiftMeta.window}). Incluye solo slots programados cuya hora cae dentro del turno.`} />
                            </h3>
                            <span className="text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                {shiftMeta.icon} {currentShift}
                            </span>
                        </div>
                        {medsProgress ? (
                            <div className="space-y-5">
                                <div className="flex items-end gap-3">
                                    <p className={`text-6xl font-black leading-none ${medsProgress.pct === null ? 'text-slate-400' : medsProgress.pct >= 90 ? 'text-emerald-600' : medsProgress.pct >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                                        {medsProgress.pct !== null ? `${medsProgress.pct}%` : '—'}
                                    </p>
                                    <p className="text-sm text-slate-500 font-bold mb-2">
                                        {medsProgress.completed} / {medsProgress.total} administrados
                                    </p>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${medsProgress.pct === null ? 'bg-slate-300' : medsProgress.pct >= 90 ? 'bg-emerald-500' : medsProgress.pct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        style={{ width: `${medsProgress.pct ?? 0}%` }}
                                    />
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                        Denominador: slots programados de <span className="font-bold text-slate-700">{shiftMeta.window}</span> para residentes ACTIVE.
                                        {medsProgress.total === 0 && ' Sin meds programados en este turno.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                        )}
                    </div>
                </div>

                {/* ============================================== */}
                {/* SECCIÓN 5 — HANDOVERS HOY (Firmados + Brechas)   */}
                {/* ============================================== */}
                <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                        <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                            <ClipboardSignature className="w-6 h-6 text-teal-600" /> Handovers Hoy
                            <InfoTooltip text="Traspasos de turno firmados en el día + brechas (turnos cerrados sin handover). Cada handover tiene firma del saliente, confirmación senior y firma del supervisor." />
                        </h3>
                        <div className="flex gap-2">
                            {missingHandovers.length > 0 && (
                                <span className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> {missingHandovers.length} brecha{missingHandovers.length > 1 ? 's' : ''}
                                </span>
                            )}
                            <span className="bg-teal-50 border border-teal-200 text-teal-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                {handoversFeed.length} firmado{handoversFeed.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>

                    {/* Brechas */}
                    {missingHandovers.length > 0 && (
                        <div className="mb-5 space-y-2">
                            {missingHandovers.map((mh: MissingHandover, i: number) => {
                                const diffHrs = (nowTime - new Date(mh.endTime).getTime()) / 3600000;
                                const isCritical = diffHrs > 2;
                                return (
                                    <div key={i} className={`p-4 rounded-[1.25rem] border-l-[6px] flex flex-wrap items-center justify-between gap-3 ${isCritical ? 'bg-rose-50 border-l-rose-500 border-y border-r border-rose-200' : 'bg-amber-50 border-l-amber-400 border-y border-r border-amber-200'}`}>
                                        <div>
                                            <span className={`font-black text-[10px] uppercase tracking-widest ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>Falta firma legal</span>
                                            <p className="font-bold text-slate-800 text-base">{mh.employeeName}</p>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">{mh.shiftType}</p>
                                        </div>
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md text-white ${isCritical ? 'bg-rose-600' : 'bg-amber-500'}`}>hace {diffHrs.toFixed(1)}h</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Reportes individuales del día (Sprint L) */}
                    {handoversFeed.length === 0 && missingHandovers.length === 0 ? (
                        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[1.5rem] flex items-center gap-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                            <div>
                                <p className="font-bold text-emerald-800">Sin reportes de turno todavía</p>
                                <p className="text-xs text-emerald-600 mt-0.5">Cada cuidadora firma su reporte individual al cerrar turno.</p>
                            </div>
                        </div>
                    ) : handoversFeed.length > 0 ? (
                        <div className="space-y-3">
                            {handoversFeed.map((h: HandoverFeedItem) => {
                                const time = new Date(h.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
                                const statusConfig = h.derivedStatus === 'SUPERVISOR_SIGNED'
                                    ? { bg: 'bg-emerald-50', border: 'border-emerald-200', pill: 'bg-emerald-200 text-emerald-800', label: 'Firmado por supervisor' }
                                    : h.derivedStatus === 'CONFIRMED'
                                    ? { bg: 'bg-amber-50', border: 'border-amber-200', pill: 'bg-amber-200 text-amber-800', label: 'Pendiente firma supervisor' }
                                    : { bg: 'bg-rose-50', border: 'border-rose-200', pill: 'bg-rose-200 text-rose-800', label: 'Pendiente confirmación' };

                                const COLOR_BADGES: Record<string, string> = {
                                    RED: 'bg-rose-500 text-white',
                                    YELLOW: 'bg-amber-400 text-slate-900',
                                    GREEN: 'bg-emerald-500 text-white',
                                    BLUE: 'bg-sky-500 text-white',
                                };

                                return (
                                    <div key={h.id} className={`p-4 rounded-[1.5rem] border ${statusConfig.bg} ${statusConfig.border}`}>
                                        <div className="flex items-start gap-4">
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-black text-sm bg-white border border-slate-200">
                                                {h.shiftType === 'MORNING' ? '☀️' : h.shiftType === 'EVENING' ? '🌆' : '🌙'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md uppercase tracking-widest">{h.shiftType}</span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${statusConfig.pill}`}>
                                                        {statusConfig.label}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-bold">{time}</span>
                                                </div>

                                                <p className="text-sm text-slate-800 font-bold mb-1">
                                                    {h.outgoingName || <em className="text-slate-400">Zendi AI</em>}
                                                </p>

                                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                                    <div className="flex items-center gap-1">
                                                        {h.colorGroups.length > 0 ? h.colorGroups.map(c => (
                                                            <span key={c} className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${COLOR_BADGES[c] || 'bg-slate-300 text-slate-800'}`}>
                                                                {c}
                                                            </span>
                                                        )) : (
                                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-200 text-slate-600">sin color</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-slate-600 font-bold">
                                                        {h.patientCount} residente{h.patientCount !== 1 ? 's' : ''}
                                                    </span>
                                                </div>

                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    {h.signedOutAt && <span>✓ Firmó · </span>}
                                                    {h.seniorConfirmedAt && <span>✓ Confirmado · </span>}
                                                    {h.supervisorSignedAt && <span className="font-bold text-emerald-700">✓ Supervisor</span>}
                                                </p>
                                            </div>

                                            {h.derivedStatus !== 'SUPERVISOR_SIGNED' && (
                                                <button
                                                    onClick={() => router.push(`/care/reports/${h.id}`)}
                                                    className="shrink-0 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 self-start"
                                                >
                                                    Revisar y Firmar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>

                {/* ============================================== */}
                {/* SECCIÓN 6 — OBSERVACIONES + APELACIONES          */}
                {/* ============================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Observaciones de Personal */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <MessageSquareWarning className="w-6 h-6 text-amber-600" /> Observaciones de Personal
                                <InfoTooltip text="Reportes tipo OBSERVATION (Sprint C) de los últimos 7 días en estados activos. No son disciplinarios — registran conducta para análisis y acompañamiento." />
                            </h3>
                            <span className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">{observationsFeed.length}</span>
                        </div>
                        {observationsFeed.length === 0 ? (
                            <div className="p-6 text-center bg-slate-50 border border-slate-100 rounded-[1.5rem]">
                                <p className="text-slate-500 font-medium text-sm">Sin observaciones activas (7 días).</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {observationsFeed.slice(0, 12).map((ob: ObservationFeedItem) => {
                                    const date = new Date(ob.createdAt).toLocaleDateString('es-PR', { day: 'numeric', month: 'short' });
                                    return (
                                        <div key={ob.id} className="bg-white border-l-[5px] border-l-amber-400 border-y border-r border-slate-200 rounded-xl p-3 shadow-sm">
                                            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                                                <span className="font-bold text-slate-800 text-sm truncate">{ob.employeeName}</span>
                                                <span className="text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md uppercase">{ob.category}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 font-medium line-clamp-2 mb-1">{ob.description}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400 font-bold">{ob.supervisorName} · {date}</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${ob.status === 'EXPLANATION_RECEIVED' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {ob.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Apelaciones Activas */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <Gavel className="w-6 h-6 text-rose-600" /> Apelaciones Activas
                                <InfoTooltip text="Reportes disciplinarios (WARNING/SUSPENSION/TERMINATION) con apelación recibida o respuesta del empleado pendiente de revisión." />
                            </h3>
                            <span className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">{incidentAppeals.length}</span>
                        </div>
                        {incidentAppeals.length === 0 ? (
                            <div className="p-6 text-center bg-slate-50 border border-slate-100 rounded-[1.5rem]">
                                <p className="text-slate-500 font-medium text-sm">Sin apelaciones pendientes.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {incidentAppeals.map((ap: IncidentAppealItem) => {
                                    const date = new Date(ap.createdAt).toLocaleDateString('es-PR', { day: 'numeric', month: 'short' });
                                    return (
                                        <div key={ap.id} className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                                                <span className="font-bold text-slate-800 text-sm truncate">{ap.employeeName}</span>
                                                <span className="text-[10px] font-black text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-md uppercase">{ap.severity}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 font-medium line-clamp-2 mb-1">{ap.description}</p>
                                            {ap.appealText && (
                                                <div className="bg-white border border-rose-100 rounded-md p-2 mt-2">
                                                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-0.5">Texto apelación</p>
                                                    <p className="text-xs text-slate-700 font-medium line-clamp-2">"{ap.appealText}"</p>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mt-2 gap-2">
                                                <span className="text-[10px] text-slate-500 font-bold">{date}</span>
                                                <button
                                                    onClick={() => router.push(`/hr/incidents/${ap.id}`)}
                                                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all active:scale-95"
                                                >
                                                    Resolver apelación <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ============================================== */}
                {/* SECCIÓN 7 — TAREAS ACTIVAS + GENERADOR HR        */}
                {/* ============================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tareas Activas */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <Activity className="w-6 h-6 text-indigo-600" /> Tareas Activas
                                <InfoTooltip text="Fast Actions con SLA de 15 minutos. Si vence, se penaliza automáticamente el Score (-5 puntos)." />
                            </h3>
                            <span className={`font-black px-3 py-1.5 rounded-full text-sm ${pendingActions.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {pendingActions.length}
                            </span>
                        </div>
                        {pendingActions.length === 0 ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-[1.5rem] flex items-center gap-3">
                                <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />
                                <div>
                                    <p className="font-bold text-emerald-800 text-sm">Turno en orden</p>
                                    <p className="text-xs text-emerald-600 mt-0.5">Todas las asignaciones completadas.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {pendingActions.map((fa: FastActionAssignment) => {
                                    const sla = getSlaColor(fa.expiresAt);
                                    const caregiverName = (fa as any).caregiver?.name || 'Cuidador';
                                    const isUpdating = updatingTaskId === fa.id;
                                    return (
                                        <div key={fa.id} className={`flex items-center gap-3 p-3 rounded-[1.25rem] border-2 ${sla.bg}`}>
                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 font-black flex items-center justify-center text-sm shrink-0 shadow-sm">
                                                {caregiverName.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 text-xs leading-tight">{caregiverName}</p>
                                                <p className="text-[11px] text-slate-600 line-clamp-1">{fa.description}</p>
                                            </div>
                                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-black text-xs shrink-0 ${sla.text} ${sla.pulse ? 'animate-pulse' : ''}`}>
                                                <Clock className="w-3 h-3" />
                                                {sla.label}
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleUpdateTaskStatus(fa.id, 'COMPLETED')}
                                                    disabled={isUpdating}
                                                    className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center active:scale-95 disabled:opacity-50"
                                                    title="Completada"
                                                >
                                                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateTaskStatus(fa.id, 'FAILED')}
                                                    disabled={isUpdating}
                                                    className="w-8 h-8 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center active:scale-95 disabled:opacity-50"
                                                    title="Fallida"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Observaciones de Personal */}
                    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <Brain className="w-6 h-6 text-teal-600" /> Observaciones de Personal
                            </h3>
                            <button onClick={() => setIncidentModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-3 bg-[#1F2D3A] hover:bg-[#0F6B78] text-white rounded-xl text-sm font-medium transition">
                                <FileWarning className="w-4 h-4" /> Nueva Observación
                            </button>
                        </div>
                        <ZendiAssist
                            value={rawMemo}
                            onChange={setRawMemo}
                            type="SUPERVISOR_MEMO"
                            context="nota cruda de supervisor para memorándum RRHH"
                            placeholder="Describe la situación observada o usa Zendi para redactar..."
                            rows={3}
                        />
                        {processedMemo && (
                            <div className="mt-5 p-4 bg-slate-900 text-slate-300 rounded-[1.5rem] text-xs font-medium whitespace-pre-wrap shadow-inner cursor-pointer hover:bg-black transition-colors" onClick={copyToClipboard} title="Copiar al portapapeles">
                                {processedMemo}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* TOAST */}
            {toast && (
                <div
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-[2rem] shadow-xl font-bold text-sm cursor-pointer ${toast.type === 'ok' ? 'bg-teal-900 text-teal-100' : 'bg-rose-900 text-rose-100'}`}
                    onClick={() => setToast(null)}
                >
                    {toast.msg}
                </div>
            )}

            {/* DISPATCH MODAL */}
            {dispatchingTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <Send className="w-6 h-6 text-teal-600" /> Ruteo Táctico 1-Click
                            </h3>
                            <button onClick={() => setDispatchingTicket(null)} className="text-slate-500 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold">×</button>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 p-5 rounded-[1.5rem] mb-6 shadow-inner">
                            <p className="font-bold text-slate-800 mb-1 leading-tight">{dispatchingTicket.title}</p>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">OBJETIVO: {dispatchingTicket.patientName}</p>
                        </div>
                        <h4 className="font-black text-slate-500 text-[10px] uppercase tracking-widest mb-3 flex items-center justify-between">
                            <span>Fuerza de Trabajo en Piso</span>
                            <span>Carga Actual</span>
                        </h4>
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 pb-2">
                            {(() => {
                                const validSessions = liveData?.activeSessions?.filter((s: CaregiverSession) => s.startTime && (nowTime - new Date(s.startTime).getTime()) / 3600000 < 12) || [];
                                if (validSessions.length === 0) return (
                                    <div className="p-8 bg-rose-50 border border-rose-200 rounded-[1.5rem] text-center">
                                        <Siren className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                                        <p className="text-rose-800 font-bold mb-1">Piso Comprometido</p>
                                        <p className="text-xs text-rose-600">No hay cuidadores logueados.</p>
                                    </div>
                                );
                                let suggestedId = validSessions[0].caregiverId;
                                let minTasks = Infinity;
                                validSessions.forEach((s: CaregiverSession) => {
                                    const tasks = liveData?.activeFastActions?.filter((fa: FastActionAssignment) => fa.caregiverId === s.caregiverId && fa.status === 'PENDING').length || 0;
                                    if (tasks < minTasks) { minTasks = tasks; suggestedId = s.caregiverId; }
                                });
                                return validSessions.map((session: CaregiverSession) => {
                                    const tasksPending = liveData?.activeFastActions?.filter((fa: FastActionAssignment) => fa.caregiverId === session.caregiverId && fa.status === 'PENDING').length || 0;
                                    const isSuggested = session.caregiverId === suggestedId;
                                    return (
                                        <button
                                            key={session.id}
                                            onClick={() => handleDispatchTask(session.caregiverId)}
                                            disabled={isDispatching}
                                            className={`relative w-full flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all cursor-pointer ${isSuggested ? 'bg-teal-50 border-teal-400 hover:bg-teal-100' : 'bg-white border-slate-100 hover:border-slate-300'} text-left disabled:opacity-50 disabled:cursor-wait active:scale-95 group`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${isSuggested ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                    {session.caregiver?.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className={`font-black leading-none mb-1.5 ${isSuggested ? 'text-teal-900' : 'text-slate-800'}`}>{session.caregiver?.name}</p>
                                                    {isSuggested ? (
                                                        <span className="text-[9px] bg-white text-teal-700 font-black px-2 py-0.5 rounded-md flex items-center gap-1 w-max tracking-widest uppercase border border-teal-100">
                                                            <Sparkles className="w-3 h-3 text-amber-500" /> Zendi Sugiere
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">En Piso</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center bg-white shadow-sm border border-slate-100 w-14 py-2 rounded-[1.5rem]">
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

            {/* INCIDENT MODAL */}
            <WriteIncidentModal
                isOpen={incidentModalOpen}
                onClose={() => setIncidentModalOpen(false)}
                hqId={(user as any)?.hqId || (user as any)?.headquartersId || ''}
                supervisorId={user?.id || ''}
                employees={staff}
                onSuccess={() => {
                    setIncidentModalOpen(false);
                    setToast({ msg: 'Reporte disciplinario creado exitosamente.', type: 'ok' });
                    fetchLiveData();
                }}
            />
        </div>
    );
}
