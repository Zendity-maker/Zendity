"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Loader2, Menu, Moon, Sun, Bell, ClipboardList, LayoutGrid, LayoutList, X, MessageSquare, AlertTriangle, CheckCircle2, Users as UsersIcon, Info, Sparkles, Sunrise, UserCheck, FileText, ArrowRight } from "lucide-react";
import CoveragePickerModal, { type CoverageColorOption } from "@/components/care/CoveragePickerModal";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import EmergencyPdfButton from "@/components/medical/patient/EmergencyPdfButton";
import ZendiMomentsWidget from "@/components/care/zendi/ZendiMomentsWidget";
import ZendiNursingWidget from "@/components/care/ZendiNursingWidget";
import MyObservationsWidget from "@/components/care/MyObservationsWidget";
import ZendiCameraEnhancer from "@/components/care/ZendiCameraEnhancer";
import SignatureCanvas from "react-signature-canvas";
import ShiftClosureWizard from "@/components/care/ShiftClosureWizard";
import FallIncidentPrint from "@/components/medical/fall-risk/FallIncidentPrint";
import ZendiAssist from "@/components/ZendiAssist";
import StaffChat from "@/components/StaffChat";
import { Toaster, toast } from 'sonner';

function getCurrentShift(): 'MORNING' | 'EVENING' | 'NIGHT' {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'MORNING';
    if (hour >= 14 && hour < 22) return 'EVENING';
    return 'NIGHT';
}

function parseTimeTo24h(timeStr: string): number {
    if (!timeStr) return 0;
    const upper = timeStr.toUpperCase().trim();
    const isPM = upper.includes('PM');
    const isAM = upper.includes('AM');
    const timePart = upper.replace('AM', '').replace('PM', '').trim();
    const hours = parseInt(timePart.split(':')[0]);

    if (isPM && hours !== 12) return hours + 12;
    if (isAM && hours === 12) return 0;
    return hours;
}

function getMedsForCurrentShift(medications: any[]) {
    const shift = getCurrentShift();
    return medications.filter(m => {
        if (!m.scheduleTimes) return false;
        const times = m.scheduleTimes.split(',').map((t: string) => t.trim());
        return times.some((time: string) => {
            const hour = parseTimeTo24h(time);
            if (shift === 'NIGHT') return hour >= 22 || hour <= 5;
            if (shift === 'MORNING') return hour >= 6 && hour <= 13;
            return hour >= 14 && hour <= 21; // EVENING
        });
    });
}

// ── Flujo de packs de medicamentos (tablet cuidador) ──────────────────────────
// Los meds se agrupan por slot HH:MM dentro del turno. Cada pack comparte firma única.
// La administración resuelta hoy (ADMINISTERED/OMITTED/REFUSED) se lee de
// `m.administrations` que el endpoint /api/care ya entrega filtrado al día AST.

// Parse "08:00" / "8:00 AM" / "14:30" → minutos-desde-medianoche (0..1439). -1 si inválido.
function parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return -1;
    const s = timeStr.trim().toUpperCase();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (!m) return -1;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3];
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
    return h * 60 + min;
}

// Minutos → etiqueta canónica "8:00 AM" / "12:00 PM" (clave estable para scheduleTime en DB)
function formatSlotLabel(minutes: number): string {
    const h24 = Math.floor(minutes / 60);
    const min = minutes % 60;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const h12 = (h24 % 12) || 12;
    return `${h12}:${min.toString().padStart(2, '0')} ${ap}`;
}

// ¿El slot (en minutos) cae en el turno? Mismas ventanas que getMedsForCurrentShift.
function slotInShift(minutes: number, shift: string): boolean {
    const h = Math.floor(minutes / 60);
    if (shift === 'NIGHT') return h >= 22 || h < 6;
    if (shift === 'MORNING') return h >= 6 && h < 14;
    return h >= 14 && h < 22; // EVENING
}

// Agrupa los medicamentos por slot del turno actual.
// Retorna: [{ label: "8:00 AM", slotMinutes: 480, meds: [PatientMedication...] }, ...]
// ordenados cronológicamente (NIGHT: 22:00→05:59 continuos).
function groupMedsByScheduleTime(medications: any[]) {
    const shift = getCurrentShift();
    const groups: Record<string, { slotMinutes: number; meds: any[] }> = {};
    medications.forEach(m => {
        if (!m.scheduleTimes) return;
        const times = m.scheduleTimes.split(',').map((t: string) => t.trim());
        times.forEach((t: string) => {
            const min = parseTimeToMinutes(t);
            if (min < 0) return;
            if (!slotInShift(min, shift)) return;
            const label = formatSlotLabel(min);
            if (!groups[label]) groups[label] = { slotMinutes: min, meds: [] };
            // Evitar duplicar el mismo med en el mismo slot (si CSV repetido)
            if (!groups[label].meds.find((x: any) => x.id === m.id)) {
                groups[label].meds.push(m);
            }
        });
    });
    const entries = Object.entries(groups).map(([label, v]) => ({ label, slotMinutes: v.slotMinutes, meds: v.meds }));
    entries.sort((a, b) => {
        if (shift === 'NIGHT') {
            // 22:00..23:59 va antes que 00:00..05:59
            const na = a.slotMinutes < 360 ? a.slotMinutes + 1440 : a.slotMinutes;
            const nb = b.slotMinutes < 360 ? b.slotMinutes + 1440 : b.slotMinutes;
            return na - nb;
        }
        return a.slotMinutes - b.slotMinutes;
    });
    return entries;
}

// Estado hoy del med en ese slot: 'ADMINISTERED' | 'OMITTED' | 'REFUSED' | null
function slotStatusToday(med: any, slotLabel: string): string | null {
    const admins = med.administrations || [];
    const found = admins.find((a: any) =>
        a.scheduleTime === slotLabel && ['ADMINISTERED', 'OMITTED', 'REFUSED'].includes(a.status)
    );
    return found ? found.status : null;
}

// Pack completo: todos sus meds tienen un status resolvido hoy para ese slot.
function isPackComplete(pack: { label: string; meds: any[] }): boolean {
    return pack.meds.every(m => slotStatusToday(m, pack.label) !== null);
}

export default function ZendityCareTabletPage() {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    const { user, logout } = useAuth();
    const router = useRouter();

    // FASE 51: doble rol — ej. SUPERVISOR con secondaryRoles=['CAREGIVER'].
    // Usar este flag en lugar de `user?.role === 'CAREGIVER'` para que los
    // usuarios con rol secundario de cuidadora accedan a todas las funciones
    // clínicas del tablet (iniciar turno, ver residentes, vitales, etc.).
    const CLINICAL_ROLES = ['CAREGIVER', 'NURSE'];
    const isActingAsCaregiver =
        CLINICAL_ROLES.includes(user?.role as string) ||
        (user?.secondaryRoles || []).some(r => CLINICAL_ROLES.includes(r));

    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [patients, setPatients] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Gamification Logic
    const getZendityRank = (score: number) => {
        if (score >= 95) return { label: 'Maestro Clínico', badge: 'bg-gradient-to-r from-slate-200 to-white text-slate-800 shadow-[0_0_15px_rgba(255,255,255,0.8)]', icon: '' };
        if (score >= 80) return { label: 'Élite', badge: 'bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-900 shadow-[0_0_15px_rgba(251,191,36,0.8)]', icon: '' };
        if (score >= 60) return { label: 'Especialista', badge: 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 shadow-[0_0_10px_rgba(148,163,184,0.5)]', icon: '' };
        return { label: 'Novato', badge: 'bg-gradient-to-r from-orange-300 to-orange-400 text-orange-900', icon: '' };
    };

    // Shift Session (Clock-In) Core
    const [activeSession, setActiveSession] = useState<any>(null);
    const [verifyingCensus, setVerifyingCensus] = useState(false);
    const [censusChecklist, setCensusChecklist] = useState<Record<string, string>>({});
    const [sessionLoading, setSessionLoading] = useState(true);

    // Zendi Welcome Briefing (Fase 10)
    const [briefingMode, setBriefingMode] = useState(false);
    const [briefingData, setBriefingData] = useState<any>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showQuickRead, setShowQuickRead] = useState(false);

    // Sprint N.4 — Cobertura en vivo para el selector de color
    const [coverage, setCoverage] = useState<any>(null);
    const [coverageLoading, setCoverageLoading] = useState(false);
    const [coveragePickerOpen, setCoveragePickerOpen] = useState(false);
    const [coverageSubmitting, setCoverageSubmitting] = useState(false);

    // Fetch cobertura antes de mostrar el selector de color.
    // Degradación elegante: si falla, los chips no aparecen pero los
    // botones siguen funcionando como antes.
    useEffect(() => {
        if (selectedColor || briefingMode || verifyingCensus || activeSession) return;
        if (coverage || coverageLoading) return;
        const fetchCov = async () => {
            setCoverageLoading(true);
            try {
                const res = await fetch('/api/care/shift/coverage');
                const data = await res.json();
                if (data.success) setCoverage(data);
            } catch (e) {
                console.error('[coverage fetch]', e);
            } finally {
                setCoverageLoading(false);
            }
        };
        fetchCov();
    }, [selectedColor, briefingMode, verifyingCensus, activeSession, coverage, coverageLoading]);

    // Modals Data
    const [activePatient, setActivePatient] = useState<any>(null);
    const [modalType, setModalType] = useState<"VITALS" | "LOG" | "MEDS" | "FALL" | "HUB" | "HOSPITAL_TRANSFER" | "PROGRESS_NOTE_PDF" | "ACCEPT_HANDOVER" | "DIET_CHANGE" | "FAST_ACTION_DISPATCH" | "PREVENTIVE" | "VITALS_HISTORY" | "SHIFT_CLOSURE_WIZARD" | null>(null);

    const isNightHours = () => { const h = new Date().getHours(); return h >= 22 || h < 6; };
    const [isNightMode, setIsNightMode] = useState(() => isNightHours());
    const [hospitalReason, setHospitalReason] = useState("");
    const [dietFormValue, setDietFormValue] = useState("Regular (Sólida)");
    const [pdfNoteData, setPdfNoteData] = useState<any>(null);
    const [hubAction, setHubAction] = useState<"COMPLAINT" | "CLINICAL" | "MAINTENANCE" | "UPP_ALERT" | null>(null);
    const [pendingShiftType, setPendingShiftType] = useState<"MORNING" | "EVENING" | "NIGHT" | null>(null);
    const [pendingHandoverToAccept, setPendingHandoverToAccept] = useState<any>(null);

    const [zendiToast, setZendiToast] = useState("");

    // Mis Reportes de Hoy
    const [myReports, setMyReports] = useState<any[]>([]);
    const [showMyReports, setShowMyReports] = useState(false);
    const [loadingMyReports, setLoadingMyReports] = useState(false);

    // Sidebar & Grid View States
    const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
    const [mobileDrawer, setMobileDrawer] = useState(false);
    const [gridView, setGridView] = useState<'1col' | '2col'>('1col');
    useEffect(() => { if (window.innerWidth >= 768) setGridView('2col'); }, []);

    // Auto-toggle Night Rounds Mode entre 10pm y 6am
    useEffect(() => {
        const interval = setInterval(() => {
            const shouldBeNight = isNightHours();
            setIsNightMode(prev => { if (prev !== shouldBeNight) return shouldBeNight; return prev; });
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Form States & Shadow AI
    const [vitals, setVitals] = useState({ sys: "", dia: "", temp: "", hr: "", glucose: "", spo2: "" });
    // Campos con error al intentar guardar vitales sin completar (sys/dia/hr/temp obligatorios)
    const [vitalsErrors, setVitalsErrors] = useState<{ sys: boolean; dia: boolean; hr: boolean; temp: boolean }>({ sys: false, dia: false, hr: false, temp: false });
    // Orden de vitales vencida → modal de justificación tardía (20 chars mín, -2 cumplimiento)
    const [lateReasonOpen, setLateReasonOpen] = useState(false);
    const [lateReasonDraft, setLateReasonDraft] = useState("");
    const [fastActions, setFastActions] = useState<any[]>([]);
    // Chat interno staff + notificaciones (ambos separados del HUB de acciones)
    const [staffChatOpen, setStaffChatOpen] = useState(false);
    const [staffChatUnread, setStaffChatUnread] = useState(0);
    const [notifsOpen, setNotifsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);

    // Fetch de notificaciones propias (campana del topbar)
    useEffect(() => {
        if (!user?.id) return;
        const load = async () => {
            try {
                const res = await fetch(`/api/notifications?userId=${user.id}`);
                const data = await res.json();
                if (data.success) setNotifications(data.notifications || []);
            } catch (e) { console.error('[notifs fetch]', e); }
        };
        load();
        const int = setInterval(load, 30000);
        return () => clearInterval(int);
    }, [user?.id]);

    // Click-outside del panel de notificaciones
    useEffect(() => {
        if (!notifsOpen) return;
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [notifsOpen]);
    const [dailyLog, setDailyLog] = useState<{ bathCompleted: boolean; foodIntake: number; notes: string; selectedMeal?: string }>({ bathCompleted: false, foodIntake: 100, notes: "", selectedMeal: undefined });

    // BUG FIX baños: derivar el estado de "baño completado hoy" directamente
    // del residente activo, NO de un flag global en dailyLog.
    // Antes: setDailyLog(bathCompleted=true) marcaba TODOS los botones de baño
    // como disabled al cambiar de residente. Ahora el botón refleja el estado
    // real del `activePatient` y se habilita correctamente por paciente.
    const bathCompletedToday = useMemo(() => {
        if (!activePatient?.bathLogs || activePatient.bathLogs.length === 0) return false;
        const today = new Date();
        return activePatient.bathLogs.some((log: any) => {
            const logDate = new Date(log.timeLogged || log.createdAt);
            return logDate.toDateString() === today.toDateString();
        });
    }, [activePatient]);
    const [fallProtocol, setFallProtocol] = useState({ consciousness: true, bleeding: false, painLevel: 5 });
    const [prnNote, setPrnNote] = useState("");
    const [omissionNote, setOmissionNote] = useState("");
    const [activeMedAction, setActiveMedAction] = useState<'PRN' | 'OMISSION' | null>(null);
    const sigCanvas = useRef<any>(null); // FASE 60: eMAR Digital Signature
    const packSigCanvas = useRef<any>(null); // Firma del pack (flujo secuencial por slot)
    // Flujo por pack — omisión individual
    const [omittingMed, setOmittingMed] = useState<{ id: string; name: string; slotLabel: string } | null>(null);
    const OMIT_REASONS = [
        'Residente lo rechazó',
        'Residente en procedimiento',
        'Medicamento no disponible',
        'Indicación médica',
        'Otro'
    ];
    const [omitReasonCat, setOmitReasonCat] = useState<string>(OMIT_REASONS[0]);
    const [omitReasonText, setOmitReasonText] = useState<string>("");
    const [packJustCompleted, setPackJustCompleted] = useState<string | null>(null); // slotLabel para la animación ✓
    const [submitting, setSubmitting] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [formattingNotes, setFormattingNotes] = useState(false);
    
    // Preventive Hub
    const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
    const [preventiveNote, setPreventiveNote] = useState("");
    const [isSavingFastAction, setIsSavingFastAction] = useState(false);

    const logNightRound = async (patientId: string, type: 'SECO' | 'HUMEDO' | 'EVACUACION' | 'ROTACION', position?: string) => {
        setIsSavingFastAction(true);
        try {
            const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch("/api/care/rounds", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId, authorId: user?.id, hqId, type, position })
            });
            if (res.ok) {
                // Notificación visual de éxito (Silent refresh)
                const updatedPatients = [...patients]; // Mock local optimista no es necesario, UI UX is fast
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingFastAction(false);
        }
    };

    // Night Rounds Engine 2-Hour SLA
    const [nightRoundStatus, setNightRoundStatus] = useState<'SLEEPING' | 'AWAKE' | 'ANOMALY' | null>(null);
    const [nightRoundNote, setNightRoundNote] = useState("");
    const [nightRoundSLA, setNightRoundSLA] = useState<number | null>(null);

    // Action Hub States
    const [hubPatientId, setHubPatientId] = useState("");
    const [hubDescription, setHubDescription] = useState("");
    const [hubPhotoBase64, setHubPhotoBase64] = useState<string | null>(null);

    // Fast Action Dispatch (Supervisor)
    const [hubCaregiverId, setHubCaregiverId] = useState("");
    const [hubCaregiversList, setHubCaregiversList] = useState<any[]>([]);

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setHubPhotoBase64(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleDietUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch(`/api/corporate/patients/${activePatient.id}/diet`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ diet: dietFormValue })
            });
            const data = await res.json();
            if (data.success) {
                setModalType(null);
                setZendiToast(`Dieta del residente sincronizada a ${dietFormValue}.`);
                setPatients(patients.map(p => p.id === activePatient.id ? { ...p, diet: dietFormValue } : p));
                setTimeout(() => setZendiToast(""), 3500);
            } else {
                alert("Error al actualizar la dieta.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    // ==========================================
    // WAKE RECOVERY: Mantenimiento SLA Zendi
    // ==========================================
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && selectedColor) {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                refreshPatientsSilently(selectedColor);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [selectedColor]);



    // ==========================================
    // FASE 30: CLOCK-IN & CENSUS VERIFICATION
    // ==========================================
    const currentHour = new Date().getHours();
    const isNightShift = currentHour >= 22 || currentHour < 6;

    useEffect(() => {
        if (!user) return;
        const checkSession = async () => {
            try {
                const hq = user?.hqId || user?.headquartersId || "";
                const res = await fetch(`/api/care/shift/start?caregiverId=${user.id}`);
                const data = await res.json();
                if (data.success && data.activeSession) {
                    setActiveSession(data.activeSession);

                    // 1. Intentar obtener color del Schedule Builder primero
                    if (hq) {
                        const colorRes = await fetch(`/api/hr/schedule/my-color?userId=${user.id}&hqId=${hq}`);
                        const colorData = await colorRes.json();
                        if (colorData.success && colorData.color) {
                            // color puede ser un grupo (RED/YELLOW/...) o 'ALL' (cuidador solitario o turno asignado "Todos")
                            const effective = colorData.color;
                            setSelectedColor(effective);
                            localStorage.setItem('zendityCareShiftColor', effective);
                            const patientRes = await fetch(`/api/care?color=${effective}&hqId=${hq}`);
                            const patientData = await patientRes.json();
                            if (patientData.success) {
                                setPatients(patientData.patients || []);
                                setEvents(patientData.events || []);
                            }
                            return; // No necesita elegir manualmente
                        }
                        // Shift existe pero sin colorGroup (ej. KITCHEN/MAINTENANCE):
                        // NO caer a localStorage — ese valor sería de otro turno y
                        // mostraría residentes que no corresponden. Dejar selector
                        // manual / sin residentes hasta que alguien asigne color.
                        if (colorData.source === 'no_color_assigned') {
                            setSelectedColor(null);
                            setPatients([]);
                            return;
                        }
                    }

                    // 2. Fallback: usar color guardado en localStorage (solo si
                    //    no hay shift hoy — caso cuidador que abre tablet fuera
                    //    de un shift programado).
                    const storedColor = localStorage.getItem('zendityCareShiftColor');
                    if (storedColor) {
                        setSelectedColor(storedColor);
                        const patientRes = await fetch(`/api/care?color=${storedColor}&hqId=${hq}`);
                        const patientData = await patientRes.json();
                        if (patientData.success) {
                            setPatients(patientData.patients || []);
                            setEvents(patientData.events || []);
                        }
                    }
                }
            } catch (error) {
                console.error("Session check error", error);
            } finally {
                setSessionLoading(false);
            }
        };
        checkSession();
    }, [user]);

    // Sprint N.4 — El sustituto/llegada tarde elige colores desde el modal.
    // Si el turno aún no existe, arrancamos el flujo normal con los colores
    // elegidos (como un startTurnAndBriefing multi-color). Si ya hay sesión
    // activa, llamamos claim-coverage para crear overrides LATE_COVER.
    const handleCoveragePickerSelect = async (colors: string[]) => {
        if (colors.length === 0) return;
        setCoverageSubmitting(true);
        try {
            const colorParam = colors.join(',');
            if (!activeSession) {
                // Sustituto iniciando turno — pasa a la verificación normal
                setCoveragePickerOpen(false);
                await startTurnAndBriefing(colorParam);
            } else {
                // Tomar cobertura sobre un turno ya activo
                const res = await fetch('/api/care/shift/claim-coverage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        colors,
                        shiftSessionId: activeSession.id,
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    setCoveragePickerOpen(false);
                    // Refrescar el coverage
                    setCoverage(null);
                    alert(`Tomaste cobertura de ${data.claimed} residentes.`);
                    // refresca pacientes visibles
                    if (selectedColor) refreshPatientsSilently(selectedColor);
                } else {
                    alert(data.error || 'Error tomando cobertura');
                }
            }
        } catch (e: any) {
            alert(e.message || 'Error de conexión');
        } finally {
            setCoverageSubmitting(false);
        }
    };

    const startTurnAndBriefing = async (color: string) => {
        setSelectedColor(color);
        localStorage.setItem('zendityCareShiftColor', color);
        if (!activeSession) {
            setLoading(true);
            try {
                const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
                const res = await fetch(`/api/care?color=${color}&hqId=${hq}`);
                const data = await res.json();
                if (data.success) {
                    setPatients(data.patients);
                    const initChecks: Record<string, string> = {};
                    data.patients.forEach((p: any) => {
                        if (p.status === 'TEMPORARY_LEAVE') initChecks[p.id] = p.leaveType || 'HOSPITAL';
                        else initChecks[p.id] = 'PRESENT';
                    });
                    setCensusChecklist(initChecks);
                    setEvents(data.events || []);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
            setVerifyingCensus(true);
            return;
        }
        continueToBriefing(color);
    };

    const confirmCensusAndClockIn = async () => {
        const calculatedCensus = Object.values(censusChecklist).filter(v => v === 'PRESENT').length;
        if (calculatedCensus < 0) return alert("Error calculando el censo de residentes presentes.");

        setSubmitting(true);
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch("/api/care/shift/start", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ caregiverId: user?.id, headquartersId: hq, initialCensus: calculatedCensus })
            });
            const data = await res.json();
            if (data.success) {
                setActiveSession(data.shiftSession);
                setVerifyingCensus(false);

                // FASE 44: Intercepción de lectura obligatoria
                if (data.requireHandoverAccept && data.pendingHandover) {
                    setPendingHandoverToAccept(data.pendingHandover);
                    setModalType('ACCEPT_HANDOVER');
                } else {
                    continueToBriefing(selectedColor!);
                }
            } else {
                alert("Error de Inicio de Turno: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const continueToBriefing = async (color: string) => {
        setBriefingMode(true);
        setShowQuickRead(false);
        setBriefingData(null);

        try {
            // Obtener Briefing de 12 horas desde Backend
            const calculatedCensus = activeSession ? undefined : Object.values(censusChecklist).filter(v => v === 'PRESENT').length;
            const res = await fetch("/api/care/briefing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ colorGroup: color, userName: user?.name, initialCensus: calculatedCensus })
            });
            const data = await res.json();
            if (data.success) {
                setBriefingData(data.briefing);
                synthesizeZendiBriefing(data.briefing.ttsMessage);
            } else {
                console.error("API Error Response:", data);
                const fallback = {
                    ttsMessage: "Hubo un pequeño retraso conectando al servidor de Inteligencia Clínica. Iniciando lectura visual.",
                    quickRead: { vitalsAlerts: 0, foodAlerts: 0, appointments: 0 }
                };
                setBriefingData(fallback);
                synthesizeZendiBriefing(fallback.ttsMessage);
            }
        } catch (e) {
            console.error("Fetch Exception:", e);
            setBriefingData({
                ttsMessage: "Sin conexión de red estable. Por favor revisa tus tableros visualmente.",
                quickRead: { vitalsAlerts: 0, foodAlerts: 0, appointments: 0 }
            });
            skipBriefing(); // Fallback inmediato manual
        }
    };

    const synthesizeZendiBriefing = async (text: string) => {
        setIsSpeaking(true);
        try {
            const res = await fetch("/api/zendi/speak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error("TTS failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
                setIsSpeaking(false);
                setShowQuickRead(true);
                URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
                setIsSpeaking(false);
                setShowQuickRead(true);
                URL.revokeObjectURL(url);
            };
            await audio.play();
        } catch (err) {
            console.error("Zendi voice error:", err);
            setIsSpeaking(false);
            setShowQuickRead(true);
        }
    };

    const skipBriefing = () => {
        setIsSpeaking(false);
        setShowQuickRead(true);
    };

    const enterCareFloor = () => {
        setIsSpeaking(false);
        setBriefingMode(false);
        fetchPatients(selectedColor!);
        fetchMyReports();
    };

    const fetchMyReports = async () => {
        if (!user?.id) return;
        setLoadingMyReports(true);
        try {
            const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch(`/api/care/my-reports?authorId=${user.id}&hqId=${hqId}`);
            const data = await res.json();
            if (data.success) setMyReports(data.reports);
        } catch (e) {
            console.error("Error fetching my reports:", e);
        } finally {
            setLoadingMyReports(false);
        }
    };
    // ==========================================

    // Shadow AI: Contextual Vitals
    useEffect(() => {
        if (modalType !== 'VITALS') { setAiSuggestion(null); return; }
        if (Number(vitals.temp) >= 99.2) {
            setAiSuggestion(" Zendity AI: Temperatura liminal. Se recomienda ofrecer aumento de ingesta hídrica preventiva y reassesment en 4 horas.");
        } else if (Number(vitals.sys) >= 140) {
            setAiSuggestion(" Zendity AI: Presión Sistólica > 140. Considere un lapso de relajación y volver a tomar la lectura.");
        } else if (Number(vitals.spo2) > 0 && Number(vitals.spo2) < 92) {
            setAiSuggestion(" Zendity AI: Alerta de Oxigenación (SpO2 < 92%). Evaluar dificultad respiratoria y notificar a la Enfermera a Cargo inmediatamente.");
        } else {
            setAiSuggestion(null);
        }
    }, [vitals.temp, vitals.sys, vitals.spo2, modalType]);

    // FASE 30: Zendi Time-Based Operational Notifier
    useEffect(() => {
        if (!selectedColor || !activeSession) return;
        const interval = setInterval(() => {
            const h = new Date().getHours();
            const m = new Date().getMinutes();
            if (h === 10 && m === 0) setZendiToast("Zendity: Recuerda que la ventana de desayunos cierra en 60 minutos.");
            if (h === 9 && m === 30) setZendiToast("Zendity: Últimos 30 minutos para registrar baños del turno AM. Recuerda el cooldown de 2 minutos por residente.");
            if (h === 11 && m === 0) setZendiToast("Zendity: La ventana de almuerzos está oficialmente abierta.");
            if (h === 16 && m === 0) setZendiToast("Zendity: La ventana de cenas está oficialmente abierta.");

            if (zendiToast !== "") {
                setTimeout(() => setZendiToast(""), 12000);
            }
        }, 60000); // Check each minute
        return () => clearInterval(interval);
    }, [selectedColor, activeSession, zendiToast]);

    const formatDailyLogWithAI = async () => {
        if (!dailyLog.notes) return;
        setFormattingNotes(true);
        try {
            const res = await fetch("/api/ai/shadow", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "FORMAT_NOTES", rawText: dailyLog.notes })
            });
            const data = await res.json();
            if (data.success) setDailyLog({ ...dailyLog, notes: data.formattedText });
        } catch (e) {
            console.error(e);
        } finally {
            setFormattingNotes(false);
        }
    };

    const fetchPatients = async (color: string) => {
        setLoading(true);
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch(`/api/care?color=${color}&hqId=${hq}`);
            const data = await res.json();
            if (data.success) {
                setPatients(data.patients);
                setEvents(data.events || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const refreshPatientsSilently = async (color: string) => {
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch(`/api/care?color=${color}&hqId=${hq}`);
            const data = await res.json();
            if (data.success) {
                setPatients(data.patients);
                setEvents(data.events || []);
                setActivePatient((prev: any) => {
                    if (!prev) return prev;
                    return data.patients.find((p: any) => p.id === prev.id) || prev;
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    // FASE 11: Fast Actions & 15-Min SLAs Polling
    const fetchFastActions = async () => {
        if (!user) return;
        try {
            const res = await fetch(`/api/care/fast-actions?caregiverId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setFastActions(data.tasks);
            }
        } catch (e) { console.error(e); }
    };

    const completeFastAction = async (taskId: string) => {
        try {
            const res = await fetch(`/api/care/fast-actions`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId })
            });
            const data = await res.json();
            if (data.success) {
                setZendiToast("Asignación de Supervisor competada a tiempo. ¡Excelente!");
                fetchFastActions();
            } else {
                setZendiToast(`Alerta: ${data.error}`);
                fetchFastActions();
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (activeSession) {
            fetchFastActions();
            const interval = setInterval(fetchFastActions, 15000); // 15 seconds polling
            return () => clearInterval(interval);
        }
    }, [activeSession]);

    // Polling de notificaciones FAMILY_VISIT cada 30s — muestra toast en tablet
    useEffect(() => {
        if (!user?.id) return;
        const checkNotifications = async () => {
            try {
                const res = await fetch(`/api/notifications/unread?type=FAMILY_VISIT`);
                const data = await res.json();
                if (data.notifications?.length > 0) {
                    data.notifications.forEach((n: any) => {
                        toast.info(n.title, {
                            description: n.message,
                            duration: 8000,
                        });
                    });
                    // Marcar como leídas
                    await fetch('/api/notifications/mark-read', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notificationIds: data.notifications.map((n: any) => n.id) })
                    });
                }
            } catch (e) {
                // silencioso
            }
        };
        checkNotifications();
        const interval = setInterval(checkNotifications, 30000);
        return () => clearInterval(interval);
    }, [user?.id]);

    const fetchCaregiversTarget = async () => {
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch(`/api/corporate/hr/staff?hqId=${hq}`); // We use the HR endpoint
            const data = await res.json();
            if (data.success) {
                // Filter only clinical staff
                const validStaff = data.staff.filter((u: any) => u.role === 'CAREGIVER' || u.role === 'NURSE' || u.role === 'SUPERVISOR');
                setHubCaregiversList(validStaff);
            }
        } catch (e) { console.error(e); }
    };

    const submitSupervisorFastAction = async () => {
        if (!hubCaregiverId || !hubDescription) return;
        setSubmitting(true);
        try {
            const hq = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch(`/api/care/fast-actions`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    headquartersId: hq,
                    supervisorId: user?.id || "unknown",
                    caregiverId: hubCaregiverId,
                    description: hubDescription
                })
            });
            const data = await res.json();
            if (data.success) {
                setModalType(null);
                setZendiToast("Asignación de SLA (15 min) ha sido disparada al tablet del cuidador exitosamente.");
                setHubDescription("");
                setHubCaregiverId("");
            } else {
                alert(data.error);
            }
        } catch (e) { console.error(e); } finally {
            setSubmitting(false);
        }
    };

    const submitVitals = async (lateReason?: string) => {
        // Validación sincronizada con backend: sys, dia, hr, temp son obligatorios
        const missing = {
            sys: !vitals.sys,
            dia: !vitals.dia,
            hr: !vitals.hr,
            temp: !vitals.temp,
        };
        const hasMissing = missing.sys || missing.dia || missing.hr || missing.temp;
        if (hasMissing) {
            setVitalsErrors(missing);
            alert("Completa los campos obligatorios: Sistólica, Diastólica, Pulso y Temperatura.");
            return;
        }
        setVitalsErrors({ sys: false, dia: false, hr: false, temp: false });
        setSubmitting(true);
        try {
            const payload = {
                patientId: activePatient.id,
                type: 'VITALS',
                data: lateReason ? { ...vitals, lateReason } : vitals
            };
            const res = await fetch("/api/care/vitals", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store"
            });
            const data = await res.json();
            if (data.success) {
                setVitals({ sys: "", dia: "", temp: "", hr: "", glucose: "", spo2: "" });
                setLateReasonOpen(false);
                setLateReasonDraft("");
                refreshPatientsSilently(selectedColor!);

                if (data.criticalAlert) {
                    alert(data.message);
                    setDailyLog({ bathCompleted: false, foodIntake: 100, notes: `[ALERTA VITALES] ${data.message} \n\nEscriba los detalles de lo sucedido: ` });
                    setModalType('LOG');
                } else {
                    setModalType(null);
                }
            } else if (data.requireLateReason) {
                // Orden vencida → pedir justificación tardía (20 chars mín, -2 cumplimiento)
                setLateReasonOpen(true);
            } else {
                alert("Error interno: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Flujo de packs: administrar pack completo con firma única ─────────────
    const administerPack = async (pack: { label: string; meds: any[] }) => {
        if (!packSigCanvas.current || packSigCanvas.current.isEmpty()) {
            return alert("Es mandatorio plasmar tu firma para administrar el pack.");
        }
        const signatureBase64 = packSigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        const medicationIds = pack.meds.map((m: any) => m.id);

        setSubmitting(true);
        try {
            const res = await fetch("/api/care/meds/bulk", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: 'ADMINISTER_PACK',
                    medicationIds,
                    scheduleTime: pack.label,
                    signatureBase64
                })
            });
            const data = await res.json();
            if (!data.success) {
                alert("Error: " + (data.error || "No se pudo administrar el pack"));
                return;
            }
            // Optimistic: inyectar el registro hoy para que isPackComplete cierre el pack sin esperar fetch
            const now = new Date().toISOString();
            setActivePatient((prev: any) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    medications: prev.medications.map((m: any) => medicationIds.includes(m.id)
                        ? { ...m, administrations: [...(m.administrations || []), { id: `optim-${m.id}-${pack.label}`, status: 'ADMINISTERED', scheduleTime: pack.label, createdAt: now }] }
                        : m
                    )
                };
            });
            packSigCanvas.current?.clear();
            setPackJustCompleted(pack.label);
            setTimeout(() => setPackJustCompleted(null), 1200);
            refreshPatientsSilently(selectedColor!);
        } catch (e) {
            console.error(e);
            alert("Error de red");
        } finally {
            setSubmitting(false);
        }
    };

    const confirmOmitMed = async (pack: { label: string; meds: any[] }) => {
        if (!omittingMed) return;
        const reasonText = omitReasonText.trim();
        if (reasonText.length < 10) {
            return alert("La razón de omisión debe tener mínimo 10 caracteres.");
        }
        const fullReason = `${omitReasonCat}: ${reasonText}`;
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/meds/bulk", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: 'OMIT',
                    medicationIds: [omittingMed.id],
                    scheduleTime: pack.label,
                    reason: fullReason
                })
            });
            const data = await res.json();
            if (!data.success) {
                alert("Error: " + (data.error || "No se pudo omitir"));
                return;
            }
            // Optimistic: marcar OMITTED localmente para que el pack avance si todos quedan resueltos
            const now = new Date().toISOString();
            const medIdOmitted = omittingMed.id;
            setActivePatient((prev: any) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    medications: prev.medications.map((m: any) => m.id === medIdOmitted
                        ? { ...m, administrations: [...(m.administrations || []), { id: `optim-omit-${m.id}-${pack.label}`, status: 'OMITTED', scheduleTime: pack.label, createdAt: now, notes: `Omitido: ${fullReason}` }] }
                        : m
                    )
                };
            });
            setOmittingMed(null);
            setOmitReasonText("");
            setOmitReasonCat(OMIT_REASONS[0]);
            refreshPatientsSilently(selectedColor!);
        } catch (e) {
            console.error(e);
            alert("Error de red");
        } finally {
            setSubmitting(false);
        }
    };

    const submitLog = async () => {
        setSubmitting(true);
        try {
            const payload = {
                patientId: activePatient.id,
                type: 'LOG',
                data: { ...dailyLog, isAlert: dailyLog.notes.toLowerCase().includes("alerta") }
            };
            const res = await fetch("/api/care/vitals", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setDailyLog({ bathCompleted: false, foodIntake: 100, notes: "" });
                refreshPatientsSilently(selectedColor!);
                setModalType(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const submitBulkMeds = async (action: 'PRN' | 'OMISSION') => {
        if (action === 'PRN' && !prnNote.trim()) return alert("Especifique qué medicamento PRN se administra.");
        if (action === 'OMISSION' && !omissionNote.trim()) return alert("Debe especificar la razón clínica de descontinuar/omitir.");

        let signatureBase64 = null;
        if (action === 'PRN' && sigCanvas.current) {
            if (sigCanvas.current.isEmpty()) {
                return alert(" Es mandatorio plasmar su Firma Electrónica para administrar medicamentos.");
            }
            signatureBase64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        }

        setSubmitting(true);
        try {
            const medicationIds = getMedsForCurrentShift(activePatient.medications).map((m: any) => m.id);
            if (medicationIds.length === 0) return alert("No hay medicamentos para procesar.");

            let finalNotes = "";
            if (action === 'PRN') finalNotes = `SOS/PRN Aplicado: ${prnNote}`;
            if (action === 'OMISSION') finalNotes = `Omitido/Rechazado: ${omissionNote}`;

            const res = await fetch("/api/care/meds/bulk", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    medicationIds,
                    notes: finalNotes,
                    signatureBase64
                })
            });
            const data = await res.json();
            if (data.success) {
                // No vaciamos meds — dejamos que refreshPatientsSilently + administraciones de hoy
                // recalculen el estado de packs. Cerrar el modal sí.
                refreshPatientsSilently(selectedColor!);
                setPrnNote("");
                setOmissionNote("");
                setActiveMedAction(null);
                sigCanvas.current?.clear();
                alert(` Zendity Care: ${data.count} medicamentos procesados exitosamente.`);
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleBathLog = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/adls/bath", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId: activePatient.id, caregiverId: user?.id, shiftSessionId: activeSession?.id })
            });
            const data = await res.json();
            if (data.success) {
                alert(" Baño registrado al sistema central.");
                // BUG FIX: añadir el nuevo BathLog al activePatient para que
                // `bathCompletedToday` (useMemo) se recalcule y el botón se
                // deshabilite SOLO para este residente, no para los demás.
                setActivePatient((prev: any) => prev ? {
                    ...prev,
                    bathLogs: [...(prev.bathLogs || []), data.bath || { timeLogged: new Date().toISOString() }]
                } : prev);
                refreshPatientsSilently(selectedColor!);
            } else {
                alert(` Alerta: ${data.message || data.error}`);
            }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleMealLog = async (mealType: string, quality: string) => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/adls/meal", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId: activePatient.id, caregiverId: user?.id, shiftSessionId: activeSession?.id, mealType, quality })
            });
            const data = await res.json();
            if (data.success) {
                alert(` Comida (${mealType}) registrada con métrica de consumo: ${quality}`);
                refreshPatientsSilently(selectedColor!);
            } else {
                alert(` Error Clínico: ${data.error}`);
            }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleLaundryLog = () => {
        setDailyLog(prev => ({ ...prev, notes: prev.notes + (prev.notes ? '\n' : '') + " Lavado de ropa e higienización completado." }));
        alert(" Tarea de lavandería añadida a la bitácora.");
    };

    const handleRoomCleaningLog = () => {
        setDailyLog(prev => ({ ...prev, notes: prev.notes + (prev.notes ? '\n' : '') + " Aseo de habitación y áreas adyacentes completado." }));
        alert(" Aseo de habitación añadido a la bitácora.");
    };

    const handleSecurityRound = () => {
        setDailyLog(prev => ({ ...prev, notes: prev.notes + (prev.notes ? '\n' : '') + " Ronda de seguridad sin novedades, residente descansando." }));
        // Old manual night round string push replaced by 2-Hour SLA engine
    };

    // FASE 110: 2-Hour SLA Night Rounds Engine
    useEffect(() => {
        if (modalType === 'LOG' && activePatient && isNightShift) {
            fetch(`/api/care/rounds/check?patientId=${activePatient.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setNightRoundSLA(data.minutesSinceLastRound);
                    }
                }).catch(e => console.error(e));
        }
    }, [activePatient, modalType, isNightShift]);

    const handleNightRoundSubmit = async () => {
        if (!nightRoundStatus) return alert("Selecciona el estado del residente (, , ).");
        if (nightRoundStatus === 'ANOMALY' && !nightRoundNote) return alert("Debes documentar la anomalía detectada.");
        
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/rounds", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: activePatient.id,
                    caregiverId: user?.id,
                    status: nightRoundStatus,
                    note: nightRoundNote
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(" Ronda de Noche sincronizada exitosamente.\\nSLA de 2 Horas reactivado (No podrás reportar a este residente hasta las próximas 2h).");
                setNightRoundStatus(null);
                setNightRoundNote("");
                setNightRoundSLA(0); // Lock it immediately
                refreshPatientsSilently(selectedColor!);
            } else {
                alert(` Error Clínico: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePressurePointAlert = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/incidents", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: activePatient.id,
                    headquartersId: user?.hqId || user?.headquartersId || "hq-demo-1",
                    type: 'ULCER',
                    severity: 'MEDIUM',
                    description: `Punto de Presión detectado durante el aseo. Se requiere inspección dermatológica preventiva de Úlcera.`,
                    biometricSignature: user?.id || "emergency-bypass"
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(" Alerta médica preventiva enviada a Enfermería.");
            }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handlePosturalChange = async (position: string) => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/postural", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: activePatient.id,
                    caregiverId: user?.id,
                    shiftSessionId: activeSession?.id,
                    position
                })
            });
            const data = await res.json();
            if (data.success) {
                let gamifiedMsg = "";
                if (data.pointsDelta > 0) gamifiedMsg = ` ¡Excelente tiempo clínico! +${data.pointsDelta} Puntos Zendity.`;
                else if (data.pointsDelta < 0) gamifiedMsg = ` Rotación atrasada. Zendity HR dedujo ${data.pointsDelta} Puntos por incumplimiento.`;

                alert(` Cambio Postural (${position}) registrado exitosamente.\n${gamifiedMsg}`);
                refreshPatientsSilently(selectedColor!);
                setActivePatient({
                    ...activePatient,
                    posturalChanges: [data.rotation, ...(activePatient.posturalChanges || [])]
                });
            } else {
                alert(` Error Clínico: ${data.error}`);
            }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const SYMPTOM_CATEGORIES = {
        "Gastrointestinal / Nutricional": ["Diarrea", "Vómito", "Sangre en excreta", "Estreñimiento", "Poco apetito", "Dificultad de tragado o ahogamiento"],
        "Respiratorio / Motor": ["Tos", "Mareos o desbalances", "Temblores", "Debilidad muscular", "Vaso vagal"],
        "Urinario / Piel": ["Fetidez en la orina", "Sangre en la orina", "Retención de líquido o edema", "Punto de presión o área roja", "Cambios en la piel", "Picor", "Laceraciones"],
        "Neurológico / Cognitivo": ["Somnolencia", "Alucinaciones", "Desorientación", "Pérdida de la memoria", "Sordera", "Ceguera"],
        "Psiquiátrico / Emocional": ["Agresividad", "Llanto sin razón aparente", "Insomnio", "Ansiedad", "Pensamientos suicidas", "Depresión o tristeza constante"]
    };

    const handlePreventiveSubmit = async () => {
        if (!selectedSymptom) return alert("Selecciona un síntoma de la lista.");
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/preventive", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: activePatient.id,
                    caregiverId: user?.id,
                    symptom: selectedSymptom,
                    aiNote: preventiveNote
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(` Acción Preventiva reportada exitosamente.\n +${data.pointsDelta} Puntos Zendity añadidos a tu perfil.`);
                setModalType(null);
                setSelectedSymptom(null);
                setPreventiveNote("");
                refreshPatientsSilently(selectedColor!);
            } else {
                alert(` Error Clínico: ${data.error}`);
            }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const [printingFallId, setPrintingFallId] = useState<string | null>(null);

    const submitFall = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/incidents", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: activePatient.id,
                    type: 'FALL',
                    // Campos estructurados — severidad/riskLevel se derivan en el backend
                    conscious: fallProtocol.consciousness,
                    bleeding: fallProtocol.bleeding,
                    painLevel: fallProtocol.painLevel,
                    description: `Residente sufrió caída. Consciente: ${fallProtocol.consciousness ? 'Sí' : 'No'}, Sangrado: ${fallProtocol.bleeding ? 'Sí' : 'No'}, Dolor ${fallProtocol.painLevel}/10`,
                })
            });
            const data = await res.json();
            if (data.success) {
                setFallProtocol({ consciousness: true, bleeding: false, painLevel: 5 });
                setModalType(null);
                // Si el cuidador acepta, abrimos el PDF de Reporte de Incidente
                const wantsPrint = confirm(`Alerta Roja enviada (Severidad: ${data.derivedSeverity || 'reportada'}). ¿Imprimir Reporte de Incidente ahora?`);
                if (wantsPrint && data.incident?.id) {
                    setPrintingFallId(data.incident.id);
                }
            } else {
                alert(` Error: ${data.error || 'No se pudo registrar la caída'}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const submitHospitalTransfer = async () => {
        setSubmitting(true);
        try {
            const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
            const res = await fetch("/api/care/hospitalize", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: activePatient.id,
                    reason: hospitalReason,
                    headquartersId: hqId,
                    caregiverId: user?.id
                })
            });
            const data = await res.json();

            if (data.success) {
                alert(" Traslado registrado. Abriendo Nota de Progreso Médica para impresión...");
                setPdfNoteData({ ...data.patient, transferReason: hospitalReason, printDate: new Date() });
                setHospitalReason("");
                setModalType('PROGRESS_NOTE_PDF');

                // Fetch de nuevo para que el residente se vea deshabilitado con status TEMPORARY_LEAVE
                fetchPatients(selectedColor!);
            } else {
                alert(` Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al procesar el traslado.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogoutAttempt = async () => {
        if (!activeSession) {
            router.push('/login');
            return;
        }

        // FASE NUEVA: Invocamos el Asistente de Entrega en vez de validar bloqueos rígidos
        setModalType('SHIFT_CLOSURE_WIZARD');
    };

    const submitHubReport = async () => {
        if (!hubPatientId || !hubDescription) return alert("Seleccione residente y agregue descripción.");
        setSubmitting(true);
        try {
            const hqId = user?.hqId || user?.headquartersId || "hq-demo-1";
            let endpoint = "";
            let payload: any = {
                patientId: hubPatientId,
                authorId: user?.id,
                description: hubDescription
            };

            if (hubAction === "COMPLAINT") {
                endpoint = "/api/care/reports/complaint";
                payload.type = "COMPLAINT";
                payload.photoUrl = hubPhotoBase64;
            } else if (hubAction === "UPP_ALERT") {
                endpoint = "/api/care/vitals";
                payload = {
                    patientId: hubPatientId,
                    authorId: user?.id,
                    type: 'LOG',
                    data: { bathCompleted: false, foodIntake: 100, notes: "[ALERTA UPP/PIEL] " + hubDescription, isAlert: true, photoUrl: hubPhotoBase64 }
                };
            } else if (hubAction === "CLINICAL") {
                endpoint = "/api/care/vitals"; // Reciclamos el de dailyLog pero con flag isAlert true
                payload = {
                    patientId: hubPatientId,
                    authorId: user?.id,
                    type: 'LOG',
                    data: { bathCompleted: false, foodIntake: 100, notes: "[ALERTA CLÍNICA] " + hubDescription, isAlert: true, photoUrl: hubPhotoBase64 }
                };
            } else if (hubAction === "MAINTENANCE") {
                endpoint = "/api/care/incidents"; // Endpoint de eventos generales
                payload = {
                    patientId: hubPatientId,
                    headquartersId: hqId,
                    type: 'OTHER',
                    severity: 'LOW',
                    description: "[MANTENIMIENTO] " + hubDescription,
                    biometricSignature: user?.id || "N/A",
                    photoUrl: hubPhotoBase64
                };
            }

            const res = await fetch(endpoint, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                alert(` Reporte de tipo ${hubAction} enviado a Central.`);
                setHubAction(null);
                setModalType(null);
                setHubDescription("");
                setHubPhotoBase64(null);
                fetchMyReports(); // Refrescar historial de reportes del cuidador
            } else {
                alert("Error al enviar reporte: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const returnResident = async (patientId: string) => {
        if (!confirm("¿Confirmar que el residente ha retornado a las instalaciones?")) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/corporate/patients/${patientId}/discharge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'RETURN', date: new Date() })
            });
            const data = await res.json();
            if (data.success) {
                alert("Retorno registrado exitosamente.");
                fetchPatients(selectedColor!); // Recargar la lista
            } else {
                alert("Error al registrar retorno: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const colorStyles: Record<string, string> = { RED: "bg-red-600", YELLOW: "bg-amber-500", GREEN: "bg-emerald-500", BLUE: "bg-blue-600" };

    // =========================================================
    // VIEW 1: SELECCIÓN DE TURNO Y COLOR ZONING
    // =========================================================
    if (sessionLoading) {
        return <div className="fixed inset-0 bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-500 animate-pulse">Sincronizando Sistema Zendity...</div>;
    }

    if (!selectedColor && !briefingMode && !verifyingCensus) {
        // Cobertura en vivo (puede ser null si el fetch falló o aún cargando)
        const cov = coverage;
        const coveredColors: string[] = cov?.coveredColors || [];
        const absentColors: string[] = cov?.absentColors || [];
        const alreadyRedistributed: string[] = cov?.alreadyRedistributed || [];
        const activeCaregivers: Array<{ userId: string; name: string; color: string | null }> = cov?.activeCaregivers || [];
        const activeOverrides: Array<{ originalColor: string; caregiverName: string }> = cov?.activeOverrides || [];

        // Mapa color → nombre del cuidador que lo cubre
        const caregiverByColor: Record<string, string> = {};
        for (const c of activeCaregivers) {
            if (c.color) caregiverByColor[c.color] = c.name;
        }

        // Detección de sustituto: el invokerId NO tiene ScheduledShift hoy.
        // Usamos las activeCaregivers del coverage: si el user está en la lista,
        // NO es sustituto (ya entró a su turno). Si no está Y tampoco tiene
        // scheduledShift, lo tratamos como sustituto — pero como el coverage
        // endpoint no reporta scheduledShifts por usuario, usamos heurística:
        // si el user no aparece en activeCaregivers Y todos los colores están
        // cubiertos, es candidato a sustituto y abrimos el modal al hacer click
        // en cualquier botón. (Happy path: botones funcionan normal.)

        const colorButtons: Array<{ color: string; label: string; className: string }> = [
            { color: 'RED', label: 'ROJO', className: 'bg-red-500 hover:bg-red-600' },
            { color: 'YELLOW', label: 'AMARILLO', className: 'bg-amber-400 hover:bg-amber-500' },
            { color: 'GREEN', label: 'VERDE', className: 'bg-emerald-500 hover:bg-emerald-600' },
            { color: 'BLUE', label: 'AZUL', className: 'bg-blue-500 hover:bg-blue-600' },
        ];

        const needsCoveragePicker = absentColors.length > 0 && !coverageLoading;

        // Construir opciones para el modal (solo colores ausentes o ya redistribuidos)
        const pickerOptions: CoverageColorOption[] = [...absentColors, ...alreadyRedistributed]
            .filter((c, i, arr) => arr.indexOf(c) === i) // dedup
            .map(color => {
                const redistTo = activeOverrides
                    .filter(o => o.originalColor === color)
                    .map(o => o.caregiverName);
                return {
                    color,
                    patientsCount: (cov?.uncoveredPatients || []).filter((p: any) => p.colorGroup === color).length
                        || redistTo.length,
                    status: redistTo.length > 0 ? 'already_redistributed' as const : 'absent' as const,
                    redistributedTo: redistTo.length > 0 ? redistTo : undefined,
                };
            });

        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-50">
                <div className="bg-white rounded-2xl p-8 md:p-10 max-w-3xl w-full text-center shadow-2xl animate-in zoom-in-95 relative flex flex-col items-center max-h-[95vh] overflow-y-auto">
                    <button
                        onClick={() => logout()}
                        className="absolute top-5 right-6 text-slate-500 font-bold text-sm hover:text-rose-500 transition-colors flex items-center gap-2"
                    >
                        <span>Cerrar Sesión / Salir</span>
                    </button>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2">{activeSession ? "Continúa tu Turno Activo" : "¿Cuál es tu color de Turno?"}</h1>
                    <p className="text-lg text-slate-500 mb-6 font-medium">Zonificación de Cuidadores (Zendity Care)</p>

                    {coverageLoading && (
                        <div className="mb-4 text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando cobertura…
                        </div>
                    )}

                    {needsCoveragePicker && (
                        <button
                            onClick={() => setCoveragePickerOpen(true)}
                            className="mb-5 w-full px-5 py-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-100 active:scale-95 transition-all"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            {absentColors.length} grupo{absentColors.length === 1 ? '' : 's'} sin cubrir — toca aquí si eres sustituto o vas a cubrir
                        </button>
                    )}

                    <div className="grid grid-cols-2 gap-4 md:gap-5 w-full">
                        {colorButtons.map(btn => {
                            const coveredBy = caregiverByColor[btn.color];
                            const isAbsent = absentColors.includes(btn.color);
                            const isRedist = alreadyRedistributed.includes(btn.color);
                            return (
                                <button
                                    key={btn.color}
                                    onClick={() => startTurnAndBriefing(btn.color)}
                                    className={`relative h-32 md:h-36 rounded-3xl ${btn.className} text-white font-black text-2xl md:text-3xl shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center gap-1`}
                                >
                                    {btn.label}
                                    {cov && (
                                        <>
                                            {coveredBy && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm max-w-[90%] truncate">
                                                    Cubierto · {coveredBy}
                                                </span>
                                            )}
                                            {!coveredBy && isAbsent && !isRedist && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-rose-900/30 px-2 py-1 rounded-full backdrop-blur-sm border border-white/30">
                                                    Sin cuidador
                                                </span>
                                            )}
                                            {isRedist && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-900/30 px-2 py-1 rounded-full backdrop-blur-sm border border-white/30">
                                                    Redistribuido
                                                </span>
                                            )}
                                            {!coveredBy && !isAbsent && !isRedist && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-900/30 px-2 py-1 rounded-full backdrop-blur-sm border border-white/30">
                                                    Disponible
                                                </span>
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => startTurnAndBriefing("ALL")}
                        className="mt-5 w-full h-14 rounded-3xl bg-slate-800 hover:bg-slate-900 text-white font-black text-base tracking-wide shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        title="Úsalo si eres el único cuidador en turno — verás todos los residentes sin filtro de color"
                    >
                        Todos los residentes (cuidador único)
                    </button>
                </div>

                <CoveragePickerModal
                    isOpen={coveragePickerOpen}
                    options={pickerOptions}
                    submitting={coverageSubmitting}
                    onClose={() => setCoveragePickerOpen(false)}
                    onSelect={handleCoveragePickerSelect}
                />
            </div>
        );
    }

    // =========================================================
    // VIEW 1.5: VERIFICACIÓN DE CENSO (CLOCK-IN)
    // =========================================================
    if (verifyingCensus && selectedColor) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-50">
                <div className="bg-white rounded-2xl p-10 max-w-4xl w-full text-center shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                    <h1 className="text-4xl font-black text-slate-800 mb-2">Verificación de Censo</h1>
                    <p className="text-lg text-slate-500 mb-6 font-medium">
                        Confirma el estatus actual de cada residente en el <span className="font-bold text-slate-800">Grupo {selectedColor}</span>.
                    </p>

                    {loading ? (
                        <div className="py-10 text-slate-500 font-bold animate-pulse">Cargando residentes del grupo...</div>
                    ) : (
                        <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-3 text-left">
                            {patients.length === 0 && <div className="text-center p-8 text-slate-500 font-bold border-2 border-dashed border-slate-200 rounded-2xl">No hay residentes activos en este grupo.</div>}
                            {patients.map(p => (
                                <div key={p.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-black text-lg">{p.name.charAt(0)}</div>
                                        <span className="font-bold text-slate-800 text-xl">{p.name}</span>
                                    </div>
                                    <div className="flex flex-wrap bg-slate-200 rounded-xl p-1 gap-1">
                                        <button onClick={() => setCensusChecklist({ ...censusChecklist, [p.id]: 'PRESENT' })} className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${censusChecklist[p.id] === 'PRESENT' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}> Presente</button>
                                        <button onClick={() => setCensusChecklist({ ...censusChecklist, [p.id]: 'HOSPITAL' })} className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${censusChecklist[p.id] === 'HOSPITAL' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}> Hospital</button>
                                        <button onClick={() => setCensusChecklist({ ...censusChecklist, [p.id]: 'FAMILY_VISIT' })} className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${censusChecklist[p.id] === 'FAMILY_VISIT' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}> Familia</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && (
                        <div className="mt-auto border-t border-slate-100 pt-6">
                            <div className="flex justify-between items-center mb-6 bg-indigo-50 p-4 rounded-2xl">
                                <span className="font-bold text-indigo-800">Censo Final a Reportar:</span>
                                <span className="text-3xl font-black text-indigo-600">{Object.values(censusChecklist).filter(v => v === 'PRESENT').length} Residentes</span>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => { setVerifyingCensus(false); setSelectedColor(null); }} className="px-8 py-5 bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 rounded-2xl transition-all">
                                    Volver
                                </button>
                                <button
                                    onClick={confirmCensusAndClockIn}
                                    disabled={submitting || patients.length === 0}
                                    className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl rounded-2xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                                >
                                    {submitting ? "Firmando Entrada..." : " Confirmar Censo y Escuchar Zendi"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // =========================================================
    // VIEW 2: ZENDI WELCOME BRIEFING (FASE 10 OVERLAY)
    // =========================================================
    if (briefingMode) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center p-8 z-50 text-white overflow-hidden">
                {/* Fondo Animado de Zendi */}
                <div className={`absolute w-96 h-96 blur-[100px] opacity-20 rounded-full transition-all duration-1000 ${isSpeaking ? 'bg-teal-400 scale-150 animate-pulse' : 'bg-indigo-600'}`}></div>

                {!briefingData ? (
                    <div className="text-center z-10 animate-pulse">
                        <div className="w-24 h-24 border-4 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto mb-6"></div>
                        <h2 className="text-2xl font-black tracking-widest uppercase">Escaneando Turno...</h2>
                        <p className="text-slate-500 mt-2">Zendi está recopilando signos vitales e historiales recientes.</p>
                    </div>
                ) : (
                    <div className="z-10 max-w-3xl w-full text-center animate-in slide-in-from-bottom-10 fade-in duration-700">

                        {/* Visual Zendi Orb */}
                        <div className="relative mx-auto w-32 h-32 mb-8 group">
                            <div className={`absolute inset-0 bg-teal-400 rounded-full blur-xl transition-all duration-300 ${isSpeaking ? 'opacity-80 scale-125 animate-pulse' : 'opacity-30'}`}></div>
                            <div className="relative w-full h-full bg-slate-800 border-2 border-slate-700 rounded-full shadow-2xl flex items-center justify-center text-4xl">
                                
                            </div>
                        </div>

                        <h1 className="text-4xl font-black mb-6 leading-tight max-w-2xl mx-auto">
                            {showQuickRead ? 'Resumen Visual del Turno' : 'Zendi Reporte Clínico'}
                        </h1>

                        {/* Text Narration (Simulating CC) */}
                        {!showQuickRead && (
                            <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl backdrop-blur-md mb-8">
                                <p className="text-xl leading-relaxed text-teal-100 font-medium">"{briefingData.ttsMessage}"</p>
                            </div>
                        )}

                        {/* Relevo del color anterior + Prólogo del día */}
                        {showQuickRead && briefingData.colorHandover && (
                            <div className="mb-6 bg-slate-800/80 border-2 border-teal-500/40 rounded-2xl p-6 backdrop-blur-sm text-left animate-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <UserCheck size={18} className="text-teal-400" />
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-teal-300">Relevo de tu turno anterior</h4>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {new Date(briefingData.colorHandover.closedAt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-300 font-semibold mb-3">
                                    Entregado por <span className="text-white font-black">{briefingData.colorHandover.fromCaregiver}</span>
                                </p>
                                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                    {(briefingData.colorHandover.report || '').replace(/[#*]/g, '').trim().slice(0, 300)}
                                    {(briefingData.colorHandover.report || '').length > 300 ? '…' : ''}
                                </p>
                                {briefingData.colorHandover.id && (
                                    <Link
                                        href={`/care/reports/${briefingData.colorHandover.id}`}
                                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 text-xs font-black uppercase tracking-wider transition-colors"
                                    >
                                        Ver reporte completo <ArrowRight size={14} />
                                    </Link>
                                )}
                            </div>
                        )}

                        {showQuickRead && briefingData.dailyPrologue && (
                            <div className="mb-8 bg-slate-800/80 border-2 border-amber-500/40 rounded-2xl p-6 backdrop-blur-sm text-left animate-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Sunrise size={18} className="text-amber-400" />
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-300">Prólogo del Día — Zendi</h4>
                                    </div>
                                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-200 uppercase tracking-widest">
                                        Generado a las 6:00 AM
                                    </span>
                                </div>
                                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                    {(briefingData.dailyPrologue.report || '').replace(/[#*]/g, '').trim().slice(0, 400)}
                                    {(briefingData.dailyPrologue.report || '').length > 400 ? '…' : ''}
                                </p>
                            </div>
                        )}

                        {/* Visual Quick Read Dashboard */}
                        {showQuickRead && (
                            <div className="grid grid-cols-3 gap-6 mb-10 animate-in zoom-in-95">
                                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 backdrop-blur-sm">
                                    <span className="text-5xl mb-4 block"></span>
                                    <h3 className="text-4xl font-black">{briefingData.quickRead.vitalsAlerts}</h3>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Alertas Viales Recientes</p>
                                </div>
                                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 backdrop-blur-sm">
                                    <span className="text-5xl mb-4 block"></span>
                                    <h3 className="text-4xl font-black">{briefingData.quickRead.foodAlerts}</h3>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Inapetencias 8Hrs</p>
                                </div>
                                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 backdrop-blur-sm">
                                    <span className="text-5xl mb-4 block"></span>
                                    <h3 className="text-4xl font-black">{briefingData.quickRead.appointments}</h3>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Citas Hoy</p>
                                </div>
                            </div>
                        )}

                        {/* Controls */}
                        <div className="flex gap-4 justify-center">
                            {!showQuickRead && (
                                <button onClick={skipBriefing} className="px-8 py-4 bg-slate-800 text-slate-500 font-bold rounded-full hover:bg-slate-700 transition">
                                     Omitir Audio (Lectura Rápida)
                                </button>
                            )}
                            {(showQuickRead || !isSpeaking) && (
                                <button onClick={enterCareFloor} className="px-10 py-5 bg-teal-500 text-slate-900 font-black text-xl rounded-full hover:scale-105 active:scale-95 shadow-xl shadow-teal-500/20 transition-all animate-bounce">
                                    Adelante, Iniciar Cuidados
                                </button>
                            )}
                        </div>

                    </div>
                )}
            </div>
        );
    }

    // =========================================================
    // VIEW 3: CARE FLOOR (DASHBOARD TRADICIONAL FASES 7/8)
    // =========================================================
    const hexColor = colorStyles[selectedColor!] || "bg-slate-500";

    if (!isMounted) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-indigo-500/50 animate-spin" />
        </div>
    );

    const shiftLabel = getCurrentShift() === 'MORNING' ? 'Mañana' : getCurrentShift() === 'EVENING' ? 'Tarde' : 'Noche';
    const colorChipMap: Record<string, string> = { RED: 'bg-red-500', YELLOW: 'bg-amber-400', GREEN: 'bg-emerald-500', BLUE: 'bg-blue-500', ALL: 'bg-slate-600' };
    const colorLabel = (c: string | null) => {
        if (!c) return '';
        if (c === 'ALL') return 'TODOS';
        return c;
    };

    const sidebarLinks = [
        ...(user?.role === 'NURSE' ? [{ href: '/care/vitals', icon: '💉', label: 'Vitales' }] : []),
        { href: '#', icon: '⚡', label: 'Acciones', onClick: () => { setHubAction(null); setModalType('HUB'); } },
        // FASE 51: supervisoras con rol secundario CAREGIVER también pueden despachar
        ...(user?.role === 'SUPERVISOR' || user?.role === 'DIRECTOR' || user?.role === 'ADMIN' || isActingAsCaregiver ? [{ href: '#', icon: '📌', label: 'Asignar', onClick: () => { setHubCaregiverId(""); setHubDescription(""); fetchCaregiversTarget(); setModalType('FAST_ACTION_DISPATCH'); } }] : []),
        { href: '/academy', icon: '🎓', label: 'Academy' },
        { href: '/care/profile', icon: '👤', label: 'Mi Perfil' },
        { href: '/cuidadores', icon: '📋', label: 'Life Plans' },
    ];

    // Campana del topbar → notificaciones reales (no fast actions)
    const notifCount = notifications.filter(n => !n.isRead).length;

    const markNotifRead = async (id: string) => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, ids: [id] }),
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) { console.error('[mark notif read]', e); }
    };

    const markAllNotifsRead = async () => {
        if (notifCount === 0) return;
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, all: true }),
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (e) { console.error('[mark all notifs read]', e); }
    };

    const timeAgoShort = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'ahora';
        if (mins < 60) return `hace ${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `hace ${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `hace ${days}d`;
    };

    const renderNotifIcon = (type: string) => {
        switch (type) {
            case 'TRIAGE':           return <AlertTriangle className="w-4 h-4 text-[#fca5a5] shrink-0" />;
            case 'EMAR_ALERT':
            case 'SHIFT_ALERT':      return <AlertTriangle className="w-4 h-4 text-[#E5A93D] shrink-0" />;
            case 'HANDOVER':         return <ClipboardList className="w-4 h-4 text-[#3CC6C4] shrink-0" />;
            case 'STAFF_MESSAGE':    return <MessageSquare className="w-4 h-4 text-[#93c5fd] shrink-0" />;
            case 'COURSE_COMPLETED': return <CheckCircle2 className="w-4 h-4 text-[#22A06B] shrink-0" />;
            case 'FAMILY_VISIT':     return <UsersIcon className="w-4 h-4 text-[#a78bfa] shrink-0" />;
            default:                 return <Info className="w-4 h-4 text-[#94a3b8] shrink-0" />;
        }
    };

    const handleNotifOpen = (notif: any) => {
        if (!notif.isRead) markNotifRead(notif.id);
        if (notif.type === 'STAFF_MESSAGE') {
            setNotifsOpen(false);
            setStaffChatOpen(true);
            return;
        }
        // Sprint S — link opcional en la notificación para navegación directa
        if (notif.link) {
            setNotifsOpen(false);
            router.push(notif.link);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f5f4] pb-20 flex [scroll-behavior:smooth]">
            <Toaster position="top-center" richColors />

            {/* ===== SIDEBAR — Desktop/Tablet (collapsible) ===== */}
            <aside className={`hidden md:flex flex-col bg-slate-800 border-r border-slate-700 sticky top-0 h-screen z-30 transition-all duration-200 ${sidebarOpen ? 'w-48' : 'w-14'}`}>
                <div className={`flex items-center gap-2 px-3 py-4 border-b border-slate-700 ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
                    <span className="text-teal-400 text-lg">⚕</span>
                    {sidebarOpen && <span className="text-teal-400 font-black text-sm tracking-widest uppercase whitespace-nowrap">Zendity</span>}
                </div>
                <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
                    {sidebarLinks.map((link, i) => (
                        <a
                            key={i}
                            href={link.onClick ? undefined : link.href}
                            onClick={(e) => { if (link.onClick) { e.preventDefault(); link.onClick(); setMobileDrawer(false); } }}
                            className={`flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors rounded-lg mx-2 ${sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}`}
                            title={!sidebarOpen ? link.label : undefined}
                        >
                            <span className="text-lg leading-none shrink-0">{link.icon}</span>
                            {sidebarOpen && <span className="text-sm font-bold whitespace-nowrap">{link.label}</span>}
                        </a>
                    ))}
                </nav>
                <div className={`border-t border-slate-700 px-3 py-3 ${sidebarOpen ? '' : 'flex justify-center'}`}>
                    {user?.photoUrl ? (
                        <img src={user.photoUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 border-teal-500" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-teal-700 border-2 border-teal-500 flex items-center justify-center text-white font-black text-xs">
                            {user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                        </div>
                    )}
                </div>
            </aside>

            {/* ===== MOBILE DRAWER OVERLAY ===== */}
            {mobileDrawer && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileDrawer(false)} />
                    <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-800 border-r border-slate-700 flex flex-col animate-in slide-in-from-left duration-200">
                        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
                            <span className="text-teal-400 font-black text-sm tracking-widest uppercase flex items-center gap-2"><span className="text-lg">⚕</span> Zendity</span>
                            <button onClick={() => setMobileDrawer(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
                            {sidebarLinks.map((link, i) => (
                                <a
                                    key={i}
                                    href={link.onClick ? undefined : link.href}
                                    onClick={(e) => { if (link.onClick) { e.preventDefault(); link.onClick(); } setMobileDrawer(false); }}
                                    className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors rounded-lg mx-2"
                                >
                                    <span className="text-lg leading-none">{link.icon}</span>
                                    <span className="text-sm font-bold">{link.label}</span>
                                </a>
                            ))}
                        </nav>
                    </aside>
                </div>
            )}

            {/* ===== MAIN CONTENT AREA ===== */}
            <div className="flex-1 flex flex-col min-w-0">

            {/* ===== TOPBAR — Dirección Cálido y Táctil ===== */}
            <div className="w-full bg-[#1F2D3A] py-3 px-4 md:px-6 flex items-center gap-3 text-white sticky top-0 z-40 shadow-[0_1px_0_rgba(0,0,0,0.2)]">
                {/* Hamburger */}
                <button
                    onClick={() => { if (typeof window !== 'undefined' && window.innerWidth < 768) { setMobileDrawer(!mobileDrawer); } else { setSidebarOpen(!sidebarOpen); } }}
                    className="w-10 h-10 flex items-center justify-center rounded-[10px] bg-white/10 hover:bg-white/15 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] shrink-0"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {/* Brand */}
                <h1 className="font-display text-base font-semibold tracking-tight whitespace-nowrap hidden sm:block">Zéndity Care</h1>

                {/* Divider */}
                <div className="w-px h-6 bg-white/15 hidden sm:block shrink-0" />

                {/* Chips: Turno + Grupo */}
                <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                        const shift = getCurrentShift();
                        const shiftStyles =
                            shift === 'MORNING' ? 'bg-[#fef3c7] text-[#92400e]' :
                            shift === 'EVENING' ? 'bg-[#dbeafe] text-[#1e40af]' :
                            'bg-[#1e293b] text-[#94a3b8] border border-white/10';
                        const shiftLabelClean =
                            shift === 'MORNING' ? 'Mañana' :
                            shift === 'EVENING' ? 'Tarde' : 'Noche';
                        return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-semibold whitespace-nowrap ${shiftStyles}`}>
                                {shift === 'MORNING' ? '☀️' : shift === 'EVENING' ? '🌅' : '🌙'} {shiftLabelClean}
                            </span>
                        );
                    })()}
                    {fastActions.length > 0 && (
                        <span className="inline-flex items-center bg-[#D9534F] text-white text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap">
                            {fastActions.length} SLA
                        </span>
                    )}
                    {(() => {
                        const zoneStyles: Record<string, string> = {
                            RED: 'bg-[#fee2e2] text-[#991b1b]',
                            YELLOW: 'bg-[#fef3c7] text-[#92400e]',
                            GREEN: 'bg-[#dcfce7] text-[#166534]',
                            BLUE: 'bg-[#dbeafe] text-[#1e40af]',
                            ALL: 'bg-white/10 text-white',
                        };
                        const dotMap: Record<string, string> = {
                            RED: 'bg-[#D9534F]',
                            YELLOW: 'bg-[#E5A93D]',
                            GREEN: 'bg-[#22A06B]',
                            BLUE: 'bg-[#3B82F6]',
                            ALL: 'bg-white/70',
                        };
                        const key = selectedColor || 'ALL';
                        return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-semibold whitespace-nowrap ${zoneStyles[key] || zoneStyles.ALL}`}>
                                <span className={`w-2 h-2 rounded-full ${dotMap[key] || dotMap.ALL}`} /> {colorLabel(selectedColor)}
                            </span>
                        );
                    })()}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Night mode toggle */}
                <button
                    onClick={() => setIsNightMode(!isNightMode)}
                    className={`flex items-center gap-1.5 px-3 h-9 rounded-[10px] text-[11px] font-semibold whitespace-nowrap transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] ${isNightMode ? 'bg-[#3CC6C4] text-[#1F2D3A]' : 'bg-white/10 text-white hover:opacity-85'}`}
                >
                    {isNightMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span className="hidden lg:inline">{isNightMode ? 'Normal' : 'Rondas'}</span>
                </button>

                {/* Chat interno staff */}
                <button
                    onClick={() => setStaffChatOpen(v => !v)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-[10px] bg-white/10 hover:bg-white/20 transition-colors"
                    title="Chat interno"
                >
                    <MessageSquare className="w-4 h-4 text-white" />
                    {staffChatUnread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#3CC6C4] rounded-full text-[9px] font-bold text-[#1F2D3A] flex items-center justify-center leading-none">
                            {staffChatUnread > 9 ? '9+' : staffChatUnread}
                        </span>
                    )}
                </button>

                {/* Notificaciones reales */}
                <div ref={notifRef} className="relative">
                    <button
                        onClick={() => setNotifsOpen(v => !v)}
                        className="relative w-9 h-9 flex items-center justify-center rounded-[10px] bg-white/10 hover:bg-white/20 transition-colors"
                        title="Notificaciones"
                    >
                        <Bell className="w-4 h-4 text-white" />
                        {notifCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#D9534F] rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none border-2 border-[#1F2D3A]">
                                {notifCount > 9 ? '9+' : notifCount}
                            </span>
                        )}
                    </button>

                    {notifsOpen && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-[#1F2D3A] border border-[#2a3b4d] rounded-[16px] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-3 border-b border-[#2a3b4d] flex items-center justify-between">
                                <h4 className="font-display text-sm font-semibold text-white">Notificaciones</h4>
                                <div className="flex items-center gap-2">
                                    {notifCount > 0 && (
                                        <button onClick={markAllNotifsRead} className="text-[10px] font-semibold text-[#3CC6C4] hover:opacity-80 transition-opacity">
                                            Marcar todas
                                        </button>
                                    )}
                                    <button onClick={() => setNotifsOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                                        <X className="w-3.5 h-3.5 text-[#94a3b8]" />
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-10 text-center">
                                        <Bell className="w-7 h-7 text-[#2a3b4d] mx-auto mb-2" />
                                        <p className="text-[12px] text-[#94a3b8] font-medium">No hay notificaciones nuevas</p>
                                    </div>
                                ) : notifications.map(n => (
                                    <button
                                        key={n.id}
                                        onClick={() => handleNotifOpen(n)}
                                        className={`w-full text-left px-4 py-3 border-b border-[#2a3b4d] flex items-start gap-3 transition-colors ${!n.isRead ? 'bg-[#3CC6C4]/8 hover:bg-[#3CC6C4]/15' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="mt-0.5">{renderNotifIcon(n.type)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[12px] truncate ${!n.isRead ? 'font-semibold text-white' : 'font-medium text-[#cbd5e1]'}`}>{n.title}</p>
                                            <p className="text-[11px] text-[#94a3b8] mt-0.5 line-clamp-2">{n.message}</p>
                                        </div>
                                        <span className="text-[10px] text-[#64748b] font-medium shrink-0 mt-0.5 whitespace-nowrap">{timeAgoShort(n.createdAt)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Entregar Turno — outline blanco */}
                <button
                    onClick={handleLogoutAttempt}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-[10px] border border-white/30 hover:border-white/60 bg-transparent text-[11px] font-semibold whitespace-nowrap transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97]"
                >
                    <ClipboardList className="w-4 h-4" />
                    <span className="hidden lg:inline">Entregar Turno</span>
                </button>

                {/* Avatar */}
                {user?.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-9 h-9 rounded-[10px] object-cover shrink-0" />
                ) : (
                    <div className="w-9 h-9 rounded-[10px] bg-[#3CC6C4] flex items-center justify-center text-[#1F2D3A] font-display font-semibold text-xs shrink-0">
                        {user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                    </div>
                )}
            </div>

            {/* SPRINT 1 UX: Contextual SLA Banner (Estable, Pendiente, Advertencia, Crítico) */}
            {fastActions.length > 0 && (
                <div className={`text-white px-8 py-4 w-full font-bold flex flex-col md:flex-row justify-between items-center z-30 shadow-md gap-4 transition-all ${fastActions.length > 2 ? 'bg-rose-600' : (fastActions.length > 1 ? 'bg-amber-600' : 'bg-emerald-600')}`}>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <span className={`text-3xl drop-shadow-md ${fastActions.length > 2 ? 'animate-pulse' : ''}`}>{fastActions.length > 2 ? '🚨' : (fastActions.length > 1 ? '⚠️' : '✅')}</span>
                        <div className="flex-1">
                            <p className="text-sm uppercase tracking-wider text-white/80 font-black">
                                {fastActions.length > 2 ? 'ESTADO CRÍTICO (SLA)' : (fastActions.length > 1 ? 'ADVERTENCIA: ACUMULACIÓN SLA' : 'ESTADO PENDIENTE (SLA NORMAL)')}
                                 ({fastActions.length} Pendiente{fastActions.length !== 1 && 's'})
                            </p>
                            <p className="text-base font-bold text-white mt-0.5">{fastActions[0].description}</p>
                        </div>
                    </div>
                    <button onClick={() => completeFastAction(fastActions[0].id)} className={`bg-white px-8 py-3.5 rounded-xl font-black active:scale-95 shadow-sm transform hover:-translate-y-0.5 transition w-full md:w-auto text-base min-h-[56px] flex items-center justify-center ${fastActions.length > 2 ? 'text-rose-700' : (fastActions.length > 1 ? 'text-amber-700' : 'text-emerald-700')}`}>
                         Confirmar Realización
                    </button>
                </div>
            )}

            <div className="max-w-7xl mx-auto p-8">
                <div className="mb-4 flex flex-wrap gap-3">
                    <MyObservationsWidget />
                </div>
                <ZendiMomentsWidget />
                {/* ZendiNursingWidget — solo visible para enfermeras y roles con acceso de enfermería */}
                {(user?.role === 'NURSE' || (user?.secondaryRoles || []).includes('NURSE')) && (
                    <ZendiNursingWidget />
                )}

                {events.length > 0 && (
                    <div className="mb-8 flex flex-col gap-3">
                        {events.map((e: any) => {
                            const timeStr = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={e.id} className="bg-amber-100 border-l-8 border-amber-500 p-4 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white text-xl"></div>
                                        <div>
                                            <p className="font-bold text-amber-900 leading-tight">Calendario: {e.title}</p>
                                            <p className="text-sm font-medium text-amber-700">
                                                Hoy a las {timeStr} {e.patient ? ` Residente: ${e.patient.name}` : ' Actividad Global'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-amber-600/50 font-black text-xs uppercase tracking-widest">{e.type}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Mis Reportes de Hoy (Action Hub) */}
                {myReports.length > 0 && (
                    <div className="mb-8">
                        <button
                            onClick={() => setShowMyReports(!showMyReports)}
                            className="w-full flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 p-4 rounded-2xl transition-all shadow-sm"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white text-lg">
                                    <ClipboardList className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-indigo-900 text-sm">Mis Reportes de Hoy</p>
                                    <p className="text-xs text-indigo-600 font-medium">{myReports.length} reporte{myReports.length !== 1 ? 's' : ''} enviado{myReports.length !== 1 ? 's' : ''} al supervisor</p>
                                </div>
                            </div>
                            <svg className={`w-5 h-5 text-indigo-400 transition-transform ${showMyReports ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showMyReports && (
                            <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                                {myReports.map((r: any) => {
                                    const typeConfig: Record<string, { bg: string; icon: string }> = {
                                        CLINICAL: { bg: 'bg-purple-100 text-purple-700 border-purple-200', icon: '🩺' },
                                        UPP_ALERT: { bg: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', icon: '🩹' },
                                        MAINTENANCE: { bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: '🔧' },
                                        COMPLAINT: { bg: 'bg-orange-100 text-orange-700 border-orange-200', icon: '📋' },
                                    };
                                    const cfg = typeConfig[r.type] || typeConfig.CLINICAL;
                                    const timeStr = new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                                            <span className="text-xl">{cfg.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                                                        {r.label}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400">{timeStr}</span>
                                                    {r.resolved && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Resuelto</span>}
                                                </div>
                                                <p className="text-xs text-slate-600 font-medium mt-1 truncate">{r.patientName} — {r.description.substring(0, 80)}{r.description.length > 80 ? '...' : ''}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="text-center p-20 text-xl font-bold text-slate-500 animate-pulse">Cargando Residentes...</div>
                ) : (
                    <>
                        {isNightMode ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                {/* Page banner — paleta warm oscura consistente con topbar */}
                                <div className="bg-[#1F2D3A] border border-[#2a3b4d] rounded-[20px] px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="font-display text-2xl font-semibold flex items-center gap-3 text-white">🌙 Night Rounds Mode</h2>
                                        <p className="text-[#94a3b8] font-medium mt-1 text-sm">Modo Ultra-Rápido: registra rondas bi-horarias y cambios de pañal en 1 solo tap.</p>
                                    </div>
                                    <div className="bg-[#0f172a] border border-[#2a3b4d] px-5 py-3 rounded-[14px] text-center w-full md:w-auto">
                                        <span className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-1">Hora Local del Turno</span>
                                        <span className="block font-display text-3xl sm:text-4xl font-semibold text-white leading-none tracking-tight">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {patients.map(p => {
                                        const lastRotationNight = p.posturalChanges?.length > 0 ? new Date(p.posturalChanges[0].performedAt) : null;
                                        const hoursElapsedNight = lastRotationNight ? (Date.now() - lastRotationNight.getTime()) / (1000 * 60 * 60) : 0;
                                        const minsElapsedNight = lastRotationNight ? Math.round((Date.now() - lastRotationNight.getTime()) / 60000) : 0;
                                        const isVencidoNight = hoursElapsedNight > 2.05;
                                        const initials = (p.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) || p.name.charAt(0)).toUpperCase();

                                        return (
                                        <div key={p.id} className="bg-[#1F2D3A] border border-[#2a3b4d] rounded-[20px] text-white flex flex-col relative overflow-hidden transition-colors hover:border-[#3CC6C4]/40">
                                            {p.status === 'TEMPORARY_LEAVE' && <div className="absolute inset-0 bg-[#0f172a]/85 z-20 flex items-center justify-center font-display text-lg font-semibold text-[#94a3b8] backdrop-blur-sm">FUERA DE EDIFICIO</div>}

                                            {/* ===== HEADER BANNER ===== */}
                                            <div className="bg-[#1F2D3A] border-b border-[#2a3b4d] px-4 py-3 flex justify-between items-center gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-[12px] bg-[#0F6B78] flex items-center justify-center shrink-0">
                                                        <span className="font-display text-white text-sm font-semibold">{initials}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-display text-white text-[15px] font-semibold leading-tight truncate">{p.name}</p>
                                                        <p className="text-[11px] text-[#94a3b8] leading-tight mt-0.5 truncate">Hab {p.roomNumber || '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className="inline-flex items-center gap-1 bg-[#1e293b] text-[#94a3b8] border border-white/10 text-[9px] font-semibold uppercase tracking-wider rounded-full px-2 py-1 whitespace-nowrap">
                                                        🌙 Turno Noche
                                                    </span>
                                                    {p.vitalsOrders?.length > 0 && (() => {
                                                        const order = p.vitalsOrders[0];
                                                        const expiresAt = new Date(order.expiresAt);
                                                        const minsLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000);
                                                        const expired = minsLeft <= 0;
                                                        const urgent = !expired && minsLeft < 30;
                                                        const hh = Math.floor(minsLeft / 60);
                                                        const mm = minsLeft % 60;
                                                        const label = expired
                                                            ? 'Ventana vencida'
                                                            : `Vence en ${hh > 0 ? `${hh}h ${mm}m` : `${mm}m`}`;
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider rounded-full px-2 py-1 whitespace-nowrap ${
                                                                expired
                                                                    ? 'bg-[#D9534F]/20 text-[#fca5a5] border border-[#D9534F]/40'
                                                                    : urgent
                                                                        ? 'bg-[#E5A93D]/20 text-[#fbbf24] border border-[#E5A93D]/40 animate-pulse'
                                                                        : 'bg-[#3CC6C4]/15 text-[#3CC6C4] border border-[#3CC6C4]/30'
                                                            }`}>
                                                                🩺 {label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* ===== ROTADO strip (si hay rondas registradas) ===== */}
                                            {p.posturalChanges?.length > 0 && lastRotationNight && (
                                                <div className="px-4 py-2 border-b border-[#2a3b4d] flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-md px-2 py-0.5 border ${
                                                        isVencidoNight
                                                            ? 'bg-[#D9534F]/15 text-[#fca5a5] border-[#D9534F]/40'
                                                            : 'bg-[#3CC6C4]/15 text-[#3CC6C4] border-[#3CC6C4]/30'
                                                    }`}>
                                                        Rotado · {lastRotationNight.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="text-[10px] text-[#94a3b8] font-medium">
                                                        hace {minsElapsedNight} min
                                                    </span>
                                                </div>
                                            )}

                                            {/* ===== BOTONES DE RONDA ===== */}
                                            <div className="p-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button onClick={() => logNightRound(p.id, 'SECO')} disabled={isSavingFastAction} className="py-5 bg-[#3CC6C4]/15 hover:bg-[#3CC6C4]/25 border border-[#3CC6C4]/30 text-[#3CC6C4] rounded-2xl font-semibold flex flex-col items-center justify-center gap-1.5 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] disabled:opacity-50 text-[13px] tracking-wide text-center px-2">
                                                        <span className="text-3xl leading-none">✅</span> Pañal Seco
                                                    </button>
                                                    <button onClick={() => logNightRound(p.id, 'HUMEDO')} disabled={isSavingFastAction} className="py-5 bg-[#3CC6C4]/15 hover:bg-[#3CC6C4]/25 border border-[#3CC6C4]/30 text-[#3CC6C4] rounded-2xl font-semibold flex flex-col items-center justify-center gap-1.5 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] disabled:opacity-50 text-[13px] tracking-wide text-center px-1">
                                                        <span className="text-3xl leading-none">💧</span> Cambio (Orina)
                                                    </button>
                                                    <button onClick={() => logNightRound(p.id, 'EVACUACION')} disabled={isSavingFastAction} className="py-5 bg-[#E5A93D]/15 hover:bg-[#E5A93D]/25 border border-[#E5A93D]/30 text-[#E5A93D] rounded-2xl font-semibold flex flex-col items-center gap-1.5 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] disabled:opacity-50 text-base col-span-2">
                                                        <span className="text-4xl leading-none">💩</span> Cambio (Evacuación)
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => logNightRound(p.id, 'ROTACION')}
                                                    disabled={isSavingFastAction}
                                                    className={`mt-3 w-full py-5 rounded-2xl font-semibold uppercase tracking-widest flex items-center justify-center gap-3 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] disabled:opacity-50 text-[13px] sm:text-sm text-white ${
                                                        isVencidoNight ? 'bg-[#D9534F] hover:opacity-90' : 'bg-[#0F6B78] hover:opacity-90'
                                                    }`}
                                                >
                                                    <span className="text-2xl leading-none">🔄</span>
                                                    {isVencidoNight ? 'Rotación VENCIDA — Ejecutar' : 'Rotación Postural 2Hrs'}
                                                </button>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <>
                            {/* Grid View Toggle Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    Residentes <span className="text-sm font-bold text-slate-400">({patients.length})</span>
                                </h2>
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                    <button onClick={() => setGridView('1col')} className={`p-2 rounded-md transition-colors ${gridView === '1col' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Una columna">
                                        <LayoutList className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setGridView('2col')} className={`p-2 rounded-md transition-colors ${gridView === '2col' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Dos columnas">
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className={`grid ${gridView === '2col' ? 'grid-cols-2 gap-3' : 'grid-cols-1 max-w-2xl mx-auto gap-3'}`}>
                                {patients.map(p => {
                                    const isAbsent = p.status === 'TEMPORARY_LEAVE';
                                    
                                    // Zendi UPP Engine (Day Mode)
                                    const lastRotation = p.posturalChanges?.length > 0 ? new Date(p.posturalChanges[0].performedAt) : null;
                                    const msElapsed = lastRotation ? Date.now() - lastRotation.getTime() : null;
                                    const hoursElapsed = msElapsed ? msElapsed / (1000 * 60 * 60) : 0;
                                    const isVencido = hoursElapsed > 2.05; // 2h 05m tolerance
                                    const isWarning = hoursElapsed >= 1.75 && hoursElapsed <= 2.05;

                                    return (
                                <div key={p.id} className={`bg-[#fafaf9] rounded-[20px] border border-[#e7e5e4] overflow-hidden transition-all relative ${isAbsent ? 'opacity-70 saturate-50' : ''}`}>
                                    {/* Zone accent stripe (static mapping — Tailwind JIT-safe) */}
                                    <div className={`h-1.5 w-full ${
                                        selectedColor === 'RED' ? 'bg-[#D9534F]' :
                                        selectedColor === 'YELLOW' ? 'bg-[#E5A93D]' :
                                        selectedColor === 'GREEN' ? 'bg-[#22A06B]' :
                                        selectedColor === 'BLUE' ? 'bg-[#3B82F6]' :
                                        'bg-[#C9D4D8]'
                                    }`} />

                                    {isAbsent && (
                                        <div className="absolute inset-0 bg-slate-900/10 z-10 flex flex-col items-center justify-center backdrop-blur-[1px] gap-4">
                                            <div className="bg-[#fef3c7] border border-[#fde68a] text-[#92400e] px-6 py-2 rounded-full font-semibold flex items-center gap-2 shadow-2xl rotate-[-5deg] transform scale-105">
                                                Residente Fuera ({p.leaveType === 'HOSPITAL' ? 'Hospital' : 'Familia'})
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); returnResident(p.id); }}
                                                className="bg-[#22A06B] hover:opacity-90 text-white px-5 py-2 rounded-xl font-semibold shadow-lg transition pointer-events-auto"
                                            >
                                                Registrar Retorno al Piso
                                            </button>
                                        </div>
                                    )}

                                    {/* ===== HEADER ===== */}
                                    <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-[#e7e5e4]">
                                        <div className="w-12 h-12 rounded-[14px] bg-[#1F2D3A] overflow-hidden shrink-0 flex items-center justify-center text-white font-display font-semibold">
                                            <ZendiCameraEnhancer
                                                targetId={p.id}
                                                isStaff={false}
                                                currentPhotoUrl={p.photoUrl}
                                                placeholderInitials={(p.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) || p.name.charAt(0)).toUpperCase()}
                                                onUploadSuccess={() => fetchPatients(selectedColor!)}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-display text-[17px] font-semibold text-[#1F2D3A] leading-tight truncate">{p.name}</h3>
                                            <p className="text-[12px] text-[#78716c] font-medium leading-snug truncate mt-0.5">
                                                Hab {p.roomNumber || '—'}{(p.lifePlan?.dietDetails || p.diet) ? ` · ${p.lifePlan?.dietDetails || p.diet}` : ''}
                                            </p>
                                            {(p.nortonRisk || p.pressureUlcers?.length > 0 || p.overrideInfo) && (
                                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                                    {p.overrideInfo && (
                                                        <span
                                                            className="text-[10px] font-semibold text-[#92400e] bg-[#fef3c7] border border-[#fde68a] px-1.5 py-0.5 rounded-md"
                                                            title={`Residente de grupo ${p.overrideInfo.originalColor} cubierto por ${p.overrideInfo.reason === 'ABSENCE_REDISTRIB' ? 'ausencia' : p.overrideInfo.reason === 'LATE_COVER' ? 'cobertura tardía' : 'asignación manual'}`}
                                                        >
                                                            COBERTURA {p.overrideInfo.originalColor}
                                                        </span>
                                                    )}
                                                    {p.nortonRisk && <span className="text-[10px] font-semibold text-[#92400e] bg-[#fef3c7] border border-[#fde68a] px-1.5 py-0.5 rounded-md">Alto riesgo piel</span>}
                                                    {p.pressureUlcers?.length > 0 && <span className="text-[10px] font-semibold text-white bg-[#D9534F] px-1.5 py-0.5 rounded-md">UPP activa</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ===== VITALS ENTRY WINDOW BADGE (Sprint J — 4h desde inicio de turno) ===== */}
                                    {p.vitalsOrders?.length > 0 && (() => {
                                        const order = p.vitalsOrders[0];
                                        const expiresAt = new Date(order.expiresAt);
                                        const minsLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000);
                                        const expired = minsLeft <= 0;
                                        const urgent = !expired && minsLeft < 30;
                                        const hh = Math.floor(Math.max(minsLeft, 0) / 60);
                                        const mm = Math.max(minsLeft, 0) % 60;
                                        const countdown = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
                                        return (
                                            <div className={`px-4 py-2 flex items-center gap-2 border-b ${
                                                expired ? 'bg-[#fef2f2] border-[#fecaca]' : urgent ? 'bg-[#fffbeb] border-[#fde68a] animate-pulse' : 'bg-[#ecfeff] border-[#a5f3fc]'
                                            }`}>
                                                <span className="text-sm">{expired ? '⏰' : urgent ? '⏳' : '🩺'}</span>
                                                <p className={`text-[11px] font-semibold leading-tight flex-1 ${
                                                    expired ? 'text-[#991b1b]' : urgent ? 'text-[#92400e]' : 'text-[#155e75]'
                                                }`}>
                                                    Vitales de entrada · {expired ? `Ventana vencida hace ${Math.abs(minsLeft)} min` : `Vence en ${countdown}`}
                                                </p>
                                            </div>
                                        );
                                    })()}

                                    {/* ===== STATUS STRIP (4 cols) ===== */}
                                    {(() => {
                                        const medsForShift = getMedsForCurrentShift(p.medications || []);
                                        const bathDone = p.bathLogs?.length > 0;
                                        const mealsCount = p.mealLogs?.length || 0;
                                        const rotationLabel = !p.nortonRisk ? 'N/A' : (isVencido ? 'Atrasado' : isWarning ? 'Próxima' : 'Al día');
                                        const rotationColor = !p.nortonRisk ? 'text-[#a8a29e]' : (isVencido ? 'text-[#D9534F]' : isWarning ? 'text-[#E5A93D]' : 'text-[#22A06B]');
                                        return (
                                            <div className="grid grid-cols-4 bg-white border-b border-[#e7e5e4]">
                                                <div className="px-2.5 py-[10px] border-r border-[#e7e5e4]">
                                                    <p className="text-[10px] uppercase tracking-wide text-[#a8a29e] font-medium leading-none flex items-center gap-1"><span className="text-sm">🛁</span> Baño</p>
                                                    <p className={`text-[12px] font-medium mt-1.5 leading-none ${bathDone ? 'text-[#22A06B]' : 'text-[#E5A93D]'}`}>{bathDone ? 'Listo' : 'Pendiente'}</p>
                                                </div>
                                                <div className="px-2.5 py-[10px] border-r border-[#e7e5e4]">
                                                    <p className="text-[10px] uppercase tracking-wide text-[#a8a29e] font-medium leading-none flex items-center gap-1"><span className="text-sm">🍽</span> Comidas</p>
                                                    <p className={`text-[12px] font-medium mt-1.5 leading-none ${mealsCount >= 3 ? 'text-[#22A06B]' : mealsCount > 0 ? 'text-[#1F2D3A]' : 'text-[#E5A93D]'}`}>{mealsCount}/3 comidas</p>
                                                </div>
                                                <div className="px-2.5 py-[10px] border-r border-[#e7e5e4]">
                                                    <p className="text-[10px] uppercase tracking-wide text-[#a8a29e] font-medium leading-none flex items-center gap-1"><span className="text-sm">🔄</span> Rotación</p>
                                                    <p className={`text-[12px] font-medium mt-1.5 leading-none ${rotationColor}`}>{rotationLabel}</p>
                                                </div>
                                                <div className="px-2.5 py-[10px]">
                                                    <p className="text-[10px] uppercase tracking-wide text-[#a8a29e] font-medium leading-none flex items-center gap-1"><span className="text-sm">💊</span> Meds PM</p>
                                                    <p className={`text-[12px] font-medium mt-1.5 leading-none ${medsForShift.length > 0 ? 'text-[#E5A93D]' : 'text-[#22A06B]'}`}>{medsForShift.length > 0 ? 'Pendiente' : 'Listo'}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* ===== VITALES CHIPS ===== */}
                                    <div
                                        className={`bg-white border-b border-[#e7e5e4] px-4 py-2.5 flex items-center gap-1.5 flex-wrap ${p.vitalSigns?.length > 0 ? 'cursor-pointer hover:bg-[#fafaf9]' : ''}`}
                                        onClick={() => { if (p.vitalSigns?.length > 0) { setActivePatient(p); setModalType('VITALS_HISTORY'); } }}
                                    >
                                        {p.vitalSigns?.length > 0 ? (() => {
                                            const v = p.vitalSigns[0];
                                            const tempNum = parseFloat(v.temperature);
                                            const spo2Num = parseFloat(v.spo2);
                                            const tempAlert = !isNaN(tempNum) && (tempNum > 99 || tempNum < 96);
                                            const spo2Alert = !isNaN(spo2Num) && spo2Num > 0 && spo2Num < 94;
                                            return (
                                                <>
                                                    {v.systolic && v.diastolic && (
                                                        <span className="px-[9px] py-1 rounded-md text-[11px] font-medium bg-[#e1f5ee] text-[#0F6B78]">PA {v.systolic}/{v.diastolic}</span>
                                                    )}
                                                    {v.heartRate && (
                                                        <span className="px-[9px] py-1 rounded-md text-[11px] font-medium bg-[#e1f5ee] text-[#0F6B78]">FC {v.heartRate}</span>
                                                    )}
                                                    {v.temperature && (
                                                        <span className={`px-[9px] py-1 rounded-md text-[11px] font-medium ${tempAlert ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#dcfce7] text-[#166534]'}`}>T {v.temperature}°</span>
                                                    )}
                                                    {v.spo2 && (
                                                        <span className={`px-[9px] py-1 rounded-md text-[11px] font-medium ${spo2Alert ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#dcfce7] text-[#166534]'}`}>SpO₂ {v.spo2}%</span>
                                                    )}
                                                    <span className="ml-auto text-[10px] text-[#a8a29e] font-medium whitespace-nowrap">
                                                        {new Date(v.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · por {v.user?.name?.split(' ')[0] || 'Staff'}
                                                    </span>
                                                </>
                                            );
                                        })() : (
                                            <span className="px-[9px] py-1 rounded-md text-[11px] font-medium bg-[#f5f5f4] text-[#78716c]">Sin vitales hoy</span>
                                        )}
                                    </div>

                                    {/* ===== UPP SLA TIMER (solo Norton risk con datos de rotación) ===== */}
                                    {p.nortonRisk && lastRotation && (
                                        <div className={`mx-4 mt-3 p-3 rounded-xl border flex items-center justify-between transition-all ${isVencido ? 'bg-[#fee2e2] border-[#fecaca]' : (isWarning ? 'bg-[#fef3c7] border-[#fde68a]' : 'bg-[#e1f5ee] border-[#3CC6C4]/30')}`}>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className={`text-lg leading-none ${isVencido ? 'text-[#D9534F]' : (isWarning ? 'text-[#E5A93D]' : 'text-[#0F6B78]')}`}>⏳</span>
                                                <div className="min-w-0">
                                                    <p className={`text-[9px] font-semibold uppercase tracking-wide leading-none mb-1 ${isVencido ? 'text-[#991b1b]' : (isWarning ? 'text-[#92400e]' : 'text-[#0F6B78]')}`}>SLA Rotación 2h</p>
                                                    <p className={`text-[11px] font-semibold leading-none ${isVencido ? 'text-[#D9534F]' : (isWarning ? 'text-[#92400e]' : 'text-[#1F2D3A]')}`}>
                                                        {hoursElapsed.toFixed(1)}h <span className="font-normal opacity-70">/ 2.0h · Pos. {p.posturalChanges[0]?.position?.split(' ')[0] || 'N/A'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex bg-white rounded-lg overflow-hidden border border-[#e7e5e4] shrink-0">
                                                <button onClick={(e) => { e.stopPropagation(); logNightRound(p.id, 'ROTACION', 'Izquierdo'); }} className="px-2 py-1.5 text-[10px] font-semibold text-[#1F2D3A] hover:bg-[#e1f5ee] hover:text-[#0F6B78] border-r border-[#e7e5e4] transition-colors">Izq</button>
                                                <button onClick={(e) => { e.stopPropagation(); logNightRound(p.id, 'ROTACION', 'Supino'); }} className="px-2 py-1.5 text-[10px] font-semibold text-[#1F2D3A] hover:bg-[#e1f5ee] hover:text-[#0F6B78] border-r border-[#e7e5e4] transition-colors">Sup</button>
                                                <button onClick={(e) => { e.stopPropagation(); logNightRound(p.id, 'ROTACION', 'Derecho'); }} className="px-2 py-1.5 text-[10px] font-semibold text-[#1F2D3A] hover:bg-[#e1f5ee] hover:text-[#0F6B78] transition-colors">Der</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ===== ACTION GRID ===== */}
                                    <div className={`px-4 pt-2.5 pb-3.5 ${isAbsent ? 'pointer-events-none' : ''}`}>
                                        {/* Row 1 — 3 cols: Vitales / Bitácora / Preventiva */}
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <button
                                                onClick={() => { setActivePatient(p); setVitals({ sys: "", dia: "", temp: "", hr: "", glucose: "", spo2: "" }); setModalType('VITALS'); }}
                                                className="min-h-[52px] bg-white border border-[#e7e5e4] rounded-[12px] flex flex-col items-center justify-center gap-1 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] hover:opacity-85"
                                            >
                                                <svg className="w-4 h-4 text-[#0F6B78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                </svg>
                                                <span className="text-[12px] font-medium text-[#1F2D3A]">Vitales</span>
                                            </button>
                                            <button
                                                onClick={() => { setActivePatient(p); setModalType('LOG'); }}
                                                className="min-h-[52px] bg-white border border-[#e7e5e4] rounded-[12px] flex flex-col items-center justify-center gap-1 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] hover:opacity-85"
                                            >
                                                <svg className="w-4 h-4 text-[#0F6B78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                </svg>
                                                <span className="text-[12px] font-medium text-[#1F2D3A]">Bitácora</span>
                                            </button>
                                            <button
                                                onClick={() => { setActivePatient(p); setSelectedSymptom(null); setModalType('PREVENTIVE'); }}
                                                className="min-h-[52px] bg-white border border-[#e7e5e4] rounded-[12px] flex flex-col items-center justify-center gap-1 transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] hover:opacity-85"
                                            >
                                                <svg className="w-4 h-4 text-[#0F6B78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                                <span className="text-[12px] font-medium text-[#1F2D3A]">Preventiva</span>
                                            </button>
                                        </div>

                                        {/* Row 2 — Medicamentos full width con badge de pendientes */}
                                        {(() => {
                                            const medsForShift = getMedsForCurrentShift(p.medications || []);
                                            return (
                                                <button
                                                    onClick={() => { setActivePatient(p); setModalType('MEDS'); }}
                                                    className="mt-1.5 w-full h-[52px] bg-[#0F6B78] text-white rounded-[12px] flex items-center justify-center gap-2 font-semibold text-[14px] transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] hover:opacity-90 relative"
                                                >
                                                    <span className="text-lg leading-none">💊</span>
                                                    <span>Medicamentos</span>
                                                    {medsForShift.length > 0 && (
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#D9534F] text-white text-[11px] font-bold min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center leading-none">{medsForShift.length}</span>
                                                    )}
                                                </button>
                                            );
                                        })()}

                                        {/* Row 3 — Alerta Caída + Trasladar ER */}
                                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                            <button
                                                onClick={() => { setActivePatient(p); setModalType('FALL'); }}
                                                className="min-h-[52px] bg-[#fffbeb] border border-[#fde68a] text-[#92400e] rounded-[12px] flex items-center justify-center gap-1.5 font-semibold text-[13px] transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] hover:opacity-85"
                                            >
                                                <span className="text-base leading-none">⚠</span> Alerta Caída
                                            </button>
                                            <button
                                                onClick={() => { setActivePatient(p); setModalType('HOSPITAL_TRANSFER'); }}
                                                className="min-h-[52px] bg-[#1F2D3A] text-white rounded-[12px] flex items-center justify-center gap-1.5 font-semibold text-[13px] transition-[opacity,transform] duration-[80ms] ease-out active:scale-[0.97] hover:opacity-90"
                                            >
                                                <span className="text-base leading-none">🚑</span> Trasladar ER
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    </>
                )}
                </>
            )}
        </div>

            {/* RESTO DE MODALES FASE 7 y 8... (Conservados por simplicidad) */}
            {modalType && (
                <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] flex flex-col">
                        <button onClick={() => setModalType(null)} className="absolute top-4 right-4 w-10 h-10 md:w-12 md:h-12 bg-slate-100 text-slate-500 rounded-full font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors z-20">X</button>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 pr-12">{activePatient?.name}</h3>
                        
                        <div className="overflow-y-auto custom-scrollbar pr-2 pb-4 flex-1">
                            {modalType === 'DIET_CHANGE' && (
                            <form onSubmit={handleDietUpdate} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <p className="font-bold text-slate-500 uppercase tracking-widest text-xs border-b pb-2">Modificar Dieta / Nutrición</p>
                                    <p className="text-slate-600 text-sm mt-3 font-medium">Asigna un plan de alimentación específico para este residente.</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm font-bold flex items-start gap-4">
                                    <span className="text-2xl mt-0.5"></span>
                                    <div className="leading-relaxed">
                                        Los cambios realizados aquí se sincronizarán inmediatamente con la pantalla central del equipo de <span className="underline decoration-2 underline-offset-2">Cocina y Nutrición</span>.
                                    </div>
                                </div>
                                <div>
                                    <select
                                        value={dietFormValue}
                                        onChange={(e) => setDietFormValue(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 p-4 rounded-xl font-black text-slate-800 text-base focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none cursor-pointer"
                                    >
                                        <option value="Regular (Sólida)">Regular (Sólida)</option>
                                        <option value="Blanda / Semisólida">Blanda / Semisólida</option>
                                        <option value="Líquidos Claros">Líquidos Claros</option>
                                        <option value="Puré / Mojado">Puré / Mojado (Disfagia)</option>
                                        <option value="PEG (Sonda)">PEG (Alimentación por Sonda)</option>
                                        <option value="Diabética">Diabética</option>
                                        <option value="Baja en Sodio">Baja en Sodio</option>
                                        <option value="Renal">Renal</option>
                                        <option value="Vegetariana">Vegetariana</option>
                                    </select>
                                </div>
                                <button type="submit" disabled={submitting} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl text-base transition-all active:scale-95 shadow-md flex items-center justify-center gap-3">
                                    {submitting ? 'Sincronizando Plataforma...' : 'Confirmar Nueva Dieta'}
                                </button>
                            </form>
                        )}

                        {modalType === 'PREVENTIVE' && (
                            <div className="space-y-4">
                                <p className="font-bold text-slate-500 uppercase tracking-widest text-xs border-b pb-2 flex items-center justify-between">
                                    <span> Motor de Salud Preventiva</span>
                                    {selectedSymptom && (
                                        <button onClick={() => setSelectedSymptom(null)} className="text-indigo-500 font-bold text-xs hover:text-indigo-600">← Volver al Menú</button>
                                    )}
                                </p>
                                
                                {!selectedSymptom ? (
                                    <div className="space-y-4 h-[55vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
                                        <p className="text-xs font-bold text-slate-500 text-center mb-2 px-4 shadow-sm py-2 bg-slate-100 rounded-lg">Selecciona el signo clínico o conductual observado para reportar al Mando de Enfermería.</p>
                                        
                                        {Object.entries(SYMPTOM_CATEGORIES).map(([category, symptoms]) => (
                                            <div key={category} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                                                <h4 className="font-black text-slate-700 mb-3 text-sm">{category}</h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {symptoms.map(sym => (
                                                        <button 
                                                            key={sym} 
                                                            onClick={() => setSelectedSymptom(sym)}
                                                            className="text-left p-3 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md rounded-xl text-xs font-black text-indigo-900 transition-all active:scale-95 flex items-center"
                                                        >
                                                            {sym}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-inner">
                                            <p className="text-emerald-800 font-black mb-1 uppercase tracking-wide text-xs">Síntoma Detectado:</p>
                                            <p className="text-emerald-700 font-black text-lg">{selectedSymptom}</p>
                                        </div>
                                        <ZendiAssist
                                            value={preventiveNote}
                                            onChange={setPreventiveNote}
                                            type="FORMAT_NOTES"
                                            context="reporte preventivo clínico"
                                            placeholder="Detalla lo que observaste (Ej. Cuándo comenzó, severidad, si el residente se queja...)"
                                            rows={5}
                                        />
                                        <button onClick={handlePreventiveSubmit} disabled={submitting} className="w-full py-5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-[0_8px_30px_rgb(5,150,105,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2 text-lg">
                                            {submitting ? "Sincronizando..." : "Enviar Reporte (+5 Pts)"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {modalType === 'VITALS_HISTORY' && (
                            <div className="space-y-4">
                                <p className="font-bold text-slate-500 uppercase text-sm border-b pb-2">Historial de Vitales (Turno Actual)</p>
                                {activePatient?.vitalSigns?.length > 0 ? (
                                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                        {activePatient.vitalSigns.map((v: any, i: number) => (
                                            <div key={i} className="bg-teal-50/50 p-4 rounded-xl border border-teal-100 flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="font-black text-teal-900 text-sm">
                                                        BP: {v.systolic || '--'} / {v.diastolic || '--'} <span className="text-teal-300 mx-2">|</span> 
                                                        HR: {v.heartRate || '--'} <span className="text-teal-300 mx-2">|</span> 
                                                        Temp: {v.temperature || '--'}°
                                                    </p>
                                                    <p className="text-xs font-bold text-teal-700 mt-1">
                                                        SpO2: {v.spo2 || '--'}% {v.glucose ? `| Glucosa: ${v.glucose}` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-black tracking-widest text-teal-600 block mb-0.5">Hora</span>
                                                    <span className="text-sm font-black text-teal-800 bg-white px-2 py-1 rounded-md shadow-sm border border-teal-100">
                                                        {new Date(v.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm font-bold text-slate-500 text-center py-4">No hay lecturas registradas en este turno.</p>
                                )}
                                <button onClick={() => { setVitals({ sys: "", dia: "", temp: "", hr: "", glucose: "", spo2: "" }); setModalType('VITALS'); }} className="w-full py-4 mt-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl transition-all active:scale-95 shadow-lg shadow-teal-500/30">
                                    Tomar Nueva Lectura
                                </button>
                            </div>
                        )}

                        {modalType === 'VITALS' && (
                            <div className="space-y-6">
                                <p className="font-bold text-slate-500 uppercase text-sm border-b pb-3">Registro de Signos Vitales</p>
                                
                                {/* ZENDI DUPLICATE WARNING */}
                                {activePatient?.vitalSigns?.length > 0 && new Date().getTime() - new Date(activePatient.vitalSigns[0].createdAt).getTime() < 4 * 60 * 60 * 1000 && (
                                    <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-start gap-3 shadow-inner">
                                        <div className="bg-amber-100 p-2 rounded-full mt-0.5 shadow-sm border border-amber-200"><span className="text-xl leading-none block">⚠️</span></div>
                                        <div>
                                            <p className="font-black text-amber-900 text-sm uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                Zendi Care Assistant <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-lg text-[10px]">Prevención</span>
                                            </p>
                                            <p className="text-amber-800 text-xs font-medium leading-relaxed">
                                                Registro reciente detectado. Ya se documentaron los vitales de {activePatient.name.split(' ')[0]} hace menos de 4 horas (<span className="font-bold">{new Date(activePatient.vitalSigns[0].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>). ¿Deseas sobreescribir la bitácora o registrar una toma extraordinaria manual?
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                    <input type="number" placeholder="Sistólica (Ej 120)" value={vitals.sys} onChange={e => { setVitals({ ...vitals, sys: e.target.value }); if (vitalsErrors.sys) setVitalsErrors({ ...vitalsErrors, sys: false }); }} className={`bg-slate-50 border-2 p-5 rounded-2xl font-black text-lg focus:border-teal-500 focus:ring-4 outline-none transition-all ${vitalsErrors.sys ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-100' : 'border-slate-200'}`} />
                                    <input type="number" placeholder="Diastólica (Ej 80)" value={vitals.dia} onChange={e => { setVitals({ ...vitals, dia: e.target.value }); if (vitalsErrors.dia) setVitalsErrors({ ...vitalsErrors, dia: false }); }} className={`bg-slate-50 border-2 p-5 rounded-2xl font-black text-lg focus:border-teal-500 focus:ring-4 outline-none transition-all ${vitalsErrors.dia ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-100' : 'border-slate-200'}`} />
                                    <input type="number" placeholder="Pulso (HR)" value={vitals.hr} onChange={e => { setVitals({ ...vitals, hr: e.target.value }); if (vitalsErrors.hr) setVitalsErrors({ ...vitalsErrors, hr: false }); }} className={`bg-slate-50 border-2 p-5 rounded-2xl font-black text-lg focus:border-teal-500 focus:ring-4 outline-none transition-all ${vitalsErrors.hr ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-100' : 'border-slate-200'}`} />
                                    <input type="number" placeholder="Temp °F o °C (Ej 98.6 / 37)" value={vitals.temp} onChange={e => { setVitals({ ...vitals, temp: e.target.value }); if (vitalsErrors.temp) setVitalsErrors({ ...vitalsErrors, temp: false }); }} className={`bg-slate-50 border-2 p-5 rounded-2xl font-black text-lg md:col-span-1 focus:border-teal-500 focus:ring-4 outline-none transition-all ${vitalsErrors.temp ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-100' : 'border-slate-200'}`} />
                                    <input type="number" placeholder="Oxigenación (SpO2 %)" value={vitals.spo2} onChange={e => setVitals({ ...vitals, spo2: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg md:col-span-1 focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                    <input type="number" placeholder="Glucosa mg/dL" value={vitals.glucose} onChange={e => setVitals({ ...vitals, glucose: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg md:col-span-1 focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                </div>
                                {aiSuggestion && (<div className="p-5 bg-teal-50 border-2 border-teal-200 rounded-2xl text-teal-800 text-base font-bold shadow-inner flex items-center gap-3"><span className="text-2xl">🧠</span> {aiSuggestion}</div>)}
                                <button onClick={() => submitVitals()} disabled={submitting} className={`w-full py-6 text-white font-black rounded-2xl mt-4 transition-all shadow-xl flex items-center justify-center gap-3 min-h-[72px] text-xl ${submitting ? 'bg-teal-800 opacity-80 cursor-wait' : 'bg-teal-600 hover:bg-teal-700 active:scale-95'}`}>
                                    {submitting ? 'Analizando Vitales con Zendi...' : 'Guardar y Analizar Vitales'}
                                </button>
                            </div>
                        )}

                        {modalType === 'LOG' && (
                            <div className="space-y-4">
                                <p className="font-bold text-slate-500 uppercase text-xs border-b pb-2 sticky top-0 bg-white z-10 pt-1">Actividades Diarias y Comidas</p>

                                {/* Tareas de Cuidado Personal (AM) */}
                                {selectedColor && (
                                    <div className="bg-sky-50 border border-sky-100 p-3 rounded-2xl">
                                        <h4 className="font-black text-sky-800 text-base mb-2"> Higiene Matutina</h4>
                                        <button onClick={handleBathLog} disabled={submitting || bathCompletedToday} className={`w-full py-3 rounded-xl font-bold transition-all ${bathCompletedToday ? 'bg-sky-200 text-sky-500 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/30 active:scale-95'}`}>
                                            {bathCompletedToday ? "Baño Registrado " : "Completar Baño de 6AM - 10AM"}
                                        </button>
                                        <p className="text-[10px] font-bold text-sky-600/60 mt-1.5 text-center uppercase tracking-wider">Protegido por cooldown de 2 minutos</p>
                                    </div>
                                )}

                                {/* Protocolo UPP (Fase Dual) */}
                                {selectedColor && (
                                    <div className={`p-3 rounded-2xl border ${activePatient.requiresPosturalChanges ? 'bg-orange-50 border-orange-100' : 'bg-amber-50 border-amber-100'}`}>
                                        <h4 className={`font-black text-base mb-2 ${activePatient.requiresPosturalChanges ? 'text-orange-800' : 'text-amber-800'}`}>
                                            {activePatient.requiresPosturalChanges ? ' Protocolo UPP Activo' : ' Vigilancia Dermatológica'}
                                        </h4>
                                        
                                        {!activePatient.requiresPosturalChanges ? (
                                            <>
                                                <button onClick={() => setModalType('PREVENTIVE')} className="w-full py-4 text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 min-h-[56px] text-sm active:scale-95">
                                                    <span className="text-xl">🛡️</span> Abrir Panel de Prevención
                                                </button>
                                                <p className="text-[10px] font-bold text-emerald-600/60 mt-2 text-center uppercase tracking-wider">Fase Preventiva: +5 Pts Zendity</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-3 gap-2 mb-1">
                                                    <button onClick={() => handlePosturalChange('IZQUIERDA')} className="py-5 text-sm md:text-base font-black bg-orange-500 text-white hover:bg-orange-600 rounded-xl shadow-sm active:scale-95 min-h-[56px] transition-colors">Izquie.</button>
                                                    <button onClick={() => handlePosturalChange('SUPINO')} className="py-5 text-sm md:text-base font-black bg-orange-500 text-white hover:bg-orange-600 rounded-xl shadow-sm active:scale-95 min-h-[56px] transition-colors">Supino</button>
                                                    <button onClick={() => handlePosturalChange('DERECHA')} className="py-5 text-sm md:text-base font-black bg-orange-500 text-white hover:bg-orange-600 rounded-xl shadow-sm active:scale-95 min-h-[56px] transition-colors">Derecha</button>
                                                </div>
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-orange-600/80 mt-2 text-center">Rotación 2-Horas Requerida</p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Logística Interna (AM y PM) */}
                                {selectedColor !== 'GREEN' && (
                                    <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                                        <h4 className="font-black text-orange-800 text-lg mb-2"> Registro Nutricional</h4>
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            <button onClick={() => setDailyLog({ ...dailyLog, selectedMeal: 'BREAKFAST' })} className={`py-2 text-sm font-bold rounded-lg border ${dailyLog.selectedMeal === 'BREAKFAST' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200'}`}>Desayuno</button>
                                            <button onClick={() => setDailyLog({ ...dailyLog, selectedMeal: 'LUNCH' })} className={`py-2 text-sm font-bold rounded-lg border ${dailyLog.selectedMeal === 'LUNCH' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200'}`}>Almuerzo</button>
                                            <button onClick={() => setDailyLog({ ...dailyLog, selectedMeal: 'DINNER' })} className={`py-2 text-sm font-bold rounded-lg border ${dailyLog.selectedMeal === 'DINNER' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200'}`}>Cena</button>
                                        </div>

                                        {dailyLog.selectedMeal && (
                                            <div className="grid grid-cols-4 gap-3 animate-in fade-in zoom-in-95 mt-1">
                                                <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'ALL')} className="py-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black rounded-xl md:text-sm text-xs min-h-[56px] shadow-sm transform transition-all active:scale-95">Todo</button>
                                                <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'HALF')} className="py-4 bg-blue-100 hover:bg-blue-200 text-blue-800 font-black rounded-xl md:text-sm text-xs min-h-[56px] shadow-sm transform transition-all active:scale-95">Mitad</button>
                                                <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'LITTLE')} className="py-4 bg-amber-100 hover:bg-amber-200 text-amber-800 font-black rounded-xl md:text-sm text-xs min-h-[56px] shadow-sm transform transition-all active:scale-95">Poco</button>
                                                <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'NONE')} className="py-4 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black rounded-xl md:text-sm text-xs min-h-[56px] shadow-sm transform transition-all active:scale-95">Nada</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Logística Interna (AM y PM) */}
                                {selectedColor && (
                                    <div className="p-3 grid grid-cols-2 gap-3">
                                        <button onClick={handleLaundryLog} className="py-4 bg-white border-2 border-slate-200 text-slate-700 font-black rounded-xl flex items-center justify-center gap-2 hover:border-indigo-400 hover:text-indigo-700 transition-all shadow-sm text-sm min-h-[56px] active:scale-95">
                                            <span className="text-xl">👕</span> Lavar Ropa
                                        </button>
                                        <button onClick={handleRoomCleaningLog} className="py-4 bg-white border-2 border-slate-200 text-slate-700 font-black rounded-xl flex items-center justify-center gap-2 hover:border-indigo-400 hover:text-indigo-700 transition-all shadow-sm text-sm min-h-[56px] active:scale-95">
                                            <span className="text-xl">🧹</span> Aseo Habitación
                                        </button>
                                    </div>
                                )}

                                {/* Tareas de Noche (SLA de 120 Minutos) */}
                                {isNightShift && selectedColor && (
                                    <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 shadow-md">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-black text-white text-base flex items-center gap-1.5"><span></span> Control de Noche</h4>
                                            {nightRoundSLA !== null && nightRoundSLA < 120 && (
                                                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
                                                     Faltan {120 - nightRoundSLA} min
                                                </span>
                                            )}
                                        </div>
                                        
                                        {nightRoundSLA !== null && nightRoundSLA < 120 ? (
                                            <div className="bg-slate-900/50 p-4 rounded-xl text-center border border-white/5">
                                                <p className="text-xs font-bold text-slate-500">Ronda bloqueada (SLA 2-Hrs).</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button onClick={() => setNightRoundStatus('SLEEPING')} className={`py-4 text-xs md:text-sm uppercase tracking-wider font-black rounded-xl min-h-[56px] transition-all active:scale-95 shadow-sm border ${nightRoundStatus === 'SLEEPING' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-700/50 text-slate-500 border-slate-600'}`}> Profundo</button>
                                                    <button onClick={() => setNightRoundStatus('AWAKE')} className={`py-4 text-xs md:text-sm uppercase tracking-wider font-black rounded-xl min-h-[56px] transition-all active:scale-95 shadow-sm border ${nightRoundStatus === 'AWAKE' ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-700/50 text-slate-500 border-slate-600'}`}> Despierto</button>
                                                    <button onClick={() => setNightRoundStatus('ANOMALY')} className={`py-4 text-xs md:text-sm uppercase tracking-wider font-black rounded-xl min-h-[56px] transition-all active:scale-95 shadow-sm border ${nightRoundStatus === 'ANOMALY' ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-700/50 text-slate-500 border-slate-600'}`}> Anomalía</button>
                                                </div>
                                                
                                                {nightRoundStatus === 'ANOMALY' && (
                                                    <ZendiAssist
                                                        value={nightRoundNote}
                                                        onChange={setNightRoundNote}
                                                        type="FORMAT_NOTES"
                                                        context="anomalía en ronda nocturna"
                                                        placeholder="Describe anomalía..."
                                                        rows={2}
                                                    />
                                                )}
                                                
                                                <button onClick={handleNightRoundSubmit} disabled={!nightRoundStatus || submitting} className={`w-full py-4 mt-2 font-black rounded-xl text-base shadow-md min-h-[56px] transition-all flex items-center justify-center gap-3 ${submitting ? 'bg-emerald-700 text-emerald-100 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 disabled:bg-slate-700 disabled:text-slate-500/50'}`}>
                                                    {submitting ? 'Sellando Ronda...' : 'Sellar Ronda (Huella)'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Bitacora General */}
                                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                                    <ZendiAssist
                                        value={dailyLog.notes}
                                        onChange={v => setDailyLog({ ...dailyLog, notes: v })}
                                        type="FORMAT_NOTES"
                                        context="bitácora clínica diaria"
                                        placeholder="Notas clínicas adicionales..."
                                        rows={2}
                                    />
                                </div>
                                <button onClick={submitLog} disabled={submitting} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md text-sm mt-3">Guardar y Sincronizar Logs</button>
                            </div>
                        )}

                        {modalType === 'MEDS' && (() => {
                            // Flujo de packs: agrupar meds por slot del turno, resolver pack activo.
                            const packs = groupMedsByScheduleTime(activePatient?.medications || []);
                            const activePackIdx = packs.findIndex(p => !isPackComplete(p));
                            const activePack = activePackIdx >= 0 ? packs[activePackIdx] : null;
                            const totalPacks = packs.length;
                            const completedPacks = packs.filter(p => isPackComplete(p));
                            const allComplete = totalPacks > 0 && activePackIdx < 0;
                            const pendingInActivePack = activePack ? activePack.meds.filter((m: any) => !slotStatusToday(m, activePack.label)) : [];

                            return (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <div>
                                        <p className="font-black text-slate-800 text-lg leading-tight">Medicamentos</p>
                                        <p className="text-xs font-bold text-slate-500">{activePatient?.name}</p>
                                    </div>
                                    <a href={`/care/patient/emar-print?patientId=${activePatient?.id}`} target="_blank" className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors">
                                        Cardex
                                    </a>
                                </div>

                                {/* Caso: sin meds pautados en el turno */}
                                {totalPacks === 0 && (
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center">
                                        <p className="text-sm font-bold text-slate-500">No hay medicamentos pautados para este turno.</p>
                                    </div>
                                )}

                                {/* Caso: todos los packs completados */}
                                {allComplete && (
                                    <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 text-center animate-in fade-in">
                                        <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/40">
                                            <CheckCircle2 className="w-8 h-8 text-white" />
                                        </div>
                                        <p className="font-black text-emerald-700 text-lg">Todos los medicamentos del turno administrados</p>
                                        <p className="text-xs font-bold text-emerald-600 mt-1">{totalPacks} pack{totalPacks !== 1 ? 's' : ''} completado{totalPacks !== 1 ? 's' : ''}</p>
                                    </div>
                                )}

                                {/* Caso: pack activo */}
                                {activePack && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center bg-[#0F6B78] text-white text-sm font-black px-3 py-1.5 rounded-full shadow-sm">Pack {activePack.label}</span>
                                                <span className="text-[11px] font-bold text-slate-500">{activePack.meds.length} med{activePack.meds.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-500">Pack {activePackIdx + 1} de {totalPacks} · {completedPacks.length}/{totalPacks} completados</span>
                                        </div>

                                        {/* Panel de omisión individual */}
                                        {omittingMed ? (
                                            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200 space-y-3 animate-in slide-in-from-top-2">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                                                    <p className="font-black text-rose-700 text-sm">¿Por qué se omite {omittingMed.name}?</p>
                                                </div>
                                                <select value={omitReasonCat} onChange={e => setOmitReasonCat(e.target.value)} className="w-full bg-white border-2 border-rose-200 rounded-xl px-3 py-2.5 font-bold text-rose-900 text-sm focus:outline-none focus:border-rose-400">
                                                    {OMIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                                <textarea
                                                    value={omitReasonText}
                                                    onChange={e => setOmitReasonText(e.target.value)}
                                                    placeholder="Detalles de la omisión (mínimo 10 caracteres)…"
                                                    className="w-full bg-white border-2 border-rose-200 focus:border-rose-400 outline-none rounded-xl p-3 text-sm font-medium text-rose-900 min-h-[90px] resize-none"
                                                    maxLength={500}
                                                />
                                                <div className="text-[11px] font-bold flex justify-between">
                                                    <span className={omitReasonText.trim().length < 10 ? 'text-rose-500' : 'text-emerald-600'}>
                                                        {omitReasonText.trim().length < 10 ? `Mínimo 10 chars (${omitReasonText.trim().length}/10)` : '✓ Razón válida'}
                                                    </span>
                                                    <span className="text-slate-400">{omitReasonText.length}/500</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setOmittingMed(null); setOmitReasonText(""); setOmitReasonCat(OMIT_REASONS[0]); }}
                                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition-all text-sm">
                                                        Cancelar
                                                    </button>
                                                    <button onClick={() => confirmOmitMed(activePack)}
                                                        disabled={omitReasonText.trim().length < 10 || submitting}
                                                        className={`flex-1 py-3 font-black rounded-xl transition-all text-sm ${omitReasonText.trim().length < 10 || submitting ? 'bg-rose-200 text-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md active:scale-95'}`}>
                                                        {submitting ? 'Omitiendo…' : 'Confirmar omisión'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Lista del pack con estados por med */}
                                                <div className={`bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1 ${packJustCompleted === activePack.label ? 'ring-2 ring-emerald-300 animate-in fade-in' : ''}`}>
                                                    {activePack.meds.map((m: any) => {
                                                        const status = slotStatusToday(m, activePack.label);
                                                        return (
                                                            <div key={m.id} className="flex justify-between items-center py-2 border-b border-slate-200 last:border-0 gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-slate-800 text-sm truncate">{m.medication?.name}</p>
                                                                    <p className="text-[11px] text-slate-500 font-bold">{m.medication?.dosage} · {m.medication?.route || 'Oral'}</p>
                                                                </div>
                                                                {status === 'ADMINISTERED' && (
                                                                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full px-2.5 py-1 whitespace-nowrap">
                                                                        <CheckCircle2 className="w-3 h-3" /> Firmado
                                                                    </span>
                                                                )}
                                                                {status === 'OMITTED' && (
                                                                    <span className="inline-flex items-center bg-rose-100 text-rose-700 text-[10px] font-black uppercase rounded-full px-2.5 py-1 whitespace-nowrap">
                                                                        Omitido
                                                                    </span>
                                                                )}
                                                                {status === 'REFUSED' && (
                                                                    <span className="inline-flex items-center bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full px-2.5 py-1 whitespace-nowrap">
                                                                        Rechazado
                                                                    </span>
                                                                )}
                                                                {!status && (
                                                                    <button
                                                                        onClick={() => setOmittingMed({ id: m.id, name: m.medication?.name || 'este medicamento', slotLabel: activePack.label })}
                                                                        disabled={submitting}
                                                                        className="text-[11px] font-black uppercase tracking-wide text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap">
                                                                        Omitir
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Firma única del pack — solo si quedan pendientes */}
                                                {pendingInActivePack.length > 0 && (
                                                    <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Firma clínica</p>
                                                                <p className="text-[10px] font-bold text-slate-500">Una firma para los {pendingInActivePack.length} med{pendingInActivePack.length !== 1 ? 's' : ''} pendientes</p>
                                                            </div>
                                                            <button onClick={() => packSigCanvas.current?.clear()} className="text-xs font-bold text-slate-500 hover:text-slate-600 underline">Limpiar</button>
                                                        </div>
                                                        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl overflow-hidden touch-none relative">
                                                            <div className="absolute top-1/2 left-0 w-full border-b border-dashed border-slate-300 pointer-events-none"></div>
                                                            <SignatureCanvas
                                                                ref={packSigCanvas}
                                                                penColor="#0F6B78"
                                                                canvasProps={{className: 'w-full h-28 cursor-crosshair'}}
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => administerPack({ label: activePack.label, meds: pendingInActivePack })}
                                                            disabled={submitting}
                                                            className="w-full py-4 bg-[#0F6B78] hover:bg-[#0d5a66] text-white font-black rounded-2xl shadow-lg shadow-[#0F6B78]/30 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait">
                                                            {submitting ? 'Firmando…' : `Administrar pack · ${activePack.label}`}
                                                        </button>
                                                        <p className="text-[10px] text-center font-bold text-slate-500 uppercase tracking-wide">Al firmar certifico haber comprobado Las 5 Categorías Clínicas Correctas</p>
                                                    </div>
                                                )}

                                                {/* Todos omitidos → se avanza al siguiente pack en el próximo render */}
                                                {pendingInActivePack.length === 0 && (
                                                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-center text-xs font-black text-amber-700">
                                                        Pack resuelto (omisiones). Avanzando al siguiente…
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Packs completados — lista colapsada */}
                                {completedPacks.length > 0 && (
                                    <div className="pt-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Completados hoy</p>
                                        <div className="space-y-1">
                                            {completedPacks.map(cp => (
                                                <div key={cp.label} className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2">
                                                    <span className="flex items-center gap-2 text-xs font-black text-emerald-700">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Pack {cp.label}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-emerald-600">{cp.meds.length} med{cp.meds.length !== 1 ? 's' : ''}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Flujo PRN (S.O.S.) — preservado, colapsado por defecto */}
                                <div className="pt-3 mt-3 border-t border-slate-200">
                                    {activeMedAction === 'PRN' ? (
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                <p className="text-xs font-black text-amber-700 uppercase tracking-wide">Dosis PRN (S.O.S.)</p>
                                            </div>
                                            <input type="text" value={prnNote} onChange={e => setPrnNote(e.target.value)} placeholder="Ej. Tylenol 500mg" className="w-full bg-white p-3 rounded-xl font-bold outline-none border-2 border-amber-200 focus:border-amber-400 text-amber-900 text-sm" />
                                            <div className="bg-white border-2 border-amber-200 rounded-xl overflow-hidden touch-none relative">
                                                <div className="absolute top-1/2 left-0 w-full border-b border-dashed border-amber-200 pointer-events-none"></div>
                                                <SignatureCanvas ref={sigCanvas} penColor="#b45309" canvasProps={{className: 'w-full h-24 cursor-crosshair'}} />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => sigCanvas.current?.clear()} className="px-3 py-2 text-[11px] font-bold text-amber-700 underline">Limpiar firma</button>
                                                <button onClick={() => { setActiveMedAction(null); setPrnNote(""); }} className="flex-1 py-3 bg-slate-100 text-slate-700 font-black rounded-xl text-sm">Cancelar</button>
                                                <button onClick={() => submitBulkMeds('PRN')} disabled={submitting} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-md text-sm disabled:opacity-60">Confirmar PRN</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setActiveMedAction('PRN')} className="w-full py-3 text-xs font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors">
                                            + Registrar dosis PRN (S.O.S.)
                                        </button>
                                    )}
                                </div>
                            </div>
                            );
                        })()}

                        {modalType === 'FALL' && (
                            <div className="space-y-4 mt-2">
                                <p className="font-black text-rose-600 uppercase text-lg border-b-2 border-rose-100 pb-2 flex items-center gap-2"><span></span> Protocolo de Caída</p>
                                <div className="bg-rose-50 p-5 rounded-2xl border border-rose-200 space-y-4 shadow-inner">
                                    <label className="flex items-center justify-between font-bold text-rose-900 cursor-pointer">
                                        ¿El residente reacciona y está consciente?
                                        <input type="checkbox" checked={fallProtocol.consciousness} onChange={e => setFallProtocol({ ...fallProtocol, consciousness: e.target.checked })} className="w-6 h-6 accent-rose-600" />
                                    </label>
                                    <label className="flex items-center justify-between font-bold text-rose-900 cursor-pointer">
                                        ¿Hay sangrado avistable?
                                        <input type="checkbox" checked={fallProtocol.bleeding} onChange={e => setFallProtocol({ ...fallProtocol, bleeding: e.target.checked })} className="w-6 h-6 accent-rose-600" />
                                    </label>
                                    <div>
                                        <label className="text-sm font-bold text-rose-800 drop-shadow-sm">Nivel de Dolor Vocalizado ({fallProtocol.painLevel}/10)</label>
                                        <input type="range" min="0" max="10" value={fallProtocol.painLevel} onChange={e => setFallProtocol({ ...fallProtocol, painLevel: parseInt(e.target.value) })} className="w-full mt-2 accent-rose-600" />
                                    </div>
                                </div>
                                <button onClick={submitFall} disabled={submitting} className="w-full py-5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl mt-4 shadow-rose-500/30">Evaluar Riesgo y Enviar Alerta Roja</button>
                            </div>
                        )}

                        {modalType === 'HOSPITAL_TRANSFER' && (
                            <div className="space-y-4 mt-2">
                                <p className="font-black text-red-600 uppercase text-lg border-b-2 border-red-100 pb-2 flex items-center gap-2"><span></span> Traslado a Hospital / ER</p>
                                <div className="bg-red-50 p-5 rounded-2xl border border-red-200 shadow-inner">
                                    <p className="text-red-900 font-bold mb-4 text-sm leading-relaxed">
                                        Al presionar este botón, se modificará el estatus clínico del residente y se generará instantáneamente una <strong>Nota de Progreso Clínica (Handover)</strong> en PDF lista para imprimir y entregar a los paramédicos de turno.
                                    </p>
                                    <label className="text-sm font-black text-red-800 uppercase block mb-2">Motivo del Traslado de Emergencia:</label>
                                    <ZendiAssist
                                        value={hospitalReason}
                                        onChange={setHospitalReason}
                                        type="FORMAT_NOTES"
                                        context="motivo de traslado de emergencia hospitalaria"
                                        placeholder="Ej. Residente presenta fuerte dolor en el pecho y dificultad respiratoria (Desaturando a 85%). Activado protocolo emergencia."
                                        rows={4}
                                    />
                                </div>
                                <div className="space-y-3 mt-4">
                                    <button onClick={submitHospitalTransfer} disabled={submitting || !hospitalReason} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-3">
                                        {submitting ? "Procesando..." : <><span></span> Empezar Traslado e Imprimir Nota Corta</>}
                                    </button>

                                    <EmergencyPdfButton
                                        patientId={activePatient.id}
                                        className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-black text-md rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>�</span> Imprimir Expediente Clínico Completo (PDF)
                                    </EmergencyPdfButton>
                                </div>
                            </div>
                        )}

                        {modalType === 'PROGRESS_NOTE_PDF' && pdfNoteData && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                                <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                                    <div className="p-5 bg-slate-800 text-white flex justify-between items-center">
                                        <h3 className="font-bold flex items-center gap-2 text-xl"><span></span> Documento Handover (Vivid)</h3>
                                        <div className="flex gap-4">
                                            <button className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white font-black px-6 py-2 rounded-xl text-sm shadow-lg shadow-emerald-500/20" onClick={() => window.print()}> Imprimir Progress Note</button>
                                            <button onClick={() => { setModalType(null); setPdfNoteData(null); }} className="text-slate-500 hover:text-white font-bold px-4"> Cerrar</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex justify-center">
                                        {/* Hoja Blanca Imprimible */}
                                        <div className="bg-white p-12 w-full shadow-sm border border-slate-200">
                                            <div className="flex justify-between items-start mb-8 border-b-4 border-slate-800 pb-6">
                                                <div>
                                                    <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Emergency Handover Form</h1>
                                                    <p className="text-slate-500 font-bold mt-1 text-lg">Zendity Care Platform  {pdfNoteData.headquarters?.name || "Vivid Senior Living Cupey"}</p>
                                                </div>
                                                <div className="text-right text-sm text-slate-600">
                                                    <p><span className="font-bold text-slate-800">Fecha de Traslado:</span> {format(new Date(pdfNoteData.printDate), "d 'de' MMMM yyyy, h:mm a", { locale: es })}</p>
                                                    <p><span className="font-bold text-slate-800">Generado Por:</span> Zendi A.I. System</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8 mb-8 border-b-2 border-slate-100 pb-8">
                                                <div>
                                                    <p className="text-sm font-black text-indigo-500 uppercase tracking-widest mb-2">Información del Residente</p>
                                                    <p className="text-3xl font-black text-slate-900 leading-tight mb-2">{pdfNoteData.name}</p>
                                                    <div className="space-y-1 text-slate-700 font-medium">
                                                        <p><span className="font-bold text-slate-500 w-24 inline-block">Habitación:</span> {pdfNoteData.roomNumber || 'N/A'}</p>
                                                        <p><span className="font-bold text-slate-500 w-24 inline-block">Condición:</span> {pdfNoteData.lifePlan?.medicalCondition || 'No especificada en PAI'}</p>
                                                        <p><span className="font-bold text-slate-500 w-24 inline-block">Dieta / TR:</span> {pdfNoteData.diet || pdfNoteData.lifePlan?.feeding || 'Normal'}</p>
                                                        <p className="text-rose-600"><span className="font-bold text-rose-300 w-24 inline-block">Alergias:</span> {pdfNoteData.lifePlan?.allergies || 'NKA (No Known Allergies)'}</p>
                                                    </div>
                                                </div>
                                                <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-2xl">
                                                    <p className="text-sm font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2"><span></span> Motivo de Ingreso a Sala de Emergencias</p>
                                                    <p className="text-rose-900 font-bold leading-relaxed">{pdfNoteData.transferReason}</p>
                                                </div>
                                            </div>

                                            <div className="mb-8">
                                                <p className="text-sm font-black text-teal-600 uppercase tracking-widest mb-4">Medication List (eMAR Centralizado)</p>
                                                <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                                                    <thead className="bg-slate-100">
                                                        <tr className="text-left">
                                                            <th className="py-3 px-4 font-black text-slate-700 uppercase">Medicamento</th>
                                                            <th className="py-3 px-4 font-black text-slate-700 uppercase">Dosis</th>
                                                            <th className="py-3 px-4 font-black text-slate-700 uppercase">Categoría</th>
                                                            <th className="py-3 px-4 font-black text-slate-700 uppercase">Frecuencia / Vía</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {pdfNoteData.medications?.length > 0 ? (
                                                            pdfNoteData.medications.map((m: any) => (
                                                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="py-3 px-4 font-bold text-slate-800">{m.medication?.name}</td>
                                                                    <td className="py-3 px-4 text-slate-600 font-medium">{m.medication?.dosage}</td>
                                                                    <td className="py-3 px-4">
                                                                        <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold text-xs">{m.medication?.category || 'General'}</span>
                                                                        {m.medication?.isControlled && <span className="text-rose-600 font-black ml-2 text-xs border border-rose-200 px-1 rounded">Controlado</span>}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-slate-600 font-medium">{m.scheduleTimes}  {m.medication?.route}</td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan={4} className="py-6 text-center text-slate-500 font-bold">Sin medicamentos registrados</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="mt-16 text-center text-sm text-slate-500 border-t-2 border-dashed border-slate-200 pt-8">
                                                Este documento oficial es un resumen generado por inteligencia clínica del eMAR de la institución. No debe considerarse una prescripción médica final sino un historial de transición.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FASE 32: ACTION HUB OVERLAY */}
                        {modalType === 'HUB' && (
                            <div className="space-y-4">
                                <p className="font-black text-slate-800 uppercase text-lg border-b-2 border-slate-100 pb-2 flex items-center gap-2"><span></span> Operaciones Centrales</p>

                                {!hubAction ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <button onClick={() => setHubAction("CLINICAL")} className="flex items-center gap-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 p-5 rounded-2xl transition-all shadow-sm">
                                            <span className="text-4xl drop-shadow-sm">🩺</span>
                                            <div className="text-left">
                                                <p className="font-black text-purple-900 text-base leading-tight">Cambio Clínico u Observación</p>
                                                <p className="font-bold text-purple-700/70 text-xs mt-1">Fiebre, Dolor, Comportamiento</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setHubAction("COMPLAINT")} className="flex items-center gap-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 p-5 rounded-2xl transition-all shadow-sm">
                                            <span className="text-4xl drop-shadow-sm">🤝</span>
                                            <div className="text-left">
                                                <p className="font-black text-orange-900 text-base leading-tight">Queja o Situación Familiar</p>
                                                <p className="font-bold text-orange-700/70 text-xs mt-1">Visitantes, Desacuerdos</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setHubAction("MAINTENANCE")} className="flex items-center gap-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-5 rounded-2xl transition-all shadow-sm">
                                            <span className="text-4xl drop-shadow-sm">🔧</span>
                                            <div className="text-left">
                                                <p className="font-black text-slate-700 text-base leading-tight">Incidente de Mantenimiento</p>
                                                <p className="font-bold text-slate-500 text-xs mt-1">Derrames, Luces, Limpieza</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setHubAction("UPP_ALERT")} className="flex items-center gap-4 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 p-5 rounded-2xl transition-all shadow-sm">
                                            <span className="text-4xl drop-shadow-sm">🩹</span>
                                            <div className="text-left">
                                                <p className="font-black text-fuchsia-900 text-base leading-tight">Alerta Piel / UPP</p>
                                                <p className="font-bold text-fuchsia-700/70 text-xs mt-1 text-ellipsis overflow-hidden whitespace-nowrap">Enrojecimiento, Herida Nueva</p>
                                            </div>
                                        </button>
                                        <button onClick={() => { setModalType('FALL'); setHubAction(null); }} className="flex items-center gap-4 bg-rose-50 hover:bg-rose-100 border border-rose-300 p-5 rounded-2xl transition-all shadow-md active:scale-95 group">
                                            <span className="text-4xl drop-shadow-sm group-hover:scale-110 transition-transform">🚨</span>
                                            <div className="text-left">
                                                <p className="font-black text-rose-700 text-base leading-tight">Alerta Crítica: Caída</p>
                                                <p className="font-bold text-rose-500/80 text-xs mt-1 uppercase tracking-widest">Protocolo Morse Inmediato</p>
                                            </div>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-right-4">
                                        <button onClick={() => setHubAction(null)} className="text-sm font-bold text-indigo-500 mb-2">← Cambiar Tipo de Reporte</button>

                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                            <label className="text-sm font-bold text-slate-500 block mb-2">Residente Involucrado (Requerido)</label>
                                            <select value={hubPatientId} onChange={e => setHubPatientId(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500">
                                                <option value="">-- Seleccionar Residente --</option>
                                                {patients.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 shadow-inner">
                                            <div className="flex justify-between items-center mb-3">
                                                <label className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                                                    Escritura Inteligente
                                                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md text-[10px]">ZENDI AI</span>
                                                </label>
                                            </div>
                                            
                                            {hubAction === 'UPP_ALERT' && (
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {['Enrojecimiento Temprano', 'Piel Rota', 'Drenaje Leve', 'Dolor al Tacto', 'Zona Sacra', 'Talones', 'Cambio Urgente'].map(tag => (
                                                        <button key={tag} onClick={(e) => { e.preventDefault(); setHubDescription(prev => prev ? `${prev}, ${tag}` : `Alerta Preventiva UPP: Se detecta ${tag}`); }} className="bg-white border border-indigo-200 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors shadow-sm active:scale-95">
                                                            + {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {hubAction === 'CLINICAL' && (
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {['Agresividad', 'Fiebre Alta', 'Dolor Fuerte', 'Aislamiento Social', 'Rechazo a Medicamento', 'Cambio en Piel'].map(tag => (
                                                        <button key={tag} onClick={(e) => { e.preventDefault(); setHubDescription(prev => prev ? `${prev}, ${tag}` : `Residente presenta ${tag}`); }} className="bg-white border border-indigo-200 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors shadow-sm active:scale-95">
                                                            + {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {hubAction === 'COMPLAINT' && (
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {['Duda Médica', 'Desacuerdo Cuidado', 'Petición Excepcional', 'Objeto Perdido', 'Calidad Comida'].map(tag => (
                                                        <button key={tag} onClick={(e) => { e.preventDefault(); setHubDescription(prev => prev ? `${prev}, ${tag}` : `Familia reporta ${tag}`); }} className="bg-white border border-indigo-200 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors shadow-sm active:scale-95">
                                                            + {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {hubAction === 'MAINTENANCE' && (
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {['Derrame Líquido', 'Foco Fundido', 'Baño Tapado', 'Fallo TV/AC'].map(tag => (
                                                        <button key={tag} onClick={(e) => { e.preventDefault(); setHubDescription(prev => prev ? `${prev}. ${tag}` : `Incidente operativo: ${tag}`); }} className="bg-white border border-indigo-200 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors shadow-sm active:scale-95">
                                                            + {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <label className="text-xs font-bold text-slate-500 block mb-2">Detalle Final (Formulado Automáticamente)</label>
                                            <ZendiAssist
                                                value={hubDescription}
                                                onChange={setHubDescription}
                                                type="FORMAT_NOTES"
                                                context="detalle de reporte operativo o queja familiar"
                                                placeholder="Toca las etiquetas rápidas o escribe manualmente..."
                                                rows={4}
                                            />
                                        </div>

                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                            <label className="text-sm font-bold text-slate-500 block mb-2"> Evidencia Fotográfica (Opcional)</label>
                                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 bg-white hover:bg-slate-50 transition-colors relative cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    onChange={handlePhotoCapture}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                                {hubPhotoBase64 ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-24 h-24 rounded-lg overflow-hidden shadow-md">
                                                            <img src={hubPhotoBase64} alt="Evidencia" className="w-full h-full object-cover" />
                                                        </div>
                                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200"> Foto Adjunta</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-slate-500">
                                                        <span className="text-4xl"></span>
                                                        <span className="font-bold text-sm">Tocar para tomar foto</span>
                                                        <span className="text-xs text-slate-500 text-center">Abrirá la cámara o galería</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={submitHubReport}
                                            disabled={submitting || !hubPatientId || !hubDescription}
                                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-all"
                                        >
                                            {submitting ? "Codificando Alerta..." : `Generar Ticket ${hubAction === 'COMPLAINT' ? 'Familiar' : hubAction === 'CLINICAL' ? 'Clínico' : 'Operativo'}`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* FASE 11: DISPATCHER FAST ACTION 15-MIN (SUPERVISOR) */}
                        {modalType === 'FAST_ACTION_DISPATCH' && (
                            <div className="space-y-4">
                                <p className="font-black text-slate-800 uppercase text-lg border-b-2 border-slate-100 pb-2 flex items-center gap-2"><span></span> Asignación de Tarea SLA (15-Min)</p>
                                <p className="text-slate-500 font-medium text-sm">El cuidador seleccionado recibirá la alerta In-App y tendrá 15 minutos exactos para cumplirla o se penalizará su Score de Cumplimiento.</p>

                                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-right-4">
                                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200">
                                        <label className="text-sm font-bold text-indigo-900 block mb-2">Empleado Destino (Cuidador)</label>
                                        <select value={hubCaregiverId} onChange={e => setHubCaregiverId(e.target.value)} className="w-full p-4 rounded-xl border-2 border-indigo-200 bg-white font-bold text-slate-800 outline-none focus:border-indigo-500">
                                            <option value="">-- Seleccionar Personal Activo --</option>
                                            {hubCaregiversList.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                        <label className="text-sm font-bold text-slate-500 block mb-2">Mandato u Orden (Obligatorio)</label>
                                        <ZendiAssist
                                            value={hubDescription}
                                            onChange={setHubDescription}
                                            type="FORMAT_NOTES"
                                            context="mandato u orden operativa para cuidador"
                                            placeholder="Ej. Realizar reporte del residente Artemia por cambio de salud..."
                                            rows={4}
                                        />
                                    </div>

                                    <button
                                        onClick={submitSupervisorFastAction}
                                        disabled={submitting || !hubCaregiverId || !hubDescription}
                                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-all flex justify-center items-center gap-2"
                                    >
                                        {submitting ? "Despachando..." : "Despachar Asignación (15 minutos reloj)"}
                                    </button>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            )}


            {/* FASE NUEVA: SHIFT CLOSURE WIZARD */}
            <ShiftClosureWizard
                onResolveWarning={async () => true}
                isOpen={modalType === 'SHIFT_CLOSURE_WIZARD'}
                onClose={() => setModalType(null)}
                shiftSessionId={activeSession?.id || null}
                onFinalize={async (data, signature) => {
                    try {
                        const res = await fetch("/api/care/shift/end", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                shiftSessionId: activeSession.id,
                                handoverData: data,
                                signature,
                            })
                        });
                        if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            alert(errData.error || "Error finalizando turno. Intenta nuevamente.");
                            return false;
                        }
                        alert("Turno Entregado. Has protegido tus registros para auditoría mediante Zendi.");
                        await logout();
                        return true;
                    } catch (e) {
                        alert("Error finalizando turno localmente.");
                        return false;
                    }
                }}
            />


            {/* FASE 32: Floating Action Hub Trigger (REMOVED to Header) */}
            {/*
            {!briefingMode && activeSession && (
                <button
                    onClick={() => { setHubAction(null); setModalType('HUB'); }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 hover:bg-slate-800 text-white font-black px-8 py-5 rounded-xl shadow-2xl flex items-center gap-3 active:scale-95 transition-all z-40 border-4 border-slate-800 hover:border-slate-700 group hover:pr-6"
                >
                    <span className="text-3xl group-hover:rotate-12 transition-transform"></span>
                    <span className="text-xl tracking-tight">Acciones Rápidas</span>
                </button>
            )}
            */}

            {/* Zendi Contextual Toast Notification */}
            {zendiToast && (
                <div className="fixed bottom-8 right-8 bg-slate-800 text-teal-400 p-5 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom font-bold border border-teal-500/30 flex items-center gap-4 max-w-sm">
                    <span className="text-3xl animate-pulse"></span>
                    <span className="leading-tight">{zendiToast}</span>
                </div>
            )}

            {/* PDF Incident Report de caída — se abre tras reportar si el cuidador confirma */}
            {printingFallId && (
                <FallIncidentPrint
                    fallIncidentId={printingFallId}
                    onClose={() => setPrintingFallId(null)}
                />
            )}

            {/* Modal de justificación tardía — orden de vitales vencida */}
            {lateReasonOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-amber-200 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-start gap-4 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">⏰</div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg leading-tight">Ventana de vitales vencida</h3>
                                <p className="text-slate-500 text-sm font-medium mt-1">Registrar fuera de la ventana de 4h aplica <span className="font-black text-amber-700">-2 pts</span> a tu score de cumplimiento. Documenta por qué:</p>
                            </div>
                        </div>
                        <textarea
                            value={lateReasonDraft}
                            onChange={e => setLateReasonDraft(e.target.value)}
                            placeholder="Ej: Atendí crisis respiratoria de otro residente simultáneamente…"
                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none rounded-2xl p-4 text-sm font-medium text-slate-700 min-h-[120px] resize-none transition-all"
                            maxLength={500}
                        />
                        <div className="flex justify-between items-center mt-2 mb-5 text-xs font-bold">
                            <span className={lateReasonDraft.trim().length < 20 ? 'text-rose-500' : 'text-emerald-600'}>
                                {lateReasonDraft.trim().length < 20
                                    ? `Mínimo 20 caracteres (${lateReasonDraft.trim().length}/20)`
                                    : `✓ Justificación válida (${lateReasonDraft.trim().length} chars)`}
                            </span>
                            <span className="text-slate-400">{lateReasonDraft.length}/500</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setLateReasonOpen(false); setLateReasonDraft(""); }}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => submitVitals(lateReasonDraft.trim())}
                                disabled={lateReasonDraft.trim().length < 20 || submitting}
                                className={`flex-1 py-4 font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                                    lateReasonDraft.trim().length < 20 || submitting
                                        ? 'bg-amber-200 text-amber-400 cursor-not-allowed'
                                        : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/30 active:scale-95'
                                }`}
                            >
                                {submitting ? 'Registrando…' : 'Registrar con justificación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat interno staff — montado al final para overlay completo */}
            <StaffChat
                open={staffChatOpen}
                onClose={() => setStaffChatOpen(false)}
                onUnreadChange={setStaffChatUnread}
            />
            </div>{/* end flex-1 main content */}
        </div>
    );
}
