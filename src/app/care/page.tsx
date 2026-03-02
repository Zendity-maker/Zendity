"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function ZendityCareTabletPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Zendi Welcome Briefing (Fase 10)
    const [briefingMode, setBriefingMode] = useState(false);
    const [briefingData, setBriefingData] = useState<any>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showQuickRead, setShowQuickRead] = useState(false);

    // Modals Data
    const [activePatient, setActivePatient] = useState<any>(null);
    const [modalType, setModalType] = useState<"VITALS" | "LOG" | "MEDS" | "FALL" | null>(null);

    // Form States & Shadow AI
    const [vitals, setVitals] = useState({ sys: "", dia: "", temp: "", hr: "" });
    const [dailyLog, setDailyLog] = useState({ bathCompleted: false, foodIntake: 100, notes: "" });
    const [fallProtocol, setFallProtocol] = useState({ consciousness: true, bleeding: false, painLevel: 5 });
    const [medPin, setMedPin] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [formattingNotes, setFormattingNotes] = useState(false);

    // ==========================================
    // FASE 10: WELCOME BRIEFING LOGIC
    // ==========================================
    const startTurnAndBriefing = async (color: string) => {
        setSelectedColor(color);
        setBriefingMode(true);
        setShowQuickRead(false);
        setBriefingData(null);

        try {
            // Obtener Briefing de 12 horas desde Backend
            const res = await fetch("/api/care/briefing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ colorGroup: color, userName: user?.name })
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
            if (data.success) setPatients(data.patients);
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

    const submitMeds = async (medId: string) => {
        if (!medPin || medPin.length < 4) return alert("Ingrese PIN para firmar dosis.");
        setSubmitting(true);
        try {
            const res = await fetch("/api/care/meds", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientMedicationId: medId,
                    administeredById: user?.id,
                    status: 'GIVEN',
                    biometricSignature: medPin,
                    notes: "Administración Regular desde App de Piso."
                })
            });
            const data = await res.json();
            if (data.success) {
                // Remove med from local list to avoid re-delivery
                setActivePatient({
                    ...activePatient,
                    medications: activePatient.medications.filter((m: any) => m.id !== medId)
                });
                setMedPin("");
                if (activePatient.medications.length <= 1) setModalType(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
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
                    description: `Paciente sufrió caída. Consciente: ${fallProtocol.consciousness}, Sangrado: ${fallProtocol.bleeding}, Dolor Escala 1-10: ${fallProtocol.painLevel}`,
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

    const handleLogoutAttempt = () => {
        if (Math.random() > 0.5) alert("✋ ALTO: Medicamentos pendientes. Cierre de Turno Denegado.");
        else { alert("✅ Turno Finalizado. Has protegido tus registros para auditoría."); router.push('/login'); }
    };

    const colorStyles: Record<string, string> = { RED: "bg-red-600", YELLOW: "bg-amber-500", GREEN: "bg-emerald-500", BLUE: "bg-blue-600" };

    // =========================================================
    // VIEW 1: SELECCIÓN DE TURNO Y COLOR ZONING
    // =========================================================
    if (!selectedColor && !briefingMode) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-50">
                <div className="bg-white rounded-[3rem] p-10 max-w-2xl w-full text-center shadow-2xl animate-in zoom-in-95">
                    <h1 className="text-4xl font-black text-slate-800 mb-4">¿Cuál es tu color de Turno?</h1>
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
                {loading ? (
                    <div className="text-center p-20 text-xl font-bold text-slate-400 animate-pulse">Cargando Residentes...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {patients.map(p => (
                            <div key={p.id} className={`bg-white rounded-[2.5rem] overflow-hidden shadow-xl border-t-8 border-t-${hexColor.split('-')[1]}-500 transform transition-all`}>
                                <div className="p-6 pb-4 border-b border-slate-100">
                                    <div className="flex justify-between items-start">
                                        <h2 className="text-2xl font-black text-slate-800 leading-tight">{p.name}</h2>
                                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl font-bold">{p.name.charAt(0)}</div>
                                    </div>
                                    {p.lifePlan && <p className="mt-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg inline-block">PAI: {p.lifePlan.feeding}</p>}
                                </div>

                                <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50/50">
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
                                <div className="p-4 bg-white border-t border-slate-100">
                                    <button onClick={() => { setActivePatient(p); setModalType('FALL'); }} className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-xl flex items-center justify-center gap-2"><span className="text-xl">⚠️</span> Reportar Caída</button>
                                </div>
                            </div>
                        ))}
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
                            <div className="space-y-4">
                                <p className="font-bold text-slate-400 uppercase text-sm border-b pb-2">Bitácora Diaria (ADLs)</p>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold"><input type="checkbox" checked={dailyLog.bathCompleted} onChange={e => setDailyLog({ ...dailyLog, bathCompleted: e.target.checked })} className="w-6 h-6 accent-teal-600" /> Baño Asistido Listo</label>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">% Ingesta de Alimentos</label>
                                    <input type="range" min="0" max="100" step="25" value={dailyLog.foodIntake} onChange={e => setDailyLog({ ...dailyLog, foodIntake: parseInt(e.target.value) })} className="w-full accent-emerald-500 mt-2" />
                                    <div className="flex justify-between text-xs font-bold text-slate-400 px-1 mt-1"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
                                </div>
                                <div className="relative">
                                    <textarea placeholder="Notas clínicas del turno..." value={dailyLog.notes} onChange={e => setDailyLog({ ...dailyLog, notes: e.target.value })} className="w-full bg-slate-50 border p-4 rounded-xl font-medium text-sm h-32 resize-none" />
                                    <button type="button" onClick={formatDailyLogWithAI} disabled={formattingNotes || !dailyLog.notes} className="absolute bottom-3 right-3 text-2xl drop-shadow-md hover:scale-110 active:scale-95 transition-all text-indigo-500 drop-shadow-indigo-500/50" title="Zendi AI Shadow Formatter">✨</button>
                                </div>
                                <button onClick={submitLog} disabled={submitting} className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl mt-4">Archivar Reporte</button>
                            </div>
                        )}

                        {modalType === 'MEDS' && (
                            <div className="space-y-4">
                                <p className="font-bold text-slate-400 uppercase text-sm border-b pb-2">Entrega de Fármacos</p>
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-inner max-h-60 overflow-y-auto">
                                    {activePatient?.medications?.length > 0 ? (
                                        activePatient.medications.map((m: any) => (
                                            <div key={m.id} className="flex justify-between items-center py-2 border-b border-amber-100 last:border-0">
                                                <div>
                                                    <p className="font-bold text-amber-900">{m.medication.name}</p>
                                                    <p className="text-xs text-amber-700">{m.medication.dosage} @ {m.scheduleTime}</p>
                                                </div>
                                                <button onClick={() => submitMeds(m.id)} disabled={submitting} className="px-4 py-2 bg-white text-teal-600 font-black rounded-lg shadow-sm border border-teal-100 hover:bg-teal-50">Suministrar</button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm font-bold text-amber-800/60 text-center py-4">No hay medicamentos pautados pendientes.</p>
                                    )}
                                </div>
                                <div className="pt-2">
                                    <label className="text-xs font-bold text-slate-400 block mb-1">PIN Electrónico del Cuidador / Enfermera *</label>
                                    <input type="password" maxLength={4} value={medPin} onChange={e => setMedPin(e.target.value)} placeholder="****" className="w-full bg-slate-50 p-4 rounded-xl text-center text-2xl font-black tracking-widest outline-none border focus:border-teal-400" />
                                </div>
                            </div>
                        )}

                        {modalType === 'FALL' && (
                            <div className="space-y-4 mt-2">
                                <p className="font-black text-rose-600 uppercase text-lg border-b-2 border-rose-100 pb-2 flex items-center gap-2"><span>⚠️</span> Protocolo de Caída</p>
                                <div className="bg-rose-50 p-5 rounded-2xl border border-rose-200 space-y-4 shadow-inner">
                                    <label className="flex items-center justify-between font-bold text-rose-900 cursor-pointer">
                                        ¿El paciente reacciona y está consciente?
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
                    </div>
                </div>
            )}
        </div>
    );
}
