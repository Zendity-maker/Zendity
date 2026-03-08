"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ZendityCareTabletPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [patients, setPatients] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

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
    const [modalType, setModalType] = useState<"VITALS" | "LOG" | "MEDS" | "FALL" | "HUB" | "HOSPITAL_TRANSFER" | "PROGRESS_NOTE_PDF" | null>(null);
    const [hospitalReason, setHospitalReason] = useState("");
    const [pdfNoteData, setPdfNoteData] = useState<any>(null);
    const [hubAction, setHubAction] = useState<"COMPLAINT" | "CLINICAL" | "MAINTENANCE" | null>(null);

    const [zendiToast, setZendiToast] = useState("");

    // Form States & Shadow AI
    const [vitals, setVitals] = useState({ sys: "", dia: "", temp: "", hr: "" });
    const [dailyLog, setDailyLog] = useState<{ bathCompleted: boolean; foodIntake: number; notes: string; selectedMeal?: string }>({ bathCompleted: false, foodIntake: 100, notes: "", selectedMeal: undefined });
    const [fallProtocol, setFallProtocol] = useState({ consciousness: true, bleeding: false, painLevel: 5 });
    const [prnNote, setPrnNote] = useState("");
    const [omissionNote, setOmissionNote] = useState("");
    const [activeMedAction, setActiveMedAction] = useState<'ADMINISTER_ALL' | 'PRN' | 'OMISSION' | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [formattingNotes, setFormattingNotes] = useState(false);

    // Action Hub States
    const [hubPatientId, setHubPatientId] = useState("");
    const [hubDescription, setHubDescription] = useState("");
    const [hubPhotoBase64, setHubPhotoBase64] = useState<string | null>(null);

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setHubPhotoBase64(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // ==========================================
    // FASE 30: CLOCK-IN & CENSUS VERIFICATION
    // ==========================================
    useEffect(() => {
        if (!user) return;
        const checkSession = async () => {
            try {
                const res = await fetch(`/api/care/shift/start?caregiverId=${user.id}`);
                const data = await res.json();
                if (data.success && data.activeSession) {
                    setActiveSession(data.activeSession);
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
                continueToBriefing(selectedColor!);
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

    const synthesizeZendiBriefing = (text: string) => {
        if (!('speechSynthesis' in window)) {
            setShowQuickRead(true);
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-US';
        utterance.pitch = 0.95; // Tono maduro, profesional y sereno
        utterance.rate = 1.15; // Velocidad fluida, profesional y resolutiva (sin perder serenidad)

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => { setIsSpeaking(false); setShowQuickRead(true); };
        utterance.onerror = () => { setIsSpeaking(false); setShowQuickRead(true); };

        window.speechSynthesis.speak(utterance);
    };

    const skipBriefing = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setShowQuickRead(true);
    };

    const enterCareFloor = () => {
        window.speechSynthesis.cancel();
        setBriefingMode(false);
        fetchPatients(selectedColor!);
    };
    // ==========================================

    // Shadow AI: Contextual Vitals
    useEffect(() => {
        if (modalType !== 'VITALS') { setAiSuggestion(null); return; }
        if (Number(vitals.temp) >= 99.2) {
            setAiSuggestion("💡 Zendity AI: Temperatura liminal. Se recomienda ofrecer aumento de ingesta hídrica preventiva y reassesment en 4 horas.");
        } else if (Number(vitals.sys) >= 140) {
            setAiSuggestion("💡 Zendity AI: Presión Sistólica > 140. Considere un lapso de relajación y volver a tomar la lectura.");
        } else {
            setAiSuggestion(null);
        }
    }, [vitals.temp, vitals.sys, modalType]);

    // FASE 30: Zendi Time-Based Operational Notifier
    useEffect(() => {
        if (!selectedColor || !activeSession) return;
        const interval = setInterval(() => {
            const h = new Date().getHours();
            const m = new Date().getMinutes();
            if (h === 8 && m === 30) setZendiToast("Zendity: Recuerda que la ventana de desayunos cierra en 90 minutos.");
            if (h === 9 && m === 30) setZendiToast("Zendity: Últimos 30 minutos para registrar baños del turno AM. Recuerda el cooldown de 10 minutos.");
            if (h === 12 && m === 0) setZendiToast("Zendity: La ventana de almuerzos está oficialmente abierta.");

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
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setVitals({ sys: "", dia: "", temp: "", hr: "" });
                setModalType(null);
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
                    notes: finalNotes
                })
            });
            const data = await res.json();
            if (data.success) {
                setActivePatient({
                    ...activePatient,
                    medications: []
                });
                setPrnNote("");
                setOmissionNote("");
                setActiveMedAction(null);
                setModalType(null);
                alert(`✅ Zendity Care: ${data.count} medicamentos procesados exitosamente.`);
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
                alert("🛀 Baño registrado al sistema central.");
                setDailyLog({ ...dailyLog, bathCompleted: true });
            } else {
                alert(`⚠️ Alerta: ${data.message || data.error}`);
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
                alert(`🍽️ Comida (${mealType}) registrada con métrica de consumo: ${quality}`);
            } else {
                alert(`⚠️ Error Clínico: ${data.error}`);
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
                alert("🚨 Alerta Roja enviada al Mando de Enfermería Central.")
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
                alert("🚑 Traslado registrado. Abriendo Nota de Progreso Médica para impresión...");
                setPdfNoteData({ ...data.patient, transferReason: hospitalReason, printDate: new Date() });
                setHospitalReason("");
                setModalType('PROGRESS_NOTE_PDF');

                // Fetch de nuevo para que el residente se vea deshabilitado con status TEMPORARY_LEAVE
                fetchPatients(selectedColor!);
            } else {
                alert(`⚠️ Error: ${data.error}`);
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

        // Mock de alerta frontend si hay cosas pendientes
        if (Math.random() > 0.8) {
            alert("✋ ALTO: Zendity detectó una dosis programada que no ha sido administrada. Se requiere justificación para finalizar turno.");
            return;
        }

        try {
            await fetch("/api/care/shift/end", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shiftSessionId: activeSession.id })
            });
            alert("✅ Turno Finalizado. Has protegido tus registros para auditoría (AI Shift Report Autogenerado).");
            router.push('/login');
        } catch (e) {
            console.error(e);
            alert("Error finalizando turno.");
        }
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
                alert(`✅ Reporte de tipo ${hubAction} enviado a Central.`);
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
        return <div className="fixed inset-0 bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-400 animate-pulse">Sincronizando Sistema Zendity...</div>;
    }

    if (!selectedColor && !briefingMode && !verifyingCensus) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-50">
                <div className="bg-white rounded-[3rem] p-10 max-w-2xl w-full text-center shadow-2xl animate-in zoom-in-95">
                    <h1 className="text-4xl font-black text-slate-800 mb-4">{activeSession ? "Continúa tu Turno Activo" : "¿Cuál es tu color de Turno?"}</h1>
                    <p className="text-xl text-slate-500 mb-10 font-medium">Zonificación de Cuidadores (Zendity Care)</p>
                    <div className="grid grid-cols-2 gap-6">
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
                <div className="bg-white rounded-[3rem] p-10 max-w-4xl w-full text-center shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                    <h1 className="text-4xl font-black text-slate-800 mb-2">Verificación de Censo</h1>
                    <p className="text-lg text-slate-500 mb-6 font-medium">
                        Confirma el estatus actual de cada residente en el <span className="font-bold text-slate-800">Grupo {selectedColor}</span>.
                    </p>

                    {loading ? (
                        <div className="py-10 text-slate-400 font-bold animate-pulse">Cargando residentes del grupo...</div>
                    ) : (
                        <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-3 text-left">
                            {patients.length === 0 && <div className="text-center p-8 text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-2xl">No hay residentes activos en este grupo.</div>}
                            {patients.map(p => (
                                <div key={p.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-black text-lg">{p.name.charAt(0)}</div>
                                        <span className="font-bold text-slate-800 text-xl">{p.name}</span>
                                    </div>
                                    <div className="flex flex-wrap bg-slate-200 rounded-xl p-1 gap-1">
                                        <button onClick={() => setCensusChecklist({ ...censusChecklist, [p.id]: 'PRESENT' })} className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${censusChecklist[p.id] === 'PRESENT' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>✅ Presente</button>
                                        <button onClick={() => setCensusChecklist({ ...censusChecklist, [p.id]: 'HOSPITAL' })} className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${censusChecklist[p.id] === 'HOSPITAL' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🏥 Hospital</button>
                                        <button onClick={() => setCensusChecklist({ ...censusChecklist, [p.id]: 'FAMILY_VISIT' })} className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${censusChecklist[p.id] === 'FAMILY_VISIT' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>👨‍👩‍👦 Familia</button>
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
                                    {submitting ? "Firmando Entrada..." : "✅ Confirmar Censo y Escuchar Zendi"}
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
                        <p className="text-slate-400 mt-2">Zendi está recopilando signos vitales e historiales recientes.</p>
                    </div>
                ) : (
                    <div className="z-10 max-w-3xl w-full text-center animate-in slide-in-from-bottom-10 fade-in duration-700">

                        {/* Visual Zendi Orb */}
                        <div className="relative mx-auto w-32 h-32 mb-8 group">
                            <div className={`absolute inset-0 bg-teal-400 rounded-full blur-xl transition-all duration-300 ${isSpeaking ? 'opacity-80 scale-125 animate-pulse' : 'opacity-30'}`}></div>
                            <div className="relative w-full h-full bg-slate-800 border-2 border-slate-700 rounded-full shadow-2xl flex items-center justify-center text-4xl">
                                ✨
                            </div>
                        </div>

                        <h1 className="text-4xl font-black mb-6 leading-tight max-w-2xl mx-auto">
                            {showQuickRead ? 'Resumen Visual del Turno' : 'Zendi Reporte Clínico'}
                        </h1>

                        {/* Text Narration (Simulating CC) */}
                        {!showQuickRead && (
                            <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-[2rem] backdrop-blur-md mb-8">
                                <p className="text-xl leading-relaxed text-teal-100 font-medium">"{briefingData.ttsMessage}"</p>
                            </div>
                        )}

                        {/* Visual Quick Read Dashboard */}
                        {showQuickRead && (
                            <div className="grid grid-cols-3 gap-6 mb-10 animate-in zoom-in-95">
                                <div className="bg-slate-800/80 border border-slate-700 rounded-[2rem] p-6 backdrop-blur-sm">
                                    <span className="text-5xl mb-4 block">🌡️</span>
                                    <h3 className="text-4xl font-black">{briefingData.quickRead.vitalsAlerts}</h3>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Alertas Viales Recientes</p>
                                </div>
                                <div className="bg-slate-800/80 border border-slate-700 rounded-[2rem] p-6 backdrop-blur-sm">
                                    <span className="text-5xl mb-4 block">🍽️</span>
                                    <h3 className="text-4xl font-black">{briefingData.quickRead.foodAlerts}</h3>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Inapetencias 8Hrs</p>
                                </div>
                                <div className="bg-slate-800/80 border border-slate-700 rounded-[2rem] p-6 backdrop-blur-sm">
                                    <span className="text-5xl mb-4 block">👩‍⚕️</span>
                                    <h3 className="text-4xl font-black">{briefingData.quickRead.appointments}</h3>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Citas Hoy</p>
                                </div>
                            </div>
                        )}

                        {/* Controls */}
                        <div className="flex gap-4 justify-center">
                            {!showQuickRead && (
                                <button onClick={skipBriefing} className="px-8 py-4 bg-slate-800 text-slate-300 font-bold rounded-full hover:bg-slate-700 transition">
                                    ⏭ Omitir Audio (Lectura Rápida)
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

    return (
        <div className="min-h-screen bg-slate-100 pb-20">
            <div className={`w-full ${hexColor} py-6 px-8 shadow-md flex justify-between items-center text-white sticky top-0 z-40`}>
                <h1 className="text-3xl font-black flex items-center gap-3">
                    📱 Zendity Care
                    <span className="text-base font-bold uppercase tracking-widest bg-white/20 px-4 py-1.5 rounded-full">Grupo {selectedColor}</span>
                </h1>
                <div className="flex gap-4">
                    <button onClick={() => router.push('/cuidadores')} className="px-6 py-3 font-bold bg-white/10 hover:bg-white/20 rounded-xl transition-colors">Mirar Life Plans (PAI)</button>
                    <button onClick={handleLogoutAttempt} className="px-6 py-3 font-black bg-white text-slate-900 rounded-xl shadow-lg hover:scale-105 transition-all">Finalizar Turno</button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8">
                {events.length > 0 && (
                    <div className="mb-8 flex flex-col gap-3">
                        {events.map((e: any) => {
                            const timeStr = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={e.id} className="bg-amber-100 border-l-8 border-amber-500 p-4 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white text-xl">⏳</div>
                                        <div>
                                            <p className="font-bold text-amber-900 leading-tight">Calendario: {e.title}</p>
                                            <p className="text-sm font-medium text-amber-700">
                                                Hoy a las {timeStr} {e.patient ? `• Residente: ${e.patient.name}` : '• Actividad Global'}
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
                    <div className="text-center p-20 text-xl font-bold text-slate-400 animate-pulse">Cargando Residentes...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {patients.map(p => {
                            const isAbsent = p.status === 'TEMPORARY_LEAVE';
                            return (
                                <div key={p.id} className={`bg-white rounded-[2.5rem] overflow-hidden shadow-xl border-t-8 border-t-${hexColor.split('-')[1]}-500 transform transition-all relative ${isAbsent ? 'opacity-70 saturate-50' : ''}`}>
                                    {isAbsent && (
                                        <div className="absolute inset-0 bg-slate-900/10 z-10 flex flex-col items-center justify-center backdrop-blur-[1px] gap-4">
                                            <div className="bg-amber-100 border border-amber-300 text-amber-800 px-6 py-2 rounded-full font-black flex items-center gap-2 shadow-2xl rotate-[-5deg] transform scale-105">
                                                <span className="text-2xl">🏥</span> Residente Fuera de Instalaciones ({p.leaveType === 'HOSPITAL' ? 'Hospital' : 'Familia'})
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
                                            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl font-bold">{p.name.charAt(0)}</div>
                                        </div>
                                        {p.lifePlan && <p className="mt-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg inline-block">PAI: {p.lifePlan.feeding}</p>}
                                    </div>

                                    <div className={`p-4 grid grid-cols-2 gap-3 bg-slate-50/50 ${isAbsent ? 'pointer-events-none' : ''}`}>
                                        <button onClick={() => { setActivePatient(p); setModalType('VITALS'); }} className="py-8 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-teal-500 hover:shadow-md transition-all">
                                            <span className="text-4xl pr-1">🩺</span><span className="text-xs font-black text-slate-500 uppercase">Vitales</span>
                                        </button>
                                        <button onClick={() => { setActivePatient(p); setModalType('LOG'); }} className="py-8 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-teal-500 hover:shadow-md transition-all">
                                            <span className="text-4xl pr-1">📝</span><span className="text-xs font-black text-slate-500 uppercase">Bitácora</span>
                                        </button>
                                        <button onClick={() => { setActivePatient(p); setModalType('MEDS'); }} className="py-8 bg-teal-50 border border-teal-100 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-teal-100 col-span-2">
                                            <span className="text-4xl pr-1">💊</span><span className="text-xs font-black text-teal-700 uppercase">Medicamentos</span>
                                        </button>
                                    </div>
                                    <div className={`p-4 grid grid-cols-2 gap-3 bg-white border-t border-slate-100 ${isAbsent ? 'pointer-events-none' : ''}`}>
                                        <button onClick={() => { setActivePatient(p); setModalType('FALL'); }} className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                                            <span className="text-xl">⚠️</span> Reportar Caída
                                        </button>
                                        <button onClick={() => { setActivePatient(p); setModalType('HOSPITAL_TRANSFER'); }} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors">
                                            <span className="text-xl">🚑</span> Traslado a Hospital
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* RESTO DE MODALES FASE 7 y 8... (Conservados por simplicidad) */}
            {modalType && (
                <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white rounded-[3rem] p-8 w-full max-w-lg shadow-2xl relative">
                        <button onClick={() => setModalType(null)} className="absolute top-6 right-6 w-12 h-12 bg-slate-100 text-slate-500 rounded-full font-bold">X</button>
                        <h3 className="text-3xl font-black text-slate-900 mb-6">{activePatient?.name}</h3>

                        {modalType === 'VITALS' && (
                            <div className="space-y-4">
                                <p className="font-bold text-slate-400 uppercase text-sm border-b pb-2">Vitales</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" placeholder="Sistólica (Ej 120)" value={vitals.sys} onChange={e => setVitals({ ...vitals, sys: e.target.value })} className="bg-slate-50 border p-3 rounded-xl font-bold" />
                                    <input type="number" placeholder="Diastólica (Ej 80)" value={vitals.dia} onChange={e => setVitals({ ...vitals, dia: e.target.value })} className="bg-slate-50 border p-3 rounded-xl font-bold" />
                                    <input type="number" placeholder="Temp °F (Ej 98.6)" value={vitals.temp} onChange={e => setVitals({ ...vitals, temp: e.target.value })} className="bg-slate-50 border p-3 rounded-xl font-bold" />
                                    <input type="number" placeholder="Pulso (HR)" value={vitals.hr} onChange={e => setVitals({ ...vitals, hr: e.target.value })} className="bg-slate-50 border p-3 rounded-xl font-bold" />
                                </div>
                                {aiSuggestion && (<div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-teal-800 text-sm font-bold shadow-inner">{aiSuggestion}</div>)}
                                <button onClick={submitVitals} disabled={submitting} className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl mt-4">Guardar y Analizar</button>
                            </div>
                        )}

                        {modalType === 'LOG' && (
                            <div className="space-y-6">
                                <p className="font-bold text-slate-400 uppercase text-sm border-b pb-2">Actividades Diarias y Comidas (ADL)</p>

                                {/* Baños */}
                                <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl">
                                    <h4 className="font-black text-sky-800 text-lg mb-2">🚿 Higiene Matutina</h4>
                                    <button onClick={handleBathLog} disabled={submitting || dailyLog.bathCompleted} className={`w-full py-4 rounded-xl font-bold transition-all ${dailyLog.bathCompleted ? 'bg-sky-200 text-sky-500 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30 active:scale-95'}`}>
                                        {dailyLog.bathCompleted ? "Baño Registrado ✓" : "Completar Baño de 6AM - 10AM"}
                                    </button>
                                    <p className="text-xs font-bold text-sky-600/60 mt-2 text-center">Protegido por 10-Min Cooldown</p>
                                </div>

                                {/* Comidas */}
                                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                                    <h4 className="font-black text-orange-800 text-lg mb-2">🍽️ Registro Nutricional</h4>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        <button onClick={() => setDailyLog({ ...dailyLog, selectedMeal: 'BREAKFAST' })} className={`py-2 text-sm font-bold rounded-lg border ${dailyLog.selectedMeal === 'BREAKFAST' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200'}`}>Desayuno</button>
                                        <button onClick={() => setDailyLog({ ...dailyLog, selectedMeal: 'LUNCH' })} className={`py-2 text-sm font-bold rounded-lg border ${dailyLog.selectedMeal === 'LUNCH' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200'}`}>Almuerzo</button>
                                        <button onClick={() => setDailyLog({ ...dailyLog, selectedMeal: 'DINNER' })} className={`py-2 text-sm font-bold rounded-lg border ${dailyLog.selectedMeal === 'DINNER' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200'}`}>Cena</button>
                                    </div>

                                    {dailyLog.selectedMeal && (
                                        <div className="grid grid-cols-4 gap-2 animate-in fade-in zoom-in-95">
                                            <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'ALL')} className="py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-lg text-xs">Todo</button>
                                            <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'HALF')} className="py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded-lg text-xs">Mitad</button>
                                            <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'LITTLE')} className="py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-lg text-xs">Poco</button>
                                            <button onClick={() => handleMealLog(dailyLog.selectedMeal || '', 'NONE')} className="py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg text-xs">Nada</button>
                                        </div>
                                    )}
                                </div>

                                {/* Bitacora General */}
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl relative">
                                    <textarea placeholder="Notas clínicas adicionales..." value={dailyLog.notes} onChange={e => setDailyLog({ ...dailyLog, notes: e.target.value })} className="w-full bg-white border border-slate-200 p-3 rounded-xl font-medium text-sm h-24 resize-none focus:border-indigo-400 outline-none" />
                                    <button type="button" onClick={formatDailyLogWithAI} disabled={formattingNotes || !dailyLog.notes} className="absolute bottom-5 right-5 text-2xl drop-shadow-md hover:scale-110 active:scale-95 transition-all text-indigo-500">✨</button>
                                </div>
                                <button onClick={submitLog} disabled={submitting} className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl shadow-lg">Guardar Notas Clínicas</button>
                            </div>
                        )}

                        {modalType === 'MEDS' && (
                            <div className="space-y-4">
                                <p className="font-bold text-slate-400 uppercase text-sm border-b pb-2">eMAR: Entrega de Fármacos</p>
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
                                        <p className="text-sm font-bold text-slate-400 text-center py-4">No hay medicamentos pautados pendientes.</p>
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

                                        <div className="grid grid-cols-2 gap-3">
                                            {(!activeMedAction || activeMedAction === 'ADMINISTER_ALL') && (
                                                <button onClick={() => submitBulkMeds('ADMINISTER_ALL')} disabled={submitting} className="col-span-2 py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white font-black text-xl rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
                                                    ✅ Registrar Administración
                                                </button>
                                            )}

                                            {(!activeMedAction || activeMedAction === 'PRN') && (
                                                <button onClick={() => activeMedAction === 'PRN' ? submitBulkMeds('PRN') : setActiveMedAction('PRN')} disabled={submitting} className={`${activeMedAction === 'PRN' ? 'col-span-2' : ''} py-4 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-white font-bold rounded-xl shadow-md flex justify-center items-center gap-2`}>
                                                    💊 {activeMedAction === 'PRN' ? 'Confirmar PRN' : 'Dar dosis PRN'}
                                                </button>
                                            )}

                                            {(!activeMedAction || activeMedAction === 'OMISSION') && (
                                                <button onClick={() => activeMedAction === 'OMISSION' ? submitBulkMeds('OMISSION') : setActiveMedAction('OMISSION')} disabled={submitting} className={`${activeMedAction === 'OMISSION' ? 'col-span-2' : ''} py-4 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white font-bold rounded-xl shadow-md flex justify-center items-center gap-2`}>
                                                    🛑 {activeMedAction === 'OMISSION' ? 'Confirmar Omisión' : 'Descontinuar'}
                                                </button>
                                            )}

                                            {activeMedAction && (
                                                <button onClick={() => { setActiveMedAction(null); setPrnNote(""); setOmissionNote(""); }} className="col-span-2 py-3 mt-2 text-slate-400 font-bold hover:text-slate-600 transition-colors">
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
                                <p className="font-black text-rose-600 uppercase text-lg border-b-2 border-rose-100 pb-2 flex items-center gap-2"><span>⚠️</span> Protocolo de Caída</p>
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
                                <p className="font-black text-red-600 uppercase text-lg border-b-2 border-red-100 pb-2 flex items-center gap-2"><span>🚑</span> Traslado a Hospital / ER</p>
                                <div className="bg-red-50 p-5 rounded-2xl border border-red-200 shadow-inner">
                                    <p className="text-red-900 font-bold mb-4 text-sm leading-relaxed">
                                        Al presionar este botón, se modificará el estatus clínico del residente y se generará instantáneamente una <strong>Nota de Progreso Clínica (Handover)</strong> en PDF lista para imprimir y entregar a los paramédicos de turno.
                                    </p>
                                    <label className="text-sm font-black text-red-800 uppercase block mb-2">Motivo del Traslado de Emergencia:</label>
                                    <textarea
                                        value={hospitalReason}
                                        onChange={e => setHospitalReason(e.target.value)}
                                        placeholder="Ej. Residente presenta fuerte dolor en el pecho y dificultad respiratoria (Desaturando a 85%). Activado protocolo emergencia."
                                        className="w-full bg-white border border-red-200 p-4 rounded-xl font-bold text-slate-800 text-sm h-32 resize-none focus:border-red-500 outline-none placeholder-slate-400"
                                    />
                                </div>
                                <button onClick={submitHospitalTransfer} disabled={submitting || !hospitalReason} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black text-lg rounded-2xl mt-4 shadow-lg shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-3">
                                    {submitting ? "Procesando..." : <><span>⚡️</span> Empezar Traslado e Imprimir Nota</>}
                                </button>
                            </div>
                        )}

                        {modalType === 'PROGRESS_NOTE_PDF' && pdfNoteData && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                                <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                                    <div className="p-5 bg-slate-800 text-white flex justify-between items-center">
                                        <h3 className="font-bold flex items-center gap-2 text-xl"><span>📄</span> Documento Handover (Vivid)</h3>
                                        <div className="flex gap-4">
                                            <button className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white font-black px-6 py-2 rounded-xl text-sm shadow-lg shadow-emerald-500/20" onClick={() => window.print()}>🖨️ Imprimir Progress Note</button>
                                            <button onClick={() => { setModalType(null); setPdfNoteData(null); }} className="text-slate-300 hover:text-white font-bold px-4">✕ Cerrar</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-12 bg-slate-100 flex justify-center">
                                        {/* Hoja Blanca Imprimible */}
                                        <div className="bg-white p-12 w-full shadow-sm border border-slate-200">
                                            <div className="flex justify-between items-start mb-8 border-b-4 border-slate-800 pb-6">
                                                <div>
                                                    <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Emergency Handover Form</h1>
                                                    <p className="text-slate-500 font-bold mt-1 text-lg">Zendity Care Platform • {pdfNoteData.headquarters?.name || "Vivid Senior Living Cupey"}</p>
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
                                                        <p><span className="font-bold text-slate-400 w-24 inline-block">Habitación:</span> {pdfNoteData.roomNumber || 'N/A'}</p>
                                                        <p><span className="font-bold text-slate-400 w-24 inline-block">Condición:</span> {pdfNoteData.lifePlan?.medicalCondition || 'No especificada en PAI'}</p>
                                                        <p><span className="font-bold text-slate-400 w-24 inline-block">Dieta / TR:</span> {pdfNoteData.diet || pdfNoteData.lifePlan?.feeding || 'Normal'}</p>
                                                        <p className="text-rose-600"><span className="font-bold text-rose-300 w-24 inline-block">Alergias:</span> {pdfNoteData.lifePlan?.allergies || 'NKA (No Known Allergies)'}</p>
                                                    </div>
                                                </div>
                                                <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-2xl">
                                                    <p className="text-sm font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2"><span>🚨</span> Motivo de Ingreso a Sala de Emergencias</p>
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
                                                                    <td className="py-3 px-4 text-slate-600 font-medium">{m.scheduleTime} • {m.medication?.route}</td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan={4} className="py-6 text-center text-slate-400 font-bold">Sin medicamentos registrados</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="mt-16 text-center text-sm text-slate-400 border-t-2 border-dashed border-slate-200 pt-8">
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
                                <p className="font-black text-slate-800 uppercase text-lg border-b-2 border-slate-100 pb-2 flex items-center gap-2"><span>⚡️</span> Operaciones Centrales</p>

                                {!hubAction ? (
                                    <div className="grid grid-cols-1 gap-4 mt-4">
                                        <button onClick={() => setHubAction("CLINICAL")} className="flex items-center gap-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 p-5 rounded-2xl transition-all">
                                            <span className="text-4xl">🏥</span>
                                            <div className="text-left">
                                                <p className="font-black text-purple-900 text-lg">Cambio Clínico u Observación</p>
                                                <p className="font-medium text-purple-700/70 text-sm">Comportamiento, Infección, Tristeza (Notifica a Enfermería)</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setHubAction("COMPLAINT")} className="flex items-center gap-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 p-5 rounded-2xl transition-all">
                                            <span className="text-4xl">👨‍👩‍👦</span>
                                            <div className="text-left">
                                                <p className="font-black text-orange-900 text-lg">Queja o Situación Familiar</p>
                                                <p className="font-medium text-orange-700/70 text-sm">Desacuerdos, reclamos o situaciones con visitas</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setHubAction("MAINTENANCE")} className="flex items-center gap-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-5 rounded-2xl transition-all">
                                            <span className="text-4xl">🔧</span>
                                            <div className="text-left">
                                                <p className="font-black text-slate-700 text-lg">Incidente de Operación / Mantenimiento</p>
                                                <p className="font-medium text-slate-500 text-sm">Focos rotos, derrames, objetos extraviados, limpieza</p>
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

                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                            <label className="text-sm font-bold text-slate-500 block mb-2">Descripción del Evento</label>
                                            <textarea
                                                className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-slate-800 text-sm h-32 resize-none focus:border-indigo-500 outline-none"
                                                placeholder="Describe detalladamente qué sucedió, quién estuvo involucrado y si requiere atención inmediata..."
                                                value={hubDescription}
                                                onChange={e => setHubDescription(e.target.value)}
                                            />
                                        </div>

                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                            <label className="text-sm font-bold text-slate-500 block mb-2">📸 Evidencia Fotográfica (Opcional)</label>
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
                                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">✓ Foto Adjunta</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                                        <span className="text-4xl">📷</span>
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
                    </div>
                </div>
            )}

            {/* FASE 32: Floating Action Hub Trigger */}
            {!briefingMode && activeSession && (
                <button
                    onClick={() => { setHubAction(null); setModalType('HUB'); }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 hover:bg-slate-800 text-white font-black px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-3 active:scale-95 transition-all z-40 border-4 border-slate-800 hover:border-slate-700 group hover:pr-6"
                >
                    <span className="text-3xl group-hover:rotate-12 transition-transform">⚡️</span>
                    <span className="text-xl tracking-tight">Acciones Rápidas</span>
                </button>
            )}

            {/* Zendi Contextual Toast Notification */}
            {zendiToast && (
                <div className="fixed bottom-8 right-8 bg-slate-800 text-teal-400 p-5 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom font-bold border border-teal-500/30 flex items-center gap-4 max-w-sm">
                    <span className="text-3xl animate-pulse">✨</span>
                    <span className="leading-tight">{zendiToast}</span>
                </div>
            )}
        </div>
    );
}
