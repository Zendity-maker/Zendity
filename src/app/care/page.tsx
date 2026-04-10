"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import EmergencyPdfButton from "@/components/medical/patient/EmergencyPdfButton";
import ZendiMomentsWidget from "@/components/care/zendi/ZendiMomentsWidget";
import ZendiCameraEnhancer from "@/components/care/ZendiCameraEnhancer";
import SignatureCanvas from "react-signature-canvas";
import ShiftClosureWizard from "@/components/care/ShiftClosureWizard";
import ZendiAssist from "@/components/ZendiAssist";
import { Toaster, toast } from 'sonner';

export default function ZendityCareTabletPage() {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    const { user, logout } = useAuth();
    const router = useRouter();
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
    const [fastActions, setFastActions] = useState<any[]>([]);
    const [dailyLog, setDailyLog] = useState<{ bathCompleted: boolean; foodIntake: number; notes: string; selectedMeal?: string }>({ bathCompleted: false, foodIntake: 100, notes: "", selectedMeal: undefined });
    const [fallProtocol, setFallProtocol] = useState({ consciousness: true, bleeding: false, painLevel: 5 });
    const [prnNote, setPrnNote] = useState("");
    const [omissionNote, setOmissionNote] = useState("");
    const [activeMedAction, setActiveMedAction] = useState<'ADMINISTER_ALL' | 'PRN' | 'OMISSION' | null>(null);
    const sigCanvas = useRef<any>(null); // FASE 60: eMAR Digital Signature
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
                        if (colorData.success && colorData.color && colorData.color !== 'ALL') {
                            // Hay asignacion activa en el roster
                            setSelectedColor(colorData.color);
                            localStorage.setItem('zendityCareShiftColor', colorData.color);
                            const patientRes = await fetch(`/api/care?color=${colorData.color}&hqId=${hq}`);
                            const patientData = await patientRes.json();
                            if (patientData.success) {
                                setPatients(patientData.patients || []);
                                setEvents(patientData.events || []);
                            }
                            return; // No necesita elegir manualmente
                        }
                    }

                    // 2. Fallback: usar color guardado en localStorage
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
            if (h === 9 && m === 30) setZendiToast("Zendity: Últimos 30 minutos para registrar baños del turno AM. Recuerda el cooldown de 10 minutos.");
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

    const submitVitals = async () => {
        if (!vitals.sys || !vitals.temp) return;
        setSubmitting(true);
        try {
            const payload = {
                patientId: activePatient.id,
                authorId: user?.id,
                type: 'VITALS',
                data: vitals
            };
            const res = await fetch("/api/care/vitals", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store"
            });
            const data = await res.json();
            if (data.success) {
                setVitals({ sys: "", dia: "", temp: "", hr: "", glucose: "", spo2: "" });
                refreshPatientsSilently(selectedColor!);
                
                if (data.criticalAlert) {
                    alert(data.message);
                    setDailyLog({ bathCompleted: false, foodIntake: 100, notes: `[ALERTA VITALES] ${data.message} \n\nEscriba los detalles de lo sucedido: ` });
                    setModalType('LOG');
                } else {
                    setModalType(null);
                }
            } else {
                alert("Error interno: " + data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const submitLog = async () => {
        setSubmitting(true);
        try {
            const payload = {
                patientId: activePatient.id,
                authorId: user?.id,
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

    const submitBulkMeds = async (action: 'ADMINISTER_ALL' | 'PRN' | 'OMISSION') => {
        if (action === 'PRN' && !prnNote.trim()) return alert("Especifique qué medicamento PRN se administra.");
        if (action === 'OMISSION' && !omissionNote.trim()) return alert("Debe especificar la razón clínica de descontinuar/omitir.");

        let signatureBase64 = null;
        if ((action === 'ADMINISTER_ALL' || action === 'PRN') && sigCanvas.current) {
            if (sigCanvas.current.isEmpty()) {
                return alert(" Es mandatorio plasmar su Firma Electrónica para administrar medicamentos.");
            }
            signatureBase64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        }

        setSubmitting(true);
        try {
            const medicationIds = activePatient.medications.map((m: any) => m.id);
            if (medicationIds.length === 0) return alert("No hay medicamentos para procesar.");

            let finalNotes = "Administrado de manera rutinaria";
            if (action === 'PRN') finalNotes = `SOS/PRN Aplicado: ${prnNote}`;
            if (action === 'OMISSION') finalNotes = `Omitido/Rechazado: ${omissionNote}`;

            const res = await fetch("/api/care/meds/bulk", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    medicationIds,
                    administeredById: user?.id,
                    notes: finalNotes,
                    signatureBase64
                })
            });
            const data = await res.json();
            if (data.success) {
                refreshPatientsSilently(selectedColor!);
                setActivePatient({
                    ...activePatient,
                    medications: []
                });
                setPrnNote("");
                setOmissionNote("");
                setActiveMedAction(null);
                setModalType(null);
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
                setDailyLog({ ...dailyLog, bathCompleted: true });
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

    const submitFall = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/incidents", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: activePatient.id,
                    headquartersId: user?.hqId || user?.headquartersId || "hq-demo-1",
                    type: 'FALL',
                    severity: 'HIGH',
                    description: `Residente sufrió caída. Consciente: ${fallProtocol.consciousness}, Sangrado: ${fallProtocol.bleeding}, Dolor Escala 1-10: ${fallProtocol.painLevel}`,
                    biometricSignature: user?.id || "emergency-bypass"
                })
            });
            const data = await res.json();
            if (data.success) {
                setFallProtocol({ consciousness: true, bleeding: false, painLevel: 5 });
                setModalType(null);
                alert(" Alerta Roja enviada al Mando de Enfermería Central.")
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
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-50">
                <div className="bg-white rounded-2xl p-10 max-w-2xl w-full text-center shadow-2xl animate-in zoom-in-95 relative flex flex-col items-center">
                    <button
                        onClick={() => logout()}
                        className="absolute top-6 right-8 text-slate-500 font-bold text-sm hover:text-rose-500 transition-colors flex items-center gap-2"
                    >
                        <span>Cerrar Sesión / Salir</span>
                    </button>
                    <h1 className="text-4xl font-black text-slate-800 mb-4">{activeSession ? "Continúa tu Turno Activo" : "¿Cuál es tu color de Turno?"}</h1>
                    <p className="text-xl text-slate-500 mb-10 font-medium">Zonificación de Cuidadores (Zendity Care)</p>
                    <div className="grid grid-cols-2 gap-6 w-full">
                        <button onClick={() => startTurnAndBriefing("RED")} className="h-40 rounded-3xl bg-red-500 hover:bg-red-600 text-white font-black text-3xl shadow-lg active:scale-95 transition-all">ROJO</button>
                        <button onClick={() => startTurnAndBriefing("YELLOW")} className="h-40 rounded-3xl bg-amber-400 hover:bg-amber-500 text-white font-black text-3xl shadow-lg active:scale-95 transition-all">AMARILLO</button>
                        <button onClick={() => startTurnAndBriefing("GREEN")} className="h-40 rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-3xl shadow-lg active:scale-95 transition-all">VERDE</button>
                        <button onClick={() => startTurnAndBriefing("BLUE")} className="h-40 rounded-3xl bg-blue-500 hover:bg-blue-600 text-white font-black text-3xl shadow-lg active:scale-95 transition-all">AZUL</button>
                    </div>
                </div>
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

    return (
        <div className="min-h-screen bg-slate-100 pb-20">
            <Toaster position="top-center" richColors />
            <div className={`w-full ${hexColor} py-6 px-8 shadow-md flex justify-between items-center text-white sticky top-0 z-40`}>
                <div className="flex items-center gap-4">
                    {user && (
                        <div className="flex items-center gap-3">
                            <ZendiCameraEnhancer 
                                targetId={user.id} 
                                isStaff={true} 
                                currentPhotoUrl={user?.photoUrl} 
                                placeholderInitials={user.name?.charAt(0) || "?"}
                            />
                            {user.complianceScore !== undefined && (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest border border-white/30 ${getZendityRank(user.complianceScore).badge}`}>
                                    <span className="text-lg">{getZendityRank(user.complianceScore).icon}</span>
                                    <div className="flex flex-col">
                                        <span className="leading-none">{getZendityRank(user.complianceScore).label}</span>
                                        <span className="text-[9px] opacity-80 mt-0.5">{user.complianceScore} Pts</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <h1 className="text-3xl font-black flex items-center gap-3">
                         Zendity Care
                        <span className="text-base font-bold uppercase tracking-widest bg-white/20 px-4 py-1.5 rounded-full">Grupo {selectedColor}</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    {(user?.role === "SUPERVISOR" || user?.role === "DIRECTOR" || user?.role === "ADMIN") && (
                        <button onClick={() => { setHubCaregiverId(""); setHubDescription(""); fetchCaregiversTarget(); setModalType('FAST_ACTION_DISPATCH'); }} className="px-5 py-3 font-black bg-white text-indigo-700 rounded-xl shadow-lg border border-indigo-200 hover:scale-105 transition-all flex items-center gap-2">
                            <span></span> Asignar Tarea
                        </button>
                    )}
                    <button onClick={() => { setHubAction(null); setModalType('HUB'); }} className="px-5 py-3 font-black bg-slate-900 text-white rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-2">
                        <span></span> Acciones Rápidas
                    </button>
                    <button onClick={() => setIsNightMode(!isNightMode)} className={`px-5 py-3 font-black rounded-xl shadow-lg transition-all flex items-center gap-2 ${isNightMode ? 'bg-indigo-200 text-indigo-900 border-2 border-indigo-400' : 'bg-indigo-900 text-indigo-300'}`}>
                        <span>{isNightMode ? '☀️ Modo Normal' : '🌙 Modo Rondas'}</span>
                    </button>
                    <button onClick={() => router.push('/cuidadores')} className="px-6 py-3 font-bold bg-white/10 hover:bg-white/20 rounded-xl transition-colors hidden md:block">Life Plans (PAI)</button>
                    <button onClick={handleLogoutAttempt} className="px-6 py-3 font-black bg-slate-900 border-2 border-slate-700 text-white rounded-xl shadow-lg hover:scale-105 transition-all">Entregar Turno</button>
                </div>
            </div>

            {/* Nav secundario para CAREGIVER */}
            {user?.role === 'CAREGIVER' && (
                <div className="bg-slate-900 border-b border-slate-700 px-8 py-2.5 flex items-center justify-between sticky top-[104px] z-50">
                    <span className="text-teal-400 font-black text-sm tracking-widest uppercase hidden md:block">Zendity</span>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { alert('Academy clicked'); router.push('/academy'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors border border-slate-700">
                            <span>🎓</span> Academy
                        </button>
                        <button onClick={() => { alert('Perfil clicked'); router.push('/care/profile'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors border border-slate-700">
                            <span>👤</span> Mi Perfil
                        </button>
                        {user?.photoUrl ? (
                            <img src={user.photoUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover border-2 border-teal-500" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-teal-700 border-2 border-teal-500 flex items-center justify-center text-white font-black text-sm">
                                {user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Nav secundario para NURSE */}
            {user?.role === 'NURSE' && (
                <div className="bg-slate-900 border-b border-slate-700 px-8 py-2.5 flex items-center justify-between sticky top-[104px] z-50">
                    <span className="text-teal-400 font-black text-sm tracking-widest uppercase hidden md:block">Zendity</span>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { alert('Vitales clicked'); router.push('/care/vitals'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors border border-slate-700">
                            <span>💉</span> Vitales
                        </button>
                        <button onClick={() => { alert('Academy clicked'); router.push('/academy'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors border border-slate-700">
                            <span>🎓</span> Academy
                        </button>
                        <button onClick={() => { alert('Perfil clicked'); router.push('/care/profile'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors border border-slate-700">
                            <span>👤</span> Mi Perfil
                        </button>
                        {user?.photoUrl ? (
                            <img src={user.photoUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover border-2 border-teal-500" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-teal-700 border-2 border-teal-500 flex items-center justify-center text-white font-black text-sm">
                                {user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                <ZendiMomentsWidget />

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

                {loading ? (
                    <div className="text-center p-20 text-xl font-bold text-slate-500 animate-pulse">Cargando Residentes...</div>
                ) : (
                    <>
                        {isNightMode ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-indigo-100 p-8 rounded-3xl shadow-xl border border-indigo-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                                     <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-20"></div>
                                     <div className="relative z-10">
                                         <h2 className="text-3xl font-black flex items-center gap-4 text-white">🌙 Night Rounds Mode</h2>
                                         <p className="text-indigo-300 font-bold mt-2 text-lg">Modo Ultra-Rápido: Registra rondas bi-horarias y cambios de pañal en 1 solo tap.</p>
                                     </div>
                                     <div className="bg-indigo-800/80 border border-indigo-600 px-6 py-4 rounded-2xl text-center shadow-inner relative z-10 backdrop-blur-sm shadow-xl mt-4 md:mt-0 w-full md:w-auto">
                                         <span className="block text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Hora Local del Turno</span>
                                         <span className="block text-4xl sm:text-5xl font-black font-mono text-white leading-none tracking-tight">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                     </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {patients.map(p => (
                                        <div key={p.id} className="bg-slate-800 border-[3px] border-slate-700 p-6 rounded-[2rem] text-white flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                                            {p.status === 'TEMPORARY_LEAVE' && <div className="absolute inset-0 bg-slate-900/80 z-20 flex items-center justify-center font-black text-xl text-slate-500 backdrop-blur-sm">FUERA DE EDIFICIO</div>}
                                            <div className="flex justify-between items-start mb-6 align-top">
                                                <h3 className="text-2xl font-black text-white pr-4 leading-tight">{p.name}</h3>
                                                {p.posturalChanges?.length > 0 && <span className="bg-teal-500/20 text-teal-300 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-teal-500/30 shrink-0 text-center">ROTADO: <br className="hidden md:block" /> {new Date(p.posturalChanges[p.posturalChanges.length-1].performedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 z-10">
                                                <button onClick={() => logNightRound(p.id, 'SECO')} disabled={isSavingFastAction} className="py-5 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 border border-slate-600 shadow-sm transition-all active:scale-95 disabled:opacity-50 text-[13px] tracking-wide text-center px-2">
                                                    <span className="text-3xl drop-shadow-sm mb-1 leading-none">✅</span> Pañal Seco
                                                </button>
                                                <button onClick={() => logNightRound(p.id, 'HUMEDO')} disabled={isSavingFastAction} className="py-5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 text-[13px] tracking-wide text-center px-1">
                                                    <span className="text-3xl drop-shadow-sm mb-1 leading-none">💧</span> Cambio (Orina)
                                                </button>
                                                <button onClick={() => logNightRound(p.id, 'EVACUACION')} disabled={isSavingFastAction} className="py-5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-2xl font-bold flex flex-col items-center gap-2 shadow-sm transition-all col-span-2 active:scale-95 disabled:opacity-50 text-base shadow-inner">
                                                    <span className="text-4xl drop-shadow-sm mb-1 leading-none">💩</span> Cambio (Evacuación)
                                                </button>
                                            </div>
                                            <button onClick={() => logNightRound(p.id, 'ROTACION')} disabled={isSavingFastAction} className="mt-4 w-full py-5 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-teal-500/30 active:scale-95 disabled:opacity-50 text-[13px] sm:text-sm z-10 border-b-4 border-teal-700 active:border-b-0 active:mt-5 active:mb-[-4px]">
                                                <span className="text-2xl leading-none">🔄</span> Rotación Postural 2Hrs
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                {patients.map(p => {
                                    const isAbsent = p.status === 'TEMPORARY_LEAVE';
                                    
                                    // Zendi UPP Engine (Day Mode)
                                    const lastRotation = p.posturalChanges?.length > 0 ? new Date(p.posturalChanges[0].performedAt) : null;
                                    const msElapsed = lastRotation ? Date.now() - lastRotation.getTime() : null;
                                    const hoursElapsed = msElapsed ? msElapsed / (1000 * 60 * 60) : 0;
                                    const isVencido = hoursElapsed > 2.05; // 2h 05m tolerance
                                    const isWarning = hoursElapsed >= 1.75 && hoursElapsed <= 2.05;

                                    return (
                                <div key={p.id} className={`bg-white rounded-2xl overflow-hidden shadow-xl border-t-8 border-t-${hexColor.split('-')[1]}-500 transform transition-all relative ${isAbsent ? 'opacity-70 saturate-50' : ''}`}>
                                    {isAbsent && (
                                        <div className="absolute inset-0 bg-slate-900/10 z-10 flex flex-col items-center justify-center backdrop-blur-[1px] gap-4">
                                            <div className="bg-amber-100 border border-amber-300 text-amber-800 px-6 py-2 rounded-full font-black flex items-center gap-2 shadow-2xl rotate-[-5deg] transform scale-105">
                                                <span className="text-2xl"></span> Residente Fuera de Instalaciones ({p.leaveType === 'HOSPITAL' ? 'Hospital' : 'Familia'})
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); returnResident(p.id); }}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold shadow-lg transition pointer-events-auto"
                                            >
                                                Registrar Retorno al Piso
                                            </button>
                                        </div>
                                    )}
                                    <div className="p-6 pb-4 border-b border-slate-100">
                                        <div className="flex justify-between items-start">
                                            <h2 className="text-2xl font-black text-slate-800 leading-tight">{p.name}</h2>
                                            <ZendiCameraEnhancer 
                                                targetId={p.id} 
                                                isStaff={false} 
                                                currentPhotoUrl={p.photoUrl} 
                                                placeholderInitials={p.name.charAt(0)} 
                                                onUploadSuccess={() => fetchPatients(selectedColor!)}
                                            />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            {p.lifePlan && p.lifePlan.dietDetails && <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 shadow-sm">PAI: {p.lifePlan.dietDetails}</p>}
                                            {p.nortonRisk && <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 shadow-sm flex items-center gap-1"><span>🛡️</span> Alto Riesgo Piel</p>}
                                            {p.pressureUlcers?.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest text-white bg-rose-600 px-2 py-1 rounded-md shadow-sm flex items-center gap-1"><span>🚨</span> UPP Activa</p>}
                                        </div>

                                        {/* FASE UPP: Zendi SLA Timer para Rotación Postural */}
                                        {p.nortonRisk && lastRotation && (
                                            <div className={`mt-4 p-3 rounded-xl border-2 flex items-center justify-between shadow-sm transition-all ${isVencido ? 'bg-rose-50 border-rose-300' : (isWarning ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200')}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-2xl ${isVencido ? 'text-rose-600' : (isWarning ? 'text-amber-500' : 'text-slate-500')}`}>⏳</span>
                                                    <div>
                                                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${isVencido ? 'text-rose-800' : (isWarning ? 'text-amber-800' : 'text-slate-500')}`}>SLA Zendi: Rotar 2H</p>
                                                        <p className={`text-sm font-bold leading-none ${isVencido ? 'text-rose-600' : (isWarning ? 'text-amber-600' : 'text-slate-700')}`}>
                                                            {hoursElapsed.toFixed(1)} hrs <span className="text-xs font-medium opacity-70">/ 2.0 hrs req.</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right border-l pl-3 border-opacity-20 border-black flex flex-col items-end gap-1">
                                                    <p className={`text-[10px] w-full block font-black uppercase tracking-widest leading-none mb-1 ${isVencido ? 'text-rose-600' : (isWarning ? 'text-amber-600' : 'text-slate-500')}`}> {isVencido ? '¡RETRASO SLA!' : (isWarning ? 'Próxima' : 'Piel En Regla')} </p>
                                                    <p className="text-xs font-bold text-slate-500 leading-none">Pos. {p.posturalChanges[0]?.position?.split(' ')[0] || 'N/A'}</p>
                                                    
                                                    {/* Quick Action Rotation */}
                                                    <div className="flex bg-white rounded-lg overflow-hidden border border-slate-200 mt-1 shadow-sm shadow-slate-200/50">
                                                        <button onClick={(e) => { e.stopPropagation(); logNightRound(p.id, 'ROTACION', 'Izquierdo'); }} className="px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 border-r border-slate-100 transition-colors">👈 Izq</button>
                                                        <button onClick={(e) => { e.stopPropagation(); logNightRound(p.id, 'ROTACION', 'Supino'); }} className="px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 border-r border-slate-100 transition-colors">⬆️ Sup</button>
                                                        <button onClick={(e) => { e.stopPropagation(); logNightRound(p.id, 'ROTACION', 'Derecho'); }} className="px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors">👉 Der</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}


                                        {/* FASE 66: AT-A-GLANCE DAILY PROGRESS BADGES */}
                                        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
                                            <div className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${p.bathLogs?.length > 0 ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-500 opacity-60 border border-transparent'}`}>
                                                <span className="text-base">🚿</span> Baño
                                            </div>
                                            <div className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${p.mealLogs?.length > 0 ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500 opacity-60 border border-transparent'}`}>
                                                <span className="text-base">🍽️</span> {p.mealLogs?.length || 0}/3 Comidas
                                            </div>
                                        </div>

                                        {p.vitalSigns?.length > 0 && (
                                            <div className="mt-4 bg-teal-50 border-2 border-teal-200 hover:bg-teal-100 transition-colors cursor-pointer rounded-xl p-4 shadow-sm flex items-center justify-between" onClick={(e) => { e.stopPropagation(); setActivePatient(p); setModalType('VITALS_HISTORY'); }}>
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-teal-500 text-white rounded-full p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                                                    <div>
                                                        <p className="text-xs font-black text-teal-800 uppercase tracking-widest leading-none mb-1">Vitales del Turno</p>
                                                        <p className="text-[11px] font-bold text-teal-700 leading-none">
                                                            P: {p.vitalSigns[0]?.systolic}/{p.vitalSigns[0]?.diastolic} | HR: {p.vitalSigns[0]?.heartRate} | T: {p.vitalSigns[0]?.temperature}°
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right border-l border-teal-200 pl-3">
                                                    <span className="text-[9px] w-full block text-teal-600 font-bold uppercase tracking-widest leading-none mb-1">Última Toma</span>
                                                    <span className="font-black text-teal-900 leading-none">{new Date(p.vitalSigns[0]?.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="text-[9px] font-bold text-teal-600/80 block mt-1 uppercase">por {p.vitalSigns[0]?.user?.name?.split(' ')[0] || 'Staff'}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`p-5 grid grid-cols-2 gap-4 bg-slate-50/50 rounded-b-[2.5rem] ${isAbsent ? 'pointer-events-none' : ''}`}>
                                        <button onClick={() => { setActivePatient(p); setVitals({ sys: "", dia: "", temp: "", hr: "", glucose: "", spo2: "" }); setModalType('VITALS'); }} className="py-5 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center gap-3 hover:border-teal-500 hover:text-teal-700 transition-all shadow-sm active:scale-95">
                                            <span className="text-3xl drop-shadow-sm leading-none">❤️</span><span className="text-sm font-black text-slate-700 uppercase tracking-widest mt-0.5">Vitales</span>
                                        </button>
                                        <button onClick={() => { setActivePatient(p); setModalType('LOG'); }} className="py-5 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center gap-3 hover:border-indigo-400 hover:text-indigo-700 transition-all shadow-sm active:scale-95">
                                            <span className="text-3xl drop-shadow-sm leading-none">📝</span><span className="text-sm font-black text-slate-700 uppercase tracking-widest mt-0.5">Bitácora</span>
                                        </button>
                                        <button onClick={() => { setActivePatient(p); setModalType('MEDS'); }} className="py-5 bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-2xl flex items-center justify-center gap-3 hover:from-teal-100 hover:to-emerald-100 col-span-2 shadow-sm transition-all focus:ring-4 focus:ring-teal-300/50 active:scale-95">
                                            <span className="text-3xl drop-shadow-sm leading-none">💊</span><span className="text-base font-black text-teal-800 uppercase tracking-widest">Medicamentos</span>
                                        </button>
                                        <button onClick={() => { setActivePatient(p); setModalType('FALL'); }} className="w-full py-4 bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 text-rose-700 font-black rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm mt-1 active:scale-95">
                                            <span className="text-2xl leading-none">⚠️</span> <span className="text-xs uppercase tracking-widest mt-0.5">Alerta Caída</span>
                                        </button>
                                        <button onClick={() => { setActivePatient(p); setModalType('HOSPITAL_TRANSFER'); }} className="w-full py-4 bg-slate-800 hover:bg-slate-900 border-2 border-slate-800 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-md transition-colors mt-1 active:scale-95">
                                            <span className="text-2xl leading-none">🚑</span> <span className="text-xs uppercase tracking-widest mt-0.5">Trasladar ER</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
                                    <input type="number" placeholder="Sistólica (Ej 120)" value={vitals.sys} onChange={e => setVitals({ ...vitals, sys: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                    <input type="number" placeholder="Diastólica (Ej 80)" value={vitals.dia} onChange={e => setVitals({ ...vitals, dia: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                    <input type="number" placeholder="Pulso (HR)" value={vitals.hr} onChange={e => setVitals({ ...vitals, hr: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                    <input type="number" placeholder="Temp °F (Ej 98.6)" value={vitals.temp} onChange={e => setVitals({ ...vitals, temp: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg md:col-span-1 focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                    <input type="number" placeholder="Oxigenación (SpO2 %)" value={vitals.spo2} onChange={e => setVitals({ ...vitals, spo2: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg md:col-span-1 focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                    <input type="number" placeholder="Glucosa mg/dL" value={vitals.glucose} onChange={e => setVitals({ ...vitals, glucose: e.target.value })} className="bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-lg md:col-span-1 focus:border-teal-500 focus:ring-4 outline-none transition-all" />
                                </div>
                                {aiSuggestion && (<div className="p-5 bg-teal-50 border-2 border-teal-200 rounded-2xl text-teal-800 text-base font-bold shadow-inner flex items-center gap-3"><span className="text-2xl">🧠</span> {aiSuggestion}</div>)}
                                <button onClick={submitVitals} disabled={submitting} className={`w-full py-6 text-white font-black rounded-2xl mt-4 transition-all shadow-xl flex items-center justify-center gap-3 min-h-[72px] text-xl ${submitting ? 'bg-teal-800 opacity-80 cursor-wait' : 'bg-teal-600 hover:bg-teal-700 active:scale-95'}`}>
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
                                        <button onClick={handleBathLog} disabled={submitting || dailyLog.bathCompleted} className={`w-full py-3 rounded-xl font-bold transition-all ${dailyLog.bathCompleted ? 'bg-sky-200 text-sky-500 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/30 active:scale-95'}`}>
                                            {dailyLog.bathCompleted ? "Baño Registrado " : "Completar Baño de 6AM - 10AM"}
                                        </button>
                                        <p className="text-[10px] font-bold text-sky-600/60 mt-1.5 text-center uppercase tracking-wider">Protegido por 10-Min Cooldown</p>
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

                        {modalType === 'MEDS' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <p className="font-bold text-slate-500 uppercase text-sm">eMAR: Entrega de Fármacos</p>
                                    <a href={`/care/patient/emar-print?patientId=${activePatient?.id}`} target="_blank" className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors">
                                        <span></span> Imprimir Cardex
                                    </a>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-inner max-h-40 overflow-y-auto">
                                    {activePatient?.medications?.length > 0 ? (
                                        activePatient.medications.map((m: any) => (
                                            <div key={m.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                                                <div>
                                                    <p className="font-bold text-slate-800">{m.medication.name}</p>
                                                    <p className="text-xs text-slate-500">{m.medication.dosage} @ {m.scheduleTime}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm font-bold text-slate-500 text-center py-4">No hay medicamentos pautados pendientes.</p>
                                    )}
                                </div>

                                {activePatient?.medications?.length > 0 && (
                                    <div className="pt-2">

                                        <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-4 text-center">
                                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Firma electrónica activa</p>
                                            <p className="text-indigo-900 font-black">{user?.name}</p>
                                            <p className="text-[10px] text-indigo-600 font-bold mt-1">Tu sesión sirve como firma válida para suministrar.</p>
                                        </div>

                                        {activeMedAction === 'PRN' && (
                                            <div className="mb-4 animate-in fade-in slide-in-from-top-2">
                                                <label className="text-xs font-bold text-amber-600 block mb-1">Escribe qué medicamento S.O.S (PRN) se administra:</label>
                                                <input type="text" value={prnNote} onChange={e => setPrnNote(e.target.value)} placeholder="Ej. Tylenol 500mg" className="w-full bg-amber-50 p-4 rounded-xl font-bold outline-none border-2 border-amber-200 focus:border-amber-400 text-amber-900" />
                                            </div>
                                        )}

                                        {activeMedAction === 'OMISSION' && (
                                            <div className="mb-4 animate-in fade-in slide-in-from-top-2">
                                                <label className="text-xs font-bold text-rose-600 block mb-1">Razón para Descontinuar / Omitir:</label>
                                                <input type="text" value={omissionNote} onChange={e => setOmissionNote(e.target.value)} placeholder="Ej. Residente vomitando, orden del dr. X" className="w-full bg-rose-50 p-4 rounded-xl font-bold outline-none border-2 border-rose-200 focus:border-rose-400 text-rose-900" />
                                            </div>
                                        )}

                                        {/* FASE 60: eMAR Digital Signature Canvas */}
                                        {(activeMedAction === 'ADMINISTER_ALL' || activeMedAction === 'PRN' || !activeMedAction) && (
                                            <div className="mb-5 animate-in fade-in">
                                                <div className="flex justify-between items-end mb-2">
                                                    <label className="text-sm font-black text-slate-700 block">Firma Clínica (Requerida)</label>
                                                    <button onClick={() => sigCanvas.current?.clear()} className="text-xs font-bold text-slate-500 hover:text-slate-600 underline">Limpiar Trazo</button>
                                                </div>
                                                <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden touch-none relative">
                                                    <div className="absolute top-1/2 left-0 w-full border-b border-dashed border-slate-200 pointer-events-none"></div>
                                                    <SignatureCanvas 
                                                        ref={sigCanvas} 
                                                        penColor="#334155"
                                                        canvasProps={{className: 'signature-canvas w-full h-32 cursor-crosshair'}} 
                                                    />
                                                </div>
                                                <p className="text-[10px] text-center font-bold text-slate-500 mt-2 uppercase tracking-wide">Al firmar certifico haber comprobado Las 5 Categorías Clínicas Correctas</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            {(!activeMedAction || activeMedAction === 'ADMINISTER_ALL') && (
                                                <button onClick={() => submitBulkMeds('ADMINISTER_ALL')} disabled={submitting} className="col-span-2 py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white font-black text-xl rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
                                                     Registrar Administración
                                                </button>
                                            )}

                                            {(!activeMedAction || activeMedAction === 'PRN') && (
                                                <button onClick={() => activeMedAction === 'PRN' ? submitBulkMeds('PRN') : setActiveMedAction('PRN')} disabled={submitting} className={`${activeMedAction === 'PRN' ? 'col-span-2' : ''} py-4 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-white font-bold rounded-xl shadow-md flex justify-center items-center gap-2`}>
                                                     {activeMedAction === 'PRN' ? 'Confirmar PRN' : 'Dar dosis PRN'}
                                                </button>
                                            )}

                                            {(!activeMedAction || activeMedAction === 'OMISSION') && (
                                                <button onClick={() => activeMedAction === 'OMISSION' ? submitBulkMeds('OMISSION') : setActiveMedAction('OMISSION')} disabled={submitting} className={`${activeMedAction === 'OMISSION' ? 'col-span-2' : ''} py-4 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white font-bold rounded-xl shadow-md flex justify-center items-center gap-2`}>
                                                     {activeMedAction === 'OMISSION' ? 'Confirmar Omisión' : 'Descontinuar'}
                                                </button>
                                            )}

                                            {activeMedAction && (
                                                <button onClick={() => { setActiveMedAction(null); setPrnNote(""); setOmissionNote(""); }} className="col-span-2 py-3 mt-2 text-slate-500 font-bold hover:text-slate-600 transition-colors">
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

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
                                                                    <td className="py-3 px-4 text-slate-600 font-medium">{m.scheduleTime}  {m.medication?.route}</td>
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
                onFinalize={async (data, signature) => {
                    console.log("Finalizando turno con:", data, signature);
                    try {
                        const res = await fetch("/api/care/shift/end", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ shiftSessionId: activeSession.id, forceEnd: true }) // Bypass for MVP demo
                        });
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
        </div>
    );
}
