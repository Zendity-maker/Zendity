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
    InboxHistoryItem,
} from "@/types/care";
import { useAuth } from "@/context/AuthContext";
import {
    Brain, Users, Loader2, Sparkles, Send, CheckCircle2, Activity, Droplets, Coffee,
    Siren, Play, Square, AlertTriangle, ShieldAlert, FileText, Clock, XCircle, ChevronDown,
    Heart, Pill, ClipboardSignature, MessageSquareWarning, MessageSquare, Utensils, CalendarClock, ArrowRight,
    Gavel, AlertCircle, FileWarning, RefreshCw, CheckCheck, Timer, UserCheck, PenTool,
} from "lucide-react";
import TaskAssignmentButton from "@/components/TaskAssignmentButton";
import ReactMarkdown from 'react-markdown';
import ZendiAssist from "@/components/ZendiAssist";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { HeroCard } from "@/components/ui/HeroCard";
import { StatTile } from "@/components/ui/StatTile";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { SupervisorRondaTile } from "@/components/SupervisorRondaTile";
import { HandoverSignDrawer, type HandoverSummary } from "@/components/care/HandoverSignDrawer";
import { QuickActionsHub } from "@/components/care/QuickActionsHub";
import WriteIncidentModal from "@/components/hr/WriteIncidentModal";
import ForceCloseShiftButton from "@/components/ForceCloseShiftButton";
import StaffChat from "@/components/StaffChat";

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
        <HeroCard
            eyebrow="Zendi AI Engine"
            title={<>Prólogo del Turno <span className="text-[#AEBCD0] text-xl font-normal">(05:45 AM)</span></>}
            subtitle="Resumen ejecutivo del turno precedente y focos del día."
            className="rounded-[2.5rem] p-8 md:p-10 shadow-xl"
            actions={
                <button onClick={handlePlayPause}
                    className={`flex items-center justify-center w-14 h-14 rounded-[1.25rem] shadow-lg transition-all active:scale-95 ${isPlaying ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse' : 'bg-white/10 border-2 border-white/15 hover:border-[var(--color-teal-on-dark)] text-white'}`}
                    aria-label={isPlaying ? 'Detener resumen' : 'Reproducir resumen'}>
                    {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                </button>
            }
        >
            {/* Cuerpo del resumen — hereda text-[#D2DBEA] del HeroCard (contraste ~10:1).
                prose-invert da estructura tipográfica al markdown; el color del cuerpo
                lo pone el wrapper, no prose. Marker teal preservado. */}
            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-li:marker:text-teal-400 prose-p:text-[#D2DBEA] prose-li:text-[#D2DBEA] prose-strong:text-white">
                <ReactMarkdown>{text}</ReactMarkdown>
            </div>
        </HeroCard>
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

    // Staff Chat — disponible también en esta vista full-screen
    const [staffChatOpen, setStaffChatOpen] = useState(false);
    const [staffChatUnread, setStaffChatUnread] = useState(0);

    // Quick Actions Hub — los mismos 4 chips del /care (CLINICAL/COMPLAINT/MAINTENANCE/UPP_ALERT),
    // accesibles desde el wall del supervisor sin tener que ir a la tablet del cuidador.
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);

    const [dispatchingTicket, setDispatchingTicket] = useState<any>(null);
    const [isDispatching, setIsDispatching] = useState(false);
    const [incidentModalOpen, setIncidentModalOpen] = useState(false);

    // Alerta visible si el Schedule de la semana actual está en DRAFT.
    // Causa raíz histórica: el director arma el horario, ve advertencias menores
    // en el modal de publicación, cancela creyendo que es un error, y el equipo
    // opera toda la semana sin pauta oficial. El banner grita en el wall donde
    // más duele el problema.
    const [scheduleDraftAlert, setScheduleDraftAlert] = useState<null | { scheduleId: string; shiftCount: number; weekStartDate: string }>(null);
    useEffect(() => {
        const fetchDraftStatus = async () => {
            try {
                const res = await fetch('/api/hr/schedule/draft-status');
                const data = await res.json();
                if (data.success && data.hasDraftCurrentWeek) {
                    setScheduleDraftAlert({ scheduleId: data.scheduleId, shiftCount: data.shiftCount, weekStartDate: data.weekStartDate });
                } else {
                    setScheduleDraftAlert(null);
                }
            } catch {}
        };
        fetchDraftStatus();
        const interval = setInterval(fetchDraftStatus, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Handover sign drawer — firma rápida inline sin navegar a /care/reports/[id].
    // Reduce la fricción para Celia/director que debe firmar 5-12 handovers diarios.
    const [handoverToSign, setHandoverToSign] = useState<HandoverSummary | null>(null);
    // Sección "Handovers Hoy" → "Completados" arranca colapsado para que el ojo
    // se vaya directo a "Esperando tu firma". El director expande si quiere ver
    // el historial del día.
    const [showSignedHandovers, setShowSignedHandovers] = useState(false);

    // Filtro por TIPO del Inbox Operativo. El backend ya etiqueta cada ticket
    // con una `category` (CLINICO_CRITICO / UPP_PIEL / FAMILY / MANTENIMIENTO /
    // INCIDENTE). Antes la lista era plana y Celia tenía que escanear todo
    // el feed para encontrar lo clínico crítico cuando había ruido de
    // mantenimiento o quejas. Estos tabs filtran sin tocar el sort por urgencia.
    type TriageTab = 'TODOS' | 'CLINICO' | 'UPP' | 'FAMILIA' | 'MANTENIMIENTO';
    const [activeTriageTab, setActiveTriageTab] = useState<TriageTab>('TODOS');

    // Sprint R — acciones adicionales del Inbox Operativo
    const [voidingTicket, setVoidingTicket] = useState<any>(null);
    const [voidReason, setVoidReason] = useState("");
    const [isVoiding, setIsVoiding] = useState(false);
    const [referringTicket, setReferringTicket] = useState<any>(null);
    const [isReferring, setIsReferring] = useState(false);
    const [maintenanceTicket, setMaintenanceTicket] = useState<any>(null);
    const [isDispatchingMaint, setIsDispatchingMaint] = useState(false);

    // Historial de acciones del turno (refs + voids de hoy) — panel colapsable
    const [historialOpen, setHistorialOpen] = useState(false);

    // Panel de Rondas por Cuidador
    const [caregiverRounds, setCaregiverRounds] = useState<any[]>([]);
    // Drill-down: cuidadora seleccionada para ver detalles completos
    const [drillCaregiver, setDrillCaregiver] = useState<any | null>(null);
    const [roundsNightShift, setRoundsNightShift] = useState(false);
    const [roundsLoading, setRoundsLoading] = useState(false);
    const [roundsLastUpdated, setRoundsLastUpdated] = useState<Date | null>(null);

    // Grupos sin cobertura
    const [uncoveredColors, setUncoveredColors] = useState<{ color: string; assignedCaregiverName: string }[]>([]);
    const [uncoveredShiftType, setUncoveredShiftType] = useState<string>('');
    const [redistributingColor, setRedistributingColor] = useState<string | null>(null);

    // Marcar ausente desde el panel "Personal No Presentado".
    // confirmingAbsent guarda el scheduledShiftId que está en estado "confirma?".
    // markingAbsent guarda el scheduledShiftId del POST en vuelo.
    const [confirmingAbsent, setConfirmingAbsent] = useState<string | null>(null);
    const [markingAbsent, setMarkingAbsent] = useState<string | null>(null);

    // Asignación top-down de grupo a una cuidadora específica.
    // assigningColorModal = color abierto (null = cerrado).
    // assignTargetId = caregiver seleccionado en el dropdown.
    // assignSubmitting = POST en vuelo.
    const [assigningColorModal, setAssigningColorModal] = useState<string | null>(null);
    const [assignTargetId, setAssignTargetId] = useState<string>('');
    const [assignSubmitting, setAssignSubmitting] = useState(false);

    // Cambiar color base de una cuidadora (botón en cada tarjeta del wall).
    // Reemplaza el patrón de "ir a la DB" para asignaciones ad-hoc cuando
    // una sustituta entra fuera de pauta.
    const [colorPickerCg, setColorPickerCg] = useState<{ id: string; name: string; currentColor: string | null } | null>(null);
    const [settingColor, setSettingColor] = useState(false);

    // Fast Actions: countdown + update
    const [tickNow, setTickNow] = useState(Date.now());
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

    useEffect(() => {
        const tick = setInterval(() => setTickNow(Date.now()), 30000);
        return () => clearInterval(tick);
    }, []);

    // Detiene el polling si la sesión expira (evita ola de 401s)
    const sessionExpiredRef = useRef(false);
    const handleSessionExpiry = () => {
        if (!sessionExpiredRef.current) {
            sessionExpiredRef.current = true;
            // FIX (incidente "fuera de servicio"): la ruta canónica es /login,
            // /auth/signin nunca existió y devolvía 404.
            router.push('/login?callbackUrl=/care/supervisor');
        }
    };

    // Role guard — solo SUPERVISOR/DIRECTOR/ADMIN ven este dashboard.
    // Antes esta ruta no verificaba rol: cualquier caregiver logueada podía
    // entrar (los API endpoints sí filtran rol, pero el shell del UI cargaba
    // igual). Incidente: Brenda CAREGIVER llegó aquí navegando manualmente.
    const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

    useEffect(() => {
        if (!user) return;
        if (!SUPERVISOR_ROLES.includes(user.role as string)) {
            // Caregivers vuelven a su tablet. No dejamos UI vacío + 401s en consola.
            router.replace('/care');
            return;
        }
        sessionExpiredRef.current = false;
        fetchSupervisorData();
        fetchLiveData();
        fetchCaregiverRounds();
        fetchUncoveredColors();
        // Polling 30s (antes 15s). El dashboard del supervisor no necesita
        // refresco sub-30s; ahorra ~50% de requests al backend sin afectar
        // la UX. Las acciones del supervisor (despachar, redistribuir, etc.)
        // hacen fetch inmediato vía sus propios handlers.
        const interval = setInterval(() => {
            if (sessionExpiredRef.current) return;
            fetchLiveData();
            fetchCaregiverRounds();
            fetchUncoveredColors();
        }, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const fetchLiveData = async () => {
        if (!user || sessionExpiredRef.current) return;
        const hqId = (user as any).hqId || (user as any).headquartersId || "hq-demo-1";
        try {
            const res = await fetch(`/api/care/supervisor/live?hqId=${hqId}`);
            if (res.status === 401) { handleSessionExpiry(); return; }
            const data = await res.json();
            if (data.success) setLiveData(data);
        } catch (e) { console.error("Live fetch error", e); }
    };

    const fetchCaregiverRounds = async () => {
        if (!user || sessionExpiredRef.current) return;
        const hqId = (user as any).hqId || (user as any).headquartersId || "hq-demo-1";
        setRoundsLoading(true);
        try {
            const res = await fetch(`/api/care/supervisor/caregiver-rounds?hqId=${hqId}`);
            if (res.status === 401) { handleSessionExpiry(); return; }
            const data = await res.json();
            if (data.success) {
                setCaregiverRounds(data.caregivers || []);
                setRoundsNightShift(data.isNightShift || false);
                setRoundsLastUpdated(new Date());
            }
        } catch (e) { console.error("Caregiver rounds fetch error", e); }
        finally { setRoundsLoading(false); }
    };

    const fetchUncoveredColors = async () => {
        if (!user || sessionExpiredRef.current) return;
        const hqId = (user as any).hqId || (user as any).headquartersId || '';
        try {
            const res = await fetch(`/api/care/supervisor/uncovered-colors?hqId=${hqId}`);
            if (res.status === 401) { handleSessionExpiry(); return; }
            const data = await res.json();
            if (data.success) {
                setUncoveredColors(data.uncoveredColors || []);
                setUncoveredShiftType(data.activeShiftType || '');
            }
        } catch (e) { console.error('Uncovered colors fetch error', e); }
    };

    const handleRedistributeColor = async (color: string) => {
        setRedistributingColor(color);
        try {
            const res = await fetch('/api/care/supervisor/uncovered-colors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ color, shiftType: uncoveredShiftType }),
            });
            const data = await res.json();
            if (data.success) {
                setUncoveredColors(prev => prev.filter(u => u.color !== color));
                alert(data.message || `Redistribución completada.`);
                fetchCaregiverRounds();
            } else {
                alert(`No se pudo redistribuir: ${data.error || 'Error desconocido'}`);
            }
        } catch (e) {
            console.error('Redistribute error', e);
            alert('Error de conexión al redistribuir. Verifica tu red.');
        }
        finally { setRedistributingColor(null); }
    };

    // Marcar ausente desde el wall — reusa POST /api/hr/schedule/absent (mismo
    // endpoint del Schedule Builder). Persiste isAbsent + absentMarkedAt +
    // absentMarkedById en ScheduledShift, así la ausencia se cuenta en
    // /api/hr/audit-report (KPI "Ausencias" del perfil del empleado en
    // /hr/audit/[id]). Adicionalmente dispara redistribución equitativa de los
    // residentes del color del ausente entre cuidadoras activas.
    const handleMarkAbsent = async (scheduledShiftId: string, employeeName: string) => {
        setMarkingAbsent(scheduledShiftId);
        setConfirmingAbsent(null);
        try {
            const hqId = (user as any)?.hqId || (user as any)?.headquartersId || '';
            const res = await fetch('/api/hr/schedule/absent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduledShiftId, hqId }),
            });
            const data = await res.json();
            if (data.success) {
                // Si la detección automática generó un IncidentReport por
                // patrón, lo señalamos en el toast — visibilidad de que el
                // sistema penalizó (vía 72h flow) y no quedó solo en conteo.
                const baseMsg = data.message || `${employeeName} marcada ausente.`;
                const patternMsg = data.patternIncident
                    ? ` ⚠️ Patrón de ausencias: ${data.patternIncident.absenceCount} en 30d → observación WARNING generada (72h para explicación).`
                    : '';
                setToast({
                    msg: baseMsg + patternMsg,
                    type: 'ok',
                });
                // Refresh en cadena — el empleado sale de progMissing,
                // las tarjetas reflejan los overrides nuevos, la cobertura
                // recomputa.
                fetchSupervisorData();
                fetchCaregiverRounds();
                fetchUncoveredColors();
                fetchLiveData();
            } else {
                setToast({
                    msg: data.error || 'No se pudo marcar ausente',
                    type: 'err',
                });
            }
        } catch (e) {
            console.error('markAbsent error', e);
            setToast({ msg: 'Error de conexión al marcar ausente', type: 'err' });
        } finally {
            setMarkingAbsent(null);
        }
    };

    // Asignar grupo top-down: el supervisor elige UN caregiver activo y le
    // asigna TODOS los residentes del color vía ShiftPatientOverride. POST a
    // /api/care/supervisor/assign-color (idempotente: si ya tiene, no
    // duplica; si están con otra, los reasigna y cierra el override viejo).
    const handleAssignColor = async () => {
        if (!assigningColorModal || !assignTargetId) return;
        setAssignSubmitting(true);
        try {
            const res = await fetch('/api/care/supervisor/assign-color', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    color: assigningColorModal,
                    shiftType: uncoveredShiftType,
                    targetCaregiverId: assignTargetId,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: data.message || 'Asignación completada.', type: 'ok' });
                setAssigningColorModal(null);
                setAssignTargetId('');
                fetchUncoveredColors();
                fetchCaregiverRounds();
            } else {
                setToast({ msg: data.error || 'No se pudo asignar', type: 'err' });
            }
        } catch (e) {
            console.error('assignColor error', e);
            setToast({ msg: 'Error de conexión al asignar', type: 'err' });
        } finally {
            setAssignSubmitting(false);
        }
    };

    // FASE 82 — Liberar/Reactivar pauta base de un ScheduledShift desde el
    // drill-down del wall. Caso: la cuidadora cambió de cobertura (picker o
    // set-caregiver-color), el wall mostraba pauta YELLOW + assignment RED
    // sumados por D1 aditivo. Liberar marca releasedAt → resolver ignora la
    // pauta YELLOW base → wall solo muestra el color real.
    const [releasingShift, setReleasingShift] = useState(false);
    const handleReleaseShift = async (scheduledShiftId: string, baseColor: string | null) => {
        const colorLabel = baseColor === 'RED' ? 'rojo' : baseColor === 'YELLOW' ? 'amarillo' : baseColor === 'BLUE' ? 'azul' : baseColor === 'GREEN' ? 'verde' : baseColor ?? 'sin color';
        if (!confirm(`¿Liberar la pauta ${colorLabel} de esta cuidadora? Su color base dejará de contar en el wall.`)) return;
        setReleasingShift(true);
        try {
            const res = await fetch('/api/hr/schedule/release-shift', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduledShiftId }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: data.message || 'Pauta liberada.', type: 'ok' });
                setDrillCaregiver(null);
                fetchCaregiverRounds();
                fetchUncoveredColors();
            } else {
                setToast({ msg: data.error || 'No se pudo liberar', type: 'err' });
            }
        } catch (e) {
            console.error('releaseShift error', e);
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setReleasingShift(false);
        }
    };
    const handleUnreleaseShift = async (scheduledShiftId: string) => {
        setReleasingShift(true);
        try {
            const res = await fetch('/api/hr/schedule/unrelease-shift', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduledShiftId }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: data.message || 'Pauta reactivada.', type: 'ok' });
                setDrillCaregiver(null);
                fetchCaregiverRounds();
                fetchUncoveredColors();
            } else {
                setToast({ msg: data.error || 'No se pudo reactivar', type: 'err' });
            }
        } catch (e) {
            console.error('unreleaseShift error', e);
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setReleasingShift(false);
        }
    };

    // Cambiar el color base de una cuidadora (1-clic desde la tarjeta del wall).
    // Crea/actualiza ShiftColorAssignment vía /api/care/supervisor/set-caregiver-color.
    const handleSetCaregiverColor = async (color: string) => {
        if (!colorPickerCg) return;
        setSettingColor(true);
        try {
            const res = await fetch('/api/care/supervisor/set-caregiver-color', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caregiverId: colorPickerCg.id, color }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: data.message || 'Color asignado.', type: 'ok' });
                setColorPickerCg(null);
                fetchCaregiverRounds();
                fetchUncoveredColors();
            } else {
                setToast({ msg: data.error || 'No se pudo asignar', type: 'err' });
            }
        } catch (e) {
            console.error('setCaregiverColor error', e);
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setSettingColor(false);
        }
    };

    const fetchSupervisorData = async () => {
        try {
            const res = await fetch("/api/care/supervisor");
            if (res.status === 401) { handleSessionExpiry(); return; }
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

    // FIX 7 — Supervisores cierran tareas vía close-task (sin penalidad automática).
    // El endpoint PATCH /fast-actions ahora es solo para el cuidador propio.
    const handleUpdateTaskStatus = async (id: string, status: 'COMPLETED' | 'FAILED') => {
        setUpdatingTaskId(id);
        try {
            const res = await fetch('/api/care/supervisor/close-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignmentId: id, status }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: status === 'COMPLETED' ? 'Tarea completada ✓' : 'Tarea cerrada como fallida', type: status === 'COMPLETED' ? 'ok' : 'err' });
                fetchLiveData();
            } else {
                setToast({ msg: data.error || 'Error cerrando tarea', type: 'err' });
            }
        } catch (e) {
            console.error(e);
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setUpdatingTaskId(null);
        }
    };

    // Sprint R — Referir a enfermería
    const handleReferToNursing = async () => {
        if (!referringTicket || !user) return;
        setIsReferring(true);
        try {
            const hqId = (user as any).hqId || (user as any).headquartersId || "";
            const res = await fetch("/api/care/supervisor/refer-nursing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headquartersId: hqId,
                    sourceType: referringTicket.sourceType,
                    sourceId: referringTicket.sourceId,
                    patientId: referringTicket.patientId || null,
                    description: `${referringTicket.title} — ${referringTicket.description}`.substring(0, 500),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: `Enfermería notificada (${data.notifiedCount} enfermera${data.notifiedCount === 1 ? '' : 's'})`, type: 'ok' });
                setReferringTicket(null);
                fetchLiveData();
            } else {
                setToast({ msg: `Error: ${data.error}`, type: 'err' });
            }
        } catch (e) {
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setIsReferring(false);
        }
    };

    // Sprint R — Void/descartar ticket
    const handleVoidTicket = async () => {
        if (!voidingTicket || !user) return;
        const reason = voidReason.trim();
        if (reason.length < 10) {
            setToast({ msg: 'El motivo debe tener al menos 10 caracteres', type: 'err' });
            return;
        }
        setIsVoiding(true);
        try {
            const hqId = (user as any).hqId || (user as any).headquartersId || "";
            const res = await fetch("/api/care/supervisor/void-ticket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headquartersId: hqId,
                    sourceType: voidingTicket.sourceType,
                    sourceId: voidingTicket.sourceId,
                    reason,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: 'Ticket descartado', type: 'ok' });
                setVoidingTicket(null);
                setVoidReason("");
                fetchLiveData();
            } else {
                setToast({ msg: `Error: ${data.error}`, type: 'err' });
            }
        } catch (e) {
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setIsVoiding(false);
        }
    };

    // Sprint R — Despachar a mantenimiento
    const handleDispatchMaintenance = async () => {
        if (!maintenanceTicket || !user) return;
        setIsDispatchingMaint(true);
        try {
            const hqId = (user as any).hqId || (user as any).headquartersId || "";
            // Para ZENDI_GROUP de mantenimiento, el sourceId es "zendi_maint"; tomamos items reales
            const sourceId = maintenanceTicket.sourceType === 'ZENDI_GROUP' && Array.isArray(maintenanceTicket.items) && maintenanceTicket.items[0]
                ? maintenanceTicket.items[0].sourceId
                : maintenanceTicket.sourceId;
            const res = await fetch("/api/care/supervisor/dispatch-maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headquartersId: hqId,
                    sourceId,
                    description: `${maintenanceTicket.title} — ${maintenanceTicket.description}`.substring(0, 500),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ msg: `Enviado a Mantenimiento (${data.notifiedMaintenance}) + Director notificado`, type: 'ok' });
                setMaintenanceTicket(null);
                fetchLiveData();
            } else {
                setToast({ msg: `Error: ${data.error}`, type: 'err' });
            }
        } catch (e) {
            setToast({ msg: 'Error de conexión', type: 'err' });
        } finally {
            setIsDispatchingMaint(false);
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
    // Zombies vienen del backend (query separada, hasta 7 días atrás) para que los
    // turnos olvidados de días previos sigan visibles y cerrables. Si el backend no
    // los provee (cliente viejo), fallback al filtro local sobre activeSessions.
    const zombis: any[] = (liveData?.zombieSessions && Array.isArray(liveData.zombieSessions))
        ? liveData.zombieSessions
        : activeSessions.filter((s: CaregiverSession) => (nowTime - new Date(s.startTime).getTime()) / 3600000 >= 12);

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
        <>
        <div className="min-h-screen bg-slate-100 p-6 md:p-8 font-sans">
            <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-6 pb-16">

                {/* ============================================== */}
                {/* SECCIÓN 1 — HUD SUPERIOR (Título + KPIs + Chips) */}
                {/* ============================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Header Mission Control */}
                    <HeroCard
                        icon={<ShieldAlert className="w-8 h-8 text-[var(--color-teal-on-dark)]" />}
                        title="Mission Control"
                        subtitle="Despacho clínico, cumplimiento y continuidad en tiempo real."
                        className="lg:col-span-5 rounded-[2.5rem] p-8 md:p-10 shadow-xl"
                    >
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-5">
                            <div className="flex items-center gap-2 text-[var(--color-teal-on-dark)] font-bold text-[10px] uppercase tracking-widest mb-1">
                                <Clock className="w-3.5 h-3.5" /> Turno Activo
                            </div>
                            <p className="text-white font-black text-lg">{shiftMeta.icon} {shiftMeta.es}</p>
                            <p className="text-[#AEBCD0] text-xs font-bold mt-0.5">{shiftMeta.window} · Hora de Puerto Rico</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <TaskAssignmentButton user={user} buttonLabel="Asignar Meta Libre (15m)" buttonStyle="bg-teal-500 hover:bg-teal-400 text-slate-900 font-black px-5 py-3 rounded-[1.5rem] shadow-lg active:scale-95 transition-all text-sm" />
                            {/* Acciones Rápidas — réplica del HUB del /care para que el supervisor
                                pueda disparar los 4 reportes operacionales (Clínico, Familiar,
                                Mantenimiento, UPP/Piel) sin tener que ir a una tablet de cuidador. */}
                            <button
                                onClick={() => setQuickActionsOpen(true)}
                                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-4 py-3 rounded-[1.5rem] shadow-lg active:scale-95 transition-all"
                                title="Reportar Clínico / Familiar / Mantenimiento / UPP"
                            >
                                <Sparkles className="w-4 h-4" />
                                Acciones Rápidas
                            </button>
                            {/* Botón Chat Staff — visible en esta vista full-screen */}
                            <button
                                onClick={() => setStaffChatOpen(v => !v)}
                                className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-sm px-4 py-3 rounded-[1.5rem] shadow-sm transition-all"
                                title="Chat interno del equipo"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Chat Staff
                                {staffChatUnread > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-teal-400 rounded-full text-[9px] font-black text-slate-900 flex items-center justify-center leading-none">
                                        {staffChatUnread > 9 ? '9+' : staffChatUnread}
                                    </span>
                                )}
                            </button>
                        </div>
                    </HeroCard>

                    {/* KPIs — 4 StatTiles. Incidentes pasa a tone="danger" cuando hay > 0,
                        manteniendo el comportamiento original (pulse + tinte rose). */}
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatTile
                            tone="teal"
                            icon={<Users className="w-8 h-8" />}
                            value={liveData ? liveData.activeCaregivers : "—"}
                            label="En Piso"
                            helper={<InfoTooltip text="Cuidadores con sesión activa en este momento." />}
                            className="rounded-[2rem] p-6"
                        />
                        <StatTile
                            icon={<Droplets className="w-8 h-8" />}
                            value={liveData ? liveData.liveStats.baths : "—"}
                            label="Baños"
                            className="rounded-[2rem] p-6"
                        />
                        <StatTile
                            icon={<Coffee className="w-8 h-8" />}
                            value={liveData ? Object.values(liveData.liveStats.meals).reduce((a: any, b: any) => a + b, 0) : "—"}
                            label="Dietas"
                            className="rounded-[2rem] p-6"
                        />
                        <StatTile
                            tone={liveData && liveData.liveStats.incidents > 0 ? "danger" : "neutral"}
                            icon={<Siren className="w-8 h-8" />}
                            value={liveData ? liveData.liveStats.incidents : "—"}
                            label="Incidentes"
                            className="rounded-[2rem] p-6"
                        />
                    </div>
                </div>

                {/* Quick-access chips (kitchen + rondas) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href="/care/supervisor/audit" className="bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                            <FileWarning className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-sm">Auditoría de Turno</p>
                            <p className="text-xs text-slate-500 font-medium">Revisión física por empleado y turno</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
                    </Link>
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

                {/* ============================================== */}
                {/* ALERTA GRUPOS SIN COBERTURA                    */}
                {/* ============================================== */}
                {uncoveredColors.length > 0 && (() => {
                    const colorLabel: Record<string, string> = { RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde' };
                    const colorDotClass: Record<string, string> = { RED: 'bg-red-500', YELLOW: 'bg-yellow-400', BLUE: 'bg-blue-500', GREEN: 'bg-green-500' };
                    const colorBgClass: Record<string, string> = { RED: 'bg-red-50 border-red-200', YELLOW: 'bg-amber-50 border-amber-200', BLUE: 'bg-blue-50 border-blue-200', GREEN: 'bg-green-50 border-green-200' };
                    return (
                        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                                </div>
                                <div>
                                    <p className="font-black text-rose-800 text-sm leading-tight">Grupos sin cuidadora en piso</p>
                                    <p className="text-xs text-rose-600 font-medium">Distribuye sus residentes entre las activas</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {uncoveredColors.map(u => (
                                    <div key={u.color} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${colorBgClass[u.color] || 'bg-slate-50 border-slate-200'}`}>
                                        <div className={`w-3 h-3 rounded-full ${colorDotClass[u.color] || 'bg-slate-400'}`} />
                                        <div>
                                            <p className="text-sm font-black text-slate-800">Grupo {colorLabel[u.color] || u.color}</p>
                                            <p className="text-[11px] text-slate-500 font-medium">{u.assignedCaregiverName} no está en piso</p>
                                        </div>
                                        {/* Auto: round-robin entre TODAS las activas */}
                                        <button
                                            onClick={() => handleRedistributeColor(u.color)}
                                            disabled={redistributingColor === u.color}
                                            className="ml-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {redistributingColor === u.color ? (
                                                <><Loader2 className="w-3 h-3 animate-spin" /> Distribuyendo...</>
                                            ) : (
                                                <>⚡ Redistribuir</>
                                            )}
                                        </button>
                                        {/* Top-down: supervisor elige UNA cuidadora */}
                                        <button
                                            onClick={() => { setAssigningColorModal(u.color); setAssignTargetId(''); }}
                                            disabled={redistributingColor === u.color}
                                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-black px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                                            title="Asignar todos los residentes del grupo a UNA cuidadora específica"
                                        >
                                            → Asignar a…
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* ============================================== */}
                {/* PANEL RONDAS POR CUIDADOR (tiempo real)        */}
                {/* ============================================== */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                                <UserCheck className="w-5 h-5 text-teal-600" />
                            </div>
                            <div>
                                <h2 className="font-black text-slate-800 text-base leading-tight">
                                    Rondas de Cuidadores — Tiempo Real
                                </h2>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    {roundsNightShift ? '🌙 Guardia Nocturna · Rotaciones + Notas' : '☀️ Turno Diurno · Baños + Comidas + Rotaciones'}
                                    {roundsLastUpdated && (
                                        <span className="ml-2 text-slate-400">
                                            · Actualizado {roundsLastUpdated.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchCaregiverRounds}
                            disabled={roundsLoading}
                            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-teal-600 transition-colors px-3 py-1.5 rounded-xl border border-slate-200 hover:border-teal-300 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${roundsLoading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                    </div>

                    {roundsLoading && caregiverRounds.length === 0 ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : caregiverRounds.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-semibold text-sm">Sin cuidadores con sesión activa</p>
                            <p className="text-xs mt-1">Las tarjetas aparecerán cuando inicien turno</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {caregiverRounds.map((cg) => (
                                <SupervisorRondaTile
                                    key={cg.caregiverId}
                                    cg={cg}
                                    onOpenDrill={setDrillCaregiver}
                                    onOpenColorPicker={setColorPickerCg}
                                />
                            ))}
                        </div>
                    )}
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
                                const empName = emp.user?.name || emp.employee?.name || emp.name || 'Empleado';
                                const shiftId: string = emp.id;
                                const isConfirming = confirmingAbsent === shiftId;
                                const isMarking = markingAbsent === shiftId;
                                return (
                                    <div key={shiftId} className="bg-slate-900/60 rounded-xl px-4 py-3 border border-red-500/20">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-white font-bold text-sm">{empName}</span>
                                                {emp.colorGroup && emp.colorGroup !== 'ALL' && (
                                                    <span className="text-[10px] font-bold text-slate-300 bg-slate-700/60 px-2 py-0.5 rounded-full uppercase">
                                                        Grupo {emp.colorGroup}
                                                    </span>
                                                )}
                                                <span className="text-red-400 text-xs font-medium">Turno activo sin sesión</span>
                                            </div>
                                            {!isConfirming && !isMarking && (
                                                <button
                                                    onClick={() => setConfirmingAbsent(shiftId)}
                                                    className="text-[11px] font-black uppercase tracking-wide text-red-200 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 px-3 py-1.5 rounded-full transition-colors"
                                                    aria-label={`Marcar ${empName} como ausente`}
                                                >
                                                    Marcar Ausente
                                                </button>
                                            )}
                                            {isMarking && (
                                                <span className="text-[11px] font-bold text-slate-300 italic">Procesando…</span>
                                            )}
                                        </div>
                                        {isConfirming && (
                                            <div className="mt-3 pt-3 border-t border-red-500/20">
                                                <p className="text-xs text-red-100 mb-2 leading-relaxed">
                                                    Esto registra la ausencia en el perfil de <b>{empName}</b> y redistribuye sus residentes
                                                    {emp.colorGroup && emp.colorGroup !== 'ALL' ? ` del Grupo ${emp.colorGroup}` : ''} entre el equipo en piso.
                                                </p>
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => setConfirmingAbsent(null)}
                                                        className="text-[11px] font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkAbsent(shiftId, empName)}
                                                        className="text-[11px] font-black uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-full transition-colors"
                                                    >
                                                        Confirmar Ausencia
                                                    </button>
                                                </div>
                                            </div>
                                        )}
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

                {/* Alerta DRAFT: el Schedule de la semana actual no está publicado.
                    El equipo opera sin pauta oficial — wall no asocia cuidadoras a su
                    color, cobertura no se distribuye, ausencias no penalizan, etc.
                    Banner prominente con CTA directo al builder. */}
                {scheduleDraftAlert && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-[2rem] p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-amber-900 text-base leading-tight">
                                Horario de esta semana en BORRADOR — {scheduleDraftAlert.shiftCount} turnos sin publicar
                            </p>
                            <p className="text-xs text-amber-800 font-medium mt-0.5">
                                El equipo está operando sin pauta oficial. El wall no asocia cuidadoras a su color, la cobertura por ausencia no se distribuye, y el motor de penalidades está pausado. Publicar toma 5 segundos.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/hr/schedule')}
                            className="shrink-0 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                            Ir a publicar →
                        </button>
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

                    {/* Tabs por tipo de reporte — filtra sin tocar el sort por urgencia.
                        Mapea cada tab a las categories del backend:
                          CLINICO        → CLINICO_CRITICO + INCIDENTE
                          UPP            → UPP_PIEL
                          FAMILIA        → FAMILY
                          MANTENIMIENTO  → MANTENIMIENTO
                          TODOS          → sin filtro
                        Los conteos se calculan sobre el feed completo, no sobre el filtrado. */}
                    {(() => {
                        const tabMatchesCategory = (tab: TriageTab, cat: string): boolean => {
                            if (tab === 'TODOS') return true;
                            if (tab === 'CLINICO') return cat === 'CLINICO_CRITICO' || cat === 'INCIDENTE';
                            if (tab === 'UPP') return cat === 'UPP_PIEL';
                            if (tab === 'FAMILIA') return cat === 'FAMILY';
                            if (tab === 'MANTENIMIENTO') return cat === 'MANTENIMIENTO';
                            return false;
                        };
                        const feed = liveData?.triageFeed || [];
                        const countByTab = (tab: TriageTab) =>
                            tab === 'TODOS' ? feed.length : feed.filter((t: TriageTicket) => tabMatchesCategory(tab, t.category)).length;
                        const tabs: { id: TriageTab; label: string }[] = [
                            { id: 'TODOS', label: 'Todos' },
                            { id: 'CLINICO', label: 'Clínico' },
                            { id: 'UPP', label: 'UPP' },
                            { id: 'FAMILIA', label: 'Familia' },
                            { id: 'MANTENIMIENTO', label: 'Mantenimiento' },
                        ];
                        return (
                            <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-100 pb-2">
                                {tabs.map(t => {
                                    const active = activeTriageTab === t.id;
                                    const count = countByTab(t.id);
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTriageTab(t.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                                                active
                                                    ? 'bg-[var(--color-zendity-teal)] text-white shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                            }`}
                                        >
                                            {t.label}
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                                active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {!liveData ? (
                        <div className="flex-1 flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-slate-500" /></div>
                    ) : (() => {
                        const tabMatchesCategory = (tab: TriageTab, cat: string): boolean => {
                            if (tab === 'TODOS') return true;
                            if (tab === 'CLINICO') return cat === 'CLINICO_CRITICO' || cat === 'INCIDENTE';
                            if (tab === 'UPP') return cat === 'UPP_PIEL';
                            if (tab === 'FAMILIA') return cat === 'FAMILY';
                            if (tab === 'MANTENIMIENTO') return cat === 'MANTENIMIENTO';
                            return false;
                        };
                        const filteredFeed = activeTriageTab === 'TODOS'
                            ? liveData.triageFeed || []
                            : (liveData.triageFeed || []).filter((t: TriageTicket) => tabMatchesCategory(activeTriageTab, t.category));
                        if (filteredFeed.length === 0) {
                            return (
                                <div className="flex-1 flex flex-col justify-center items-center text-center py-12">
                                    <Activity className="w-10 h-10 text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-500">
                                        {activeTriageTab === 'TODOS' ? 'Sin tickets en el inbox' : `Sin tickets en "${activeTriageTab.toLowerCase()}"`}
                                    </p>
                                    {activeTriageTab !== 'TODOS' && (
                                        <button
                                            onClick={() => setActiveTriageTab('TODOS')}
                                            className="text-xs text-[var(--color-zendity-teal)] font-bold mt-2 hover:underline"
                                        >
                                            Ver todos
                                        </button>
                                    )}
                                </div>
                            );
                        }
                        return (
                        <div className="space-y-3">
                            {[...filteredFeed].sort((a, b) => {
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
                                                {isCrisis && ticket.createdAt && (
                                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                                                        hace {Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 60000)}m
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100">
                                                    {ticket.category.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold text-slate-800 leading-tight mb-1">{ticket.title}</h3>
                                            <p className="text-xs font-semibold text-slate-500 mb-2">
                                                Sujeto: <span className="text-slate-800 ml-1">{ticket.patientName}</span>
                                            </p>
                                            <ExpandableText
                                                text={ticket.description}
                                                previewLines={2}
                                                className="text-sm font-medium text-slate-600"
                                            />
                                        </div>
                                        <div className="w-full lg:w-56 shrink-0">
                                            {(() => {
                                                const assignedTask = liveData.activeFastActions?.find((fa: FastActionAssignment) => fa.description.startsWith(`[${ticket.id}]`));
                                                if (assignedTask) {
                                                    const caregiverMatch = liveData.activeSessions?.find((s: CaregiverSession) => s.caregiverId === assignedTask.caregiverId);
                                                    const employeeName = caregiverMatch?.caregiver?.name || "Cuidador";
                                                    const isExpired = new Date(assignedTask.expiresAt).getTime() < Date.now();
                                                    // Más de 30 min transcurridos = menos de 30 min restantes sobre la ventana de 1h
                                                    const minutesLeft = (new Date(assignedTask.expiresAt).getTime() - Date.now()) / 60000;
                                                    const isOver30Min = minutesLeft < 30;
                                                    const isClosing = updatingTaskId === assignedTask.id;
                                                    return (
                                                        <div className={`p-3 rounded-[1.25rem] border-2 text-center ${isExpired ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-teal-50 border-teal-200 text-teal-700'}`}>
                                                            <p className="font-black text-[10px] uppercase tracking-widest mb-1">{isExpired ? 'SLA Vencido' : 'En Resolución'}</p>
                                                            <p className="font-bold text-sm leading-tight">{employeeName}</p>
                                                            {isOver30Min && (
                                                                <button
                                                                    onClick={() => handleUpdateTaskStatus(assignedTask.id, isExpired ? 'FAILED' : 'COMPLETED')}
                                                                    disabled={isClosing}
                                                                    className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {isClosing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                                                    Cerrar tarea
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                // Sprint R — acciones condicionales según tipo de ticket
                                                const cat = ticket.category;
                                                const isMaintenance = cat === 'MANTENIMIENTO';
                                                const isIncident = ticket.sourceType === 'INCIDENT';
                                                const incidentSeverity = (ticket.description || '').toLowerCase();
                                                const isCriticalIncident = isIncident && (incidentSeverity.includes('(critical)') || incidentSeverity.includes('(severe)') || ticket.urgency === 'INMINENTE');
                                                const isFamilyComplaint = ticket.sourceType === 'COMPLAINT' && cat === 'FAMILY';

                                                return (
                                                    <div className="flex flex-col gap-2">
                                                        {/* Mantenimiento: solo botón mantenimiento + descartar */}
                                                        {isMaintenance ? (
                                                            <button
                                                                onClick={() => setMaintenanceTicket(ticket)}
                                                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-[1rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm"
                                                            >
                                                                <Send className="w-4 h-4" /> Enviar a Mantenimiento
                                                            </button>
                                                        ) : isCriticalIncident ? (
                                                            <>
                                                                <button
                                                                    onClick={() => setReferringTicket(ticket)}
                                                                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-[1rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Siren className="w-4 h-4" /> Referir a Enfermería
                                                                </button>
                                                                <button
                                                                    onClick={() => setDispatchingTicket(ticket)}
                                                                    className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2 rounded-[1rem] transition-all active:scale-95 flex items-center justify-center gap-2 text-xs"
                                                                >
                                                                    <Send className="w-3 h-3" /> Despachar
                                                                </button>
                                                            </>
                                                        ) : isFamilyComplaint ? (
                                                            <button
                                                                onClick={() => setDispatchingTicket(ticket)}
                                                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-[1rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm"
                                                            >
                                                                <Send className="w-4 h-4" /> Despachar
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => setDispatchingTicket(ticket)}
                                                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-[1rem] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Send className="w-4 h-4" /> Despachar
                                                                </button>
                                                                <button
                                                                    onClick={() => setReferringTicket(ticket)}
                                                                    className="w-full bg-white hover:bg-teal-50 text-teal-700 border border-teal-300 font-bold py-2 rounded-[1rem] transition-all active:scale-95 flex items-center justify-center gap-2 text-xs"
                                                                >
                                                                    <Siren className="w-3 h-3" /> Referir a Enfermería
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Descartar — siempre visible como acción secundaria */}
                                                        <button
                                                            onClick={() => { setVoidingTicket(ticket); setVoidReason(""); }}
                                                            className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold py-1.5 rounded-lg transition-all text-[11px] uppercase tracking-widest"
                                                        >
                                                            Descartar
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredFeed.length > 8 && (
                                <p className="text-xs text-slate-400 font-bold text-center pt-2">
                                    + {filteredFeed.length - 8} tickets adicionales
                                </p>
                            )}
                        </div>
                        );
                    })()}
                </div>

                {/* ============================================== */}
                {/* HISTORIAL DEL TURNO — Acciones de Inbox de hoy  */}
                {/* ============================================== */}
                {liveData && (liveData.inboxHistory?.length ?? 0) > 0 && (
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                        <button
                            onClick={() => setHistorialOpen(v => !v)}
                            className="w-full flex items-center justify-between px-7 py-4 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <CalendarClock className="w-5 h-5 text-slate-400" />
                                <span className="font-black text-slate-700 text-sm">Historial del Turno</span>
                                <span className="bg-slate-100 text-slate-500 font-bold text-xs px-2 py-0.5 rounded-full">
                                    {liveData.inboxHistory!.length} acción{liveData.inboxHistory!.length !== 1 ? 'es' : ''}
                                </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${historialOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {historialOpen && (
                            <div className="border-t border-slate-100 divide-y divide-slate-50">
                                {liveData.inboxHistory!.map((entry: InboxHistoryItem) => {
                                    const isRef = entry.action === 'ESCALATED';
                                    const minutosAtras = Math.floor((Date.now() - new Date(entry.createdAt).getTime()) / 60000);
                                    const tiempoLabel = minutosAtras < 60 ? `hace ${minutosAtras}m` : `hace ${Math.floor(minutosAtras / 60)}h`;
                                    return (
                                        <div key={entry.id} className="flex items-start gap-3 px-7 py-3">
                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isRef ? 'bg-teal-500' : 'bg-slate-400'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700">
                                                    {isRef ? 'Referido a Enfermería' : 'Ticket Descartado'}
                                                    {entry.sourceType && (
                                                        <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            {entry.sourceType}
                                                        </span>
                                                    )}
                                                </p>
                                                <ExpandableText
                                                    text={entry.description}
                                                    previewLines={2}
                                                    className="text-xs text-slate-500"
                                                />
                                                {entry.reason && (
                                                    <p className="text-[10px] text-slate-400 italic">Motivo: {entry.reason}</p>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">{tiempoLabel}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

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
                    <Card variant="flat" padding="default" className="rounded-[2.5rem] p-7">
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
                                    // El item conserva fondo tintado por umbral del score (helper scoreBg).
                                    // Esto NO va en la primitiva Card — es decisión del call site.
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
                                                <div className="mt-2">
                                                    <ProgressBar
                                                        percent={score}
                                                        tone={(p) => (p >= 80 ? "success" : p >= 60 ? "warning" : "danger")}
                                                        trackTone="white"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Card>
                </div>

                {/* ============================================== */}
                {/* SECCIÓN 4 — VITALES DE ENTRADA + MEDS DEL TURNO  */}
                {/* ============================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vitales de Entrada 4h */}
                    <Card variant="flat" padding="default" className="rounded-[2.5rem] p-7">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                <Heart className="w-6 h-6 text-rose-500" /> Vitales de Entrada (4h)
                                <InfoTooltip text="Ventana automática de 4 horas al inicio del turno. Cada cuidador debe tomar vitales a sus residentes asignados. Penalidad -2 pts por ventana expirada sin vitales." />
                            </h3>
                        </div>
                        {/* Mini-stats: 4 StatTiles compactos. El patrón "valor + label tematizado"
                            ahora consume la primitiva — antes era Card compact + texto inline. */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            <StatTile value={vitalsTotals.total} label="Total" className="rounded-xl" />
                            <StatTile tone="warning" value={vitalsTotals.pending} label="Pendientes" className="rounded-xl" />
                            <StatTile tone="success" value={vitalsTotals.completed} label="Tomados" className="rounded-xl" />
                            <StatTile tone="danger" value={vitalsTotals.expired} label="Vencidos" className="rounded-xl" />
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
                                    // Edge case: totalCg === 0 → pct=0, ProgressBar renderiza barra vacía (correcto).
                                    const pct = totalCg > 0 ? Math.round((doneCg / totalCg) * 100) : 0;
                                    return (
                                        <div key={vb.caregiverId || 'unassigned'} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-slate-800 text-sm truncate">{vb.caregiverName}</span>
                                                <Badge variant="neutral" className="bg-white border border-slate-200 text-slate-600">
                                                    {doneCg}/{totalCg}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {vb.pending > 0 && <Badge variant="warning">{vb.pending} pend</Badge>}
                                                {vb.completedOnTime > 0 && <Badge variant="success">{vb.completedOnTime} ok</Badge>}
                                                {vb.completedLate > 0 && <Badge variant="warning">{vb.completedLate} tarde</Badge>}
                                                {vb.expired > 0 && <Badge variant="danger">{vb.expired} venc</Badge>}
                                            </div>
                                            <div className="mt-2">
                                                <ProgressBar
                                                    percent={pct}
                                                    tone={(p) => (p >= 80 ? "success" : p >= 50 ? "warning" : "danger")}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

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
                {/* SECCIÓN 5 — HANDOVERS HOY                        */}
                {/* Reorganizada: brechas → esperando tu firma →     */}
                {/* completados (colapsable). Drawer inline para     */}
                {/* firmar sin navegar a /care/reports/[id].         */}
                {/* ============================================== */}
                {(() => {
                    const pendingMyFirma = handoversFeed.filter((h: HandoverFeedItem) => h.derivedStatus !== 'SUPERVISOR_SIGNED');
                    const signedToday = handoversFeed.filter((h: HandoverFeedItem) => h.derivedStatus === 'SUPERVISOR_SIGNED');
                    const totalNothing = pendingMyFirma.length === 0 && signedToday.length === 0 && missingHandovers.length === 0;
                    const allCleared = pendingMyFirma.length === 0 && missingHandovers.length === 0 && signedToday.length > 0;

                    const COLOR_BADGES: Record<string, string> = {
                        RED: 'bg-rose-500 text-white',
                        YELLOW: 'bg-amber-400 text-slate-900',
                        GREEN: 'bg-emerald-500 text-white',
                        BLUE: 'bg-sky-500 text-white',
                    };
                    const shiftIcon = (s: string) => s === 'MORNING' ? '☀️' : s === 'EVENING' ? '🌆' : '🌙';

                    return (
                        <div className={`rounded-[2.5rem] p-7 shadow-sm border ${allCleared ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'}`}>
                            <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                                <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                                    <ClipboardSignature className={`w-6 h-6 ${allCleared ? 'text-emerald-600' : 'text-teal-600'}`} /> Handovers Hoy
                                    <InfoTooltip text="Traspasos de turno firmados en el día + brechas. Cada handover requiere firma de la cuidadora saliente + tu firma como supervisor." />
                                </h3>
                                <div className="flex gap-2 flex-wrap">
                                    {missingHandovers.length > 0 && (
                                        <span className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                            <AlertTriangle className="w-3.5 h-3.5" /> {missingHandovers.length} brecha{missingHandovers.length > 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {pendingMyFirma.length > 0 && (
                                        <span className="bg-amber-50 border border-amber-300 text-amber-800 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                                            <PenTool className="w-3.5 h-3.5" /> {pendingMyFirma.length} esperando tu firma
                                        </span>
                                    )}
                                    {signedToday.length > 0 && (
                                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                            ✓ {signedToday.length} firmado{signedToday.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Vista "Día completo" cuando no hay pendientes ni brechas */}
                            {allCleared && (
                                <div className="bg-emerald-100 border border-emerald-200 p-5 rounded-[1.5rem] flex items-center gap-4 mb-5">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-600 shrink-0" />
                                    <div>
                                        <p className="font-black text-emerald-900 text-lg">Día completo ✓</p>
                                        <p className="text-sm text-emerald-700 font-medium">Todos los handovers del día están firmados por ti.</p>
                                    </div>
                                </div>
                            )}

                            {/* (1) BRECHAS — siempre arriba si hay */}
                            {missingHandovers.length > 0 && (
                                <div className="mb-5">
                                    <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5" /> Brechas — turnos cerrados sin handover
                                    </h4>
                                    <div className="space-y-2">
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
                                </div>
                            )}

                            {/* (2) PENDIENTES TU FIRMA — call-to-action prominente con firma inline */}
                            {pendingMyFirma.length > 0 && (
                                <div className="mb-5">
                                    <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <PenTool className="w-3.5 h-3.5" /> Esperando tu firma — {pendingMyFirma.length} reporte{pendingMyFirma.length !== 1 ? 's' : ''}
                                    </h4>
                                    <div className="space-y-2">
                                        {pendingMyFirma.map((h: HandoverFeedItem) => {
                                            const time = new Date(h.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
                                            return (
                                                <div key={h.id} className="p-4 rounded-[1.5rem] border-2 border-amber-200 bg-amber-50/40">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-black text-sm bg-white border border-amber-200">
                                                            {shiftIcon(h.shiftType)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md uppercase tracking-widest">{h.shiftType}</span>
                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest bg-teal-100 text-teal-800">
                                                                    Cuidadora firmó · falta tu firma
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 font-bold">{time}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-900 font-bold mb-1">
                                                                {h.outgoingName || <em className="text-slate-400">Zendi AI</em>}
                                                            </p>
                                                            <div className="flex items-center gap-3 flex-wrap">
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
                                                        </div>
                                                        <button
                                                            onClick={() => setHandoverToSign({
                                                                id: h.id,
                                                                outgoingName: h.outgoingName,
                                                                shiftType: h.shiftType,
                                                                colorGroups: h.colorGroups,
                                                                patientCount: h.patientCount,
                                                                createdAt: h.createdAt as any,
                                                                aiSummaryReport: h.aiSummaryReport,
                                                            })}
                                                            className="shrink-0 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 self-start flex items-center gap-1.5"
                                                        >
                                                            <PenTool className="w-3.5 h-3.5" /> Firmar
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* (3) COMPLETADOS — colapsable, compactos */}
                            {signedToday.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setShowSignedHandovers(v => !v)}
                                        className="w-full flex items-center justify-between py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 transition"
                                    >
                                        <span className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            Completados hoy ({signedToday.length})
                                        </span>
                                        <span>{showSignedHandovers ? '−' : '+'} {showSignedHandovers ? 'ocultar' : 'ver'}</span>
                                    </button>
                                    {showSignedHandovers && (
                                        <div className="space-y-2 mt-2">
                                            {signedToday.map((h: HandoverFeedItem) => {
                                                const time = new Date(h.createdAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
                                                return (
                                                    <div key={h.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs bg-emerald-50 border border-emerald-200">
                                                            {shiftIcon(h.shiftType)}
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                                            <span className="text-sm font-bold text-slate-700 truncate">{h.outgoingName || 'Zendi AI'}</span>
                                                            <span className="text-[10px] text-slate-500 font-bold">{h.shiftType} · {time}</span>
                                                            <div className="flex items-center gap-1">
                                                                {h.colorGroups.map(c => (
                                                                    <span key={c} className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${COLOR_BADGES[c] || 'bg-slate-300 text-slate-800'}`}>
                                                                        {c}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider shrink-0">✓ Firmado</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Empty state — sin handovers ni brechas todavía */}
                            {totalNothing && (
                                <div className="bg-slate-50 border border-slate-100 p-6 rounded-[1.5rem] flex items-center gap-4">
                                    <Clock className="w-8 h-8 text-slate-400 shrink-0" />
                                    <div>
                                        <p className="font-bold text-slate-700">Sin reportes de turno todavía</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Cada cuidadora firma su reporte al cerrar turno.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

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
                                            <ExpandableText
                                                text={ob.description}
                                                previewLines={2}
                                                className="text-xs text-slate-600 font-medium mb-1"
                                            />
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

            {/* Sprint R — Modal: Descartar ticket */}
            {voidingTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-7 max-w-md w-full shadow-2xl border border-slate-200">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-rose-500" /> Descartar ticket
                            </h3>
                            <button onClick={() => { setVoidingTicket(null); setVoidReason(""); }} className="text-slate-400 hover:text-slate-600 w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-xl">×</button>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mb-5">
                            <p className="font-bold text-slate-800 text-sm mb-1 leading-tight">{voidingTicket.title}</p>
                            <p className="text-xs text-slate-600 font-semibold">Residente: {voidingTicket.patientName}</p>
                        </div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                            Motivo del descarte <span className="text-rose-600">*</span>
                        </label>
                        <textarea
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            rows={4}
                            placeholder="Ej: Ticket duplicado, situación ya resuelta por otro miembro del equipo, reportado por error..."
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-rose-400 resize-none"
                            disabled={isVoiding}
                        />
                        <p className="text-[11px] font-semibold text-slate-500 mt-1.5">
                            Mínimo 10 caracteres ({voidReason.trim().length}/10)
                        </p>
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => { setVoidingTicket(null); setVoidReason(""); }}
                                disabled={isVoiding}
                                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleVoidTicket}
                                disabled={isVoiding || voidReason.trim().length < 10}
                                className="flex-[2] px-5 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {isVoiding ? 'Descartando...' : 'Confirmar Descarte'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sprint R — Modal: Referir a Enfermería */}
            {referringTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-7 max-w-md w-full shadow-2xl border border-slate-200">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Siren className="w-5 h-5 text-teal-600" /> Referir a Enfermería
                            </h3>
                            <button onClick={() => setReferringTicket(null)} className="text-slate-400 hover:text-slate-600 w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-xl">×</button>
                        </div>
                        <div className="bg-teal-50 border border-teal-200 p-4 rounded-xl mb-4">
                            <p className="font-bold text-slate-800 text-sm mb-1 leading-tight">{referringTicket.title}</p>
                            <p className="text-xs text-slate-600 font-semibold mb-2">Residente: {referringTicket.patientName}</p>
                            <p className="text-xs text-slate-700 font-medium">{referringTicket.description}</p>
                        </div>
                        <p className="text-sm text-slate-600 font-medium mb-5 leading-relaxed">
                            Se notificará a todo el rol <strong className="text-slate-800">NURSE</strong> de la sede.
                            Este ticket no crea tarea formal — solo alerta vía campana.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setReferringTicket(null)}
                                disabled={isReferring}
                                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReferToNursing}
                                disabled={isReferring}
                                className="flex-[2] px-5 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {isReferring ? 'Notificando...' : 'Confirmar Referido'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sprint R — Modal: Enviar a Mantenimiento */}
            {maintenanceTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-7 max-w-md w-full shadow-2xl border border-slate-200">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Send className="w-5 h-5 text-amber-600" /> Enviar a Mantenimiento
                            </h3>
                            <button onClick={() => setMaintenanceTicket(null)} className="text-slate-400 hover:text-slate-600 w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-xl">×</button>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4">
                            <p className="font-bold text-slate-800 text-sm mb-1 leading-tight">{maintenanceTicket.title}</p>
                            <p className="text-xs text-slate-700 font-medium">{maintenanceTicket.description}</p>
                        </div>
                        <p className="text-sm text-slate-600 font-medium mb-5 leading-relaxed">
                            Se notificará al rol <strong className="text-slate-800">MAINTENANCE</strong> + al Director para visibilidad.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMaintenanceTicket(null)}
                                disabled={isDispatchingMaint}
                                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDispatchMaintenance}
                                disabled={isDispatchingMaint}
                                className="flex-[2] px-5 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {isDispatchingMaint ? 'Enviando...' : 'Confirmar Envío'}
                            </button>
                        </div>
                    </div>
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
                                const validSessions = liveData?.activeSessions?.filter((s: CaregiverSession) => s.startTime && (nowTime - new Date(s.startTime).getTime()) / 3600000 < 14) || [];
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

            {/* ASIGNAR GRUPO MODAL — top-down assignment del wall */}
            {assigningColorModal && (() => {
                const color = assigningColorModal;
                const colorLabels: Record<string, string> = { RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde' };
                const colorBgs: Record<string, string> = {
                    RED: 'bg-red-500', YELLOW: 'bg-amber-400', BLUE: 'bg-blue-500', GREEN: 'bg-emerald-500',
                };
                const colorLabel = colorLabels[color] || color;
                // Solo cuidadoras con sesión activa son candidatas (vienen
                // de caregiverRounds, que ya filtra por sesión).
                const candidates = caregiverRounds || [];
                return (
                    <div
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => { if (!assignSubmitting) { setAssigningColorModal(null); setAssignTargetId(''); } }}
                    >
                        <div
                            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl ${colorBgs[color] || 'bg-slate-400'} shadow-sm`} />
                                    <div>
                                        <h2 className="text-lg font-black text-slate-800 leading-tight">
                                            Asignar Grupo {colorLabel}
                                        </h2>
                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                            Todos los residentes del grupo a UNA sola cuidadora
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-5">
                                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide mb-2">
                                    Cuidadora receptora
                                </label>
                                {candidates.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic py-3">
                                        No hay cuidadoras con sesión activa para asignar.
                                    </p>
                                ) : (
                                    <select
                                        value={assignTargetId}
                                        onChange={(e) => setAssignTargetId(e.target.value)}
                                        disabled={assignSubmitting}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                    >
                                        <option value="">— Selecciona —</option>
                                        {candidates.map((c: any) => (
                                            <option key={c.caregiverId} value={c.caregiverId}>
                                                {c.name}
                                                {c.colorGroup ? ` · Grupo ${colorLabels[c.colorGroup] || c.colorGroup}` : ''}
                                                {c.coverageCount > 0 ? ` · +${c.coverageCount} cobertura` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                                    Esto crea overrides para todos los residentes del Grupo {colorLabel}.
                                    Si ya estaban con otra cuidadora vía cobertura, se reasignan a esta.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                                <button
                                    onClick={() => { setAssigningColorModal(null); setAssignTargetId(''); }}
                                    disabled={assignSubmitting}
                                    className="text-sm font-bold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAssignColor}
                                    disabled={!assignTargetId || assignSubmitting || candidates.length === 0}
                                    className="text-sm font-black uppercase tracking-wide text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {assignSubmitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Asignando…</>
                                    ) : (
                                        <>Confirmar Asignación</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* DRAWER — firma rápida de handover sin navegar */}
            <HandoverSignDrawer
                handover={handoverToSign}
                onClose={() => setHandoverToSign(null)}
                onSigned={() => fetchLiveData()}
            />

            {/* CAMBIAR COLOR BASE DE UNA CUIDADORA — botón "cambiar" en tile */}
            {colorPickerCg && (() => {
                const colorLabels: Record<string, string> = {
                    RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde', ALL: 'Todos',
                };
                const colorBgs: Record<string, string> = {
                    RED: 'bg-red-500', YELLOW: 'bg-amber-400', BLUE: 'bg-blue-500',
                    GREEN: 'bg-emerald-500', ALL: 'bg-slate-700',
                };
                const options = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'ALL'];
                const current = colorPickerCg.currentColor;
                return (
                    <div
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => { if (!settingColor) setColorPickerCg(null); }}
                    >
                        <div
                            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                                <h2 className="text-lg font-black text-slate-800 leading-tight">
                                    Cambiar grupo base
                                </h2>
                                <p className="text-[13px] text-slate-600 font-semibold mt-1">
                                    {colorPickerCg.name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    {current
                                        ? <>Actualmente en <span className="font-bold">Grupo {colorLabels[current] || current}</span></>
                                        : 'Sin grupo asignado'}
                                </p>
                            </div>
                            <div className="px-6 py-5">
                                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wide mb-3">
                                    Nuevo grupo
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {options.map((c) => {
                                        const isCurrent = c === current;
                                        return (
                                            <button
                                                key={c}
                                                onClick={() => handleSetCaregiverColor(c)}
                                                disabled={settingColor || isCurrent}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                                                    isCurrent
                                                        ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                                                        : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50 active:scale-[0.98]'
                                                } disabled:opacity-50`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg ${colorBgs[c]} shadow-sm flex-shrink-0`} />
                                                <div className="flex-1">
                                                    <div className="text-sm font-black text-slate-800">
                                                        Grupo {colorLabels[c]}
                                                    </div>
                                                    {isCurrent && (
                                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                                                            Actual
                                                        </div>
                                                    )}
                                                </div>
                                                {settingColor && (
                                                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
                                    Esto fija el color base de la cuidadora para HOY. Si entró fuera
                                    de pauta o cubre un grupo distinto, úsalo. La cuidadora recibirá
                                    una notificación.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                                <button
                                    onClick={() => setColorPickerCg(null)}
                                    disabled={settingColor}
                                    className="text-sm font-bold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* DRILL-DOWN MODAL — detalle de cuidadora */}
            {drillCaregiver && (() => {
                const cg = drillCaregiver;
                const colorLabels: Record<string, string> = { RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde', ALL: 'Toda la sede' };
                const colorBgs: Record<string, string> = {
                    RED: 'bg-red-500', YELLOW: 'bg-amber-400', BLUE: 'bg-blue-500',
                    GREEN: 'bg-emerald-500', ALL: 'bg-slate-700',
                };
                const pct = cg.residentsInGroup > 0
                    ? Math.round((cg.attendedThisRound / cg.residentsInGroup) * 100)
                    : 0;
                // Mismo patrón híbrido que la card compacta: si no tiene grupo base pero
                // sí cobertura redistribuida, usar el color de la cobertura cuando es único.
                const drillCoverageColors = cg.coverageByColor
                    ? Object.keys(cg.coverageByColor).filter((c) => (cg.coverageByColor[c] || 0) > 0)
                    : [];
                const drillSingleCoverageColor = drillCoverageColors.length === 1 ? drillCoverageColors[0] : null;
                const drillIsCoverageOnly = !cg.colorGroup && cg.coverageCount > 0;
                const drillEffectiveColor = cg.colorGroup || (drillIsCoverageOnly ? drillSingleCoverageColor : null);
                const colorName = cg.colorGroup
                    ? (colorLabels[cg.colorGroup] || cg.colorGroup)
                    : (drillIsCoverageOnly && drillSingleCoverageColor
                        ? `${colorLabels[drillSingleCoverageColor] || drillSingleCoverageColor} (cobertura)`
                        : null);
                const colorBg = drillEffectiveColor ? (colorBgs[drillEffectiveColor] || 'bg-slate-400') : 'bg-slate-400';
                return (
                    <div
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setDrillCaregiver(null)}
                    >
                        <div
                            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl ${colorBg} text-white font-black text-xl flex items-center justify-center shadow-md`}>
                                        {cg.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 leading-tight">{cg.name}</h2>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                            {colorName
                                                ? `Grupo ${colorName}`
                                                : drillIsCoverageOnly
                                                    ? 'Cobertura redistribuida'
                                                    : 'Sin grupo asignado'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDrillCaregiver(null)}
                                    className="text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                    aria-label="Cerrar"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* KPIs */}
                            <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-slate-50/60 border-b border-slate-100">
                                <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
                                    <p className={`text-2xl font-black leading-none ${cg.roundsCompleted >= 2 ? 'text-emerald-600' : cg.roundsCompleted === 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                                        {cg.roundsCompleted}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">Rondas hoy</p>
                                </div>
                                <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
                                    <p className={`text-2xl font-black leading-none ${pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-slate-500'}`}>
                                        {pct}%
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">Ronda actual</p>
                                </div>
                                <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
                                    <p className="text-2xl font-black leading-none text-slate-700">
                                        {cg.minutesSinceLastRound !== null ? `${cg.minutesSinceLastRound}m` : '—'}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">Desde última ronda</p>
                                </div>
                            </div>

                            {/* Progreso de ronda actual */}
                            <div className="px-6 py-4 border-b border-slate-100">
                                <div className="flex justify-between items-baseline mb-2">
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">
                                        Ronda actual
                                    </h3>
                                    <span className="text-xs font-bold text-slate-500">
                                        {cg.attendedThisRound} / {cg.residentsInGroup} {colorName ? `${colorName.toLowerCase()}s` : 'residentes'}
                                        {cg.coverageCount > 0 && (
                                            <span className="text-slate-400 font-medium"> · +{cg.coverageCount} cobertura</span>
                                        )}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 border border-slate-200 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-slate-300'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                {cg.coverageCount > 0 && (
                                    <p className="text-[11px] text-slate-500 mt-2 italic leading-relaxed">
                                        Las rondas se cuentan sobre su grupo base. La cobertura adicional se lista abajo.
                                    </p>
                                )}
                            </div>

                            {/* Pendientes — lista COMPLETA */}
                            <div className="px-6 py-4 overflow-y-auto flex-1">
                                {cg.noColorGroup ? (
                                    <p className="text-sm text-slate-500 italic text-center py-6">
                                        {drillIsCoverageOnly && drillSingleCoverageColor
                                            ? `Cubriendo Grupo ${colorLabels[drillSingleCoverageColor] || drillSingleCoverageColor} por redistribución — sus residentes están listados abajo.`
                                            : drillIsCoverageOnly
                                                ? 'Cubriendo varios grupos por redistribución — residentes listados abajo.'
                                                : 'Sin grupo de color asignado para este turno.'}
                                    </p>
                                ) : cg.emptyGroup ? (
                                    <p className="text-sm text-slate-500 italic text-center py-6">
                                        El grupo no tiene residentes activos.
                                    </p>
                                ) : (cg.pendingResidents && cg.pendingResidents.length > 0) ? (
                                    <>
                                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-3">
                                            Pendientes en esta ronda ({cg.pendingResidents.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {cg.pendingResidents.map((r: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">{r.name}</p>
                                                        <p className="text-xs text-slate-500 font-medium">Habitación {r.room || '—'}</p>
                                                    </div>
                                                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded-full uppercase tracking-wide">
                                                        Pendiente
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mb-3 text-2xl">
                                            ✓
                                        </div>
                                        <p className="font-black text-slate-800 text-base">Ronda completa</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Todos los residentes del grupo fueron atendidos.
                                        </p>
                                    </div>
                                )}

                                {/* Cobertura adicional (residentes extra por override) */}
                                {cg.coverageCount > 0 && (
                                    <div className="mt-6">
                                        <div className="flex items-baseline justify-between mb-3">
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">
                                                Cobertura adicional
                                            </h3>
                                            <span className="text-xs font-bold text-slate-500">
                                                +{cg.coverageCount} residente{cg.coverageCount !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                                            Residentes que se le sumaron a {cg.name.split(' ')[0]} por redistribución
                                            (ausencia o cobertura manual). Las rondas se cuentan contra su color base.
                                        </p>
                                        {(() => {
                                            const colorLabelMap: Record<string, string> = {
                                                RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde',
                                            };
                                            const colorBadgeBg: Record<string, string> = {
                                                RED: 'bg-red-100 text-red-700 border-red-200',
                                                YELLOW: 'bg-amber-100 text-amber-700 border-amber-200',
                                                BLUE: 'bg-blue-100 text-blue-700 border-blue-200',
                                                GREEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                            };
                                            // Agrupar visualmente por color
                                            const grouped: Record<string, Array<{ name: string; room: string | null; patientId: string }>> = {};
                                            for (const c of (cg.coverageResidents || [])) {
                                                const k = c.originalColor;
                                                if (!grouped[k]) grouped[k] = [];
                                                grouped[k].push(c);
                                            }
                                            return (
                                                <div className="space-y-3">
                                                    {Object.entries(grouped).map(([color, residents]) => (
                                                        <div key={color}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wide ${colorBadgeBg[color] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                                    Grupo {colorLabelMap[color] || color}
                                                                </span>
                                                                <span className="text-xs font-bold text-slate-500">
                                                                    {residents.length} residente{residents.length !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {residents.map((r, i) => (
                                                                    <div key={r.patientId || i} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                                                        <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
                                                                        <p className="text-xs text-slate-500 font-medium">Hab {r.room || '—'}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* FASE 82: Pauta base — Liberar / Reactivar */}
                                {cg.baseShift && (
                                    <div className="mt-6 pt-5 border-t border-slate-200">
                                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-2">
                                            Pauta del horario
                                        </h3>
                                        {cg.baseShift.releasedAt ? (
                                            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4">
                                                <div className="flex items-start gap-3 mb-3">
                                                    <span className="text-lg">🔓</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-700">
                                                            Pauta {cg.baseShift.colorGroup
                                                                ? (colorLabels[cg.baseShift.colorGroup] || cg.baseShift.colorGroup)
                                                                : 'sin color'} liberada
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                            El color original ya no cuenta en el wall. La cobertura activa de {cg.name.split(' ')[0]} se sigue mostrando.
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleUnreleaseShift(cg.baseShift.id)}
                                                    disabled={releasingShift}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-bold transition-colors"
                                                >
                                                    {releasingShift ? 'Reactivando…' : 'Reactivar pauta'}
                                                </button>
                                            </div>
                                        ) : cg.baseShift.colorGroup && (cg.colorGroups?.length || 0) > 1 ? (
                                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                                                    {cg.name.split(' ')[0]} tiene más de un color activo. Si su pauta original
                                                    {' '}<span className="font-bold">{colorLabels[cg.baseShift.colorGroup] || cg.baseShift.colorGroup}</span> ya no aplica
                                                    (cambió de cobertura), puedes liberarla — el wall solo mostrará el color real de cobertura.
                                                </p>
                                                <button
                                                    onClick={() => handleReleaseShift(cg.baseShift.id, cg.baseShift.colorGroup)}
                                                    disabled={releasingShift}
                                                    className="w-full px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm font-bold transition-colors"
                                                >
                                                    {releasingShift ? 'Liberando…' : `Liberar pauta ${colorLabels[cg.baseShift.colorGroup] || cg.baseShift.colorGroup}`}
                                                </button>
                                            </div>
                                        ) : cg.baseShift.colorGroup ? (
                                            <div className="text-xs text-slate-500 italic leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl p-3">
                                                Pauta {colorLabels[cg.baseShift.colorGroup] || cg.baseShift.colorGroup} activa.
                                                Para liberarla, primero asigna un color de cobertura distinto a {cg.name.split(' ')[0]}.
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>

        {/* Staff Chat — overlay disponible en esta vista full-screen */}
        <StaffChat
            open={staffChatOpen}
            onClose={() => setStaffChatOpen(false)}
            onUnreadChange={setStaffChatUnread}
        />

        {/* Quick Actions Hub — los 4 chips del /care, montados como modal aquí. */}
        {user?.id && (
            <QuickActionsHub
                open={quickActionsOpen}
                onClose={() => setQuickActionsOpen(false)}
                currentUserId={user.id as string}
            />
        )}
        </>
    );
}
