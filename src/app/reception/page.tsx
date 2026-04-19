"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { FaMicrophone, FaCheck, FaTimes, FaRedo } from "react-icons/fa";

const INACTIVITY_MS = 60_000; // 60s para reset automático

// ─── Tipos ──────────────────────────────────────────────────────────────────
type KioskStep = 'welcome' | 'asking-resident' | 'confirming-resident' | 'asking-name' | 'signing' | 'done';

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface ISpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: (() => void) | null;
    start: () => void;
    stop: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => ISpeechRecognition;
        webkitSpeechRecognition: new () => ISpeechRecognition;
    }
}

interface VisitData {
    residentName: string;
    visitorName: string;
    visitorRelation: string;
    patientId: string | null;
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function ReceptionKiosk() {
    const searchParams = useSearchParams();
    const hqId = searchParams?.get('hqId') || null;

    const [step, setStep] = useState<KioskStep>("welcome");

    // Display states (usados en JSX para mostrar nombres)
    const [residentName, setResidentName] = useState("");
    const [visitorName, setVisitorName] = useState("");
    const [visitorRelation, setVisitorRelation] = useState("");

    // Input en asking-resident (antes de confirmar)
    const [inputText, setInputText] = useState("");

    // Datos confirmados para el API (incluye patientId)
    const [visitData, setVisitData] = useState<VisitData>({
        residentName: "", visitorName: "", visitorRelation: "", patientId: null
    });

    // Candidatos al buscar residente
    const [residentCandidates, setResidentCandidates] = useState<any[]>([]);

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [visitId, setVisitId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Canvas firma
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasWrapRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const [hasSigned, setHasSigned] = useState(false);
    const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 480, height: 180 });

    // Inactividad — resetea a welcome tras INACTIVITY_MS sin actividad
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Referencia al reconocedor activo (para poder detenerlo)
    const recognitionRef = useRef<ISpeechRecognition | null>(null);

    // Referencia al audio activo de ElevenLabs (para cancelar duplicación)
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Ref para evitar duplicación de anuncio en asking-name
    const nameStepAnnouncedRef = useRef(false);

    // ── Voz TTS — ElevenLabs con fallback Web Speech ─────────────────────────
    const speak = useCallback((text: string, onEnd?: () => void) => {
        // Cancelar audio anterior si existe
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();

        const playWithElevenLabs = async () => {
            try {
                setIsSpeaking(true);
                const res = await fetch('/api/zendi/speak', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });

                if (!res.ok) throw new Error('ElevenLabs failed');

                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audioRef.current = audio;

                audio.onended = () => {
                    audioRef.current = null;
                    setIsSpeaking(false);
                    URL.revokeObjectURL(url);
                    if (onEnd) onEnd();
                };

                audio.onerror = () => {
                    audioRef.current = null;
                    setIsSpeaking(false);
                    URL.revokeObjectURL(url);
                    if (onEnd) onEnd();
                };

                await audio.play();

            } catch (e) {
                console.warn('[Zendi] ElevenLabs falló, usando Web Speech API:', e);
                // Fallback a Web Speech API
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-US';
                utterance.rate = 0.88;
                utterance.pitch = 1.08;
                const voices = window.speechSynthesis.getVoices();
                const preferred = voices.find(v => v.lang.startsWith('es') && !v.localService)
                    || voices.find(v => v.lang.startsWith('es'));
                if (preferred) utterance.voice = preferred;
                utterance.onstart = () => setIsSpeaking(true);
                utterance.onend = () => { setIsSpeaking(false); if (onEnd) onEnd(); };
                window.speechSynthesis.speak(utterance);
            }
        };

        playWithElevenLabs();
    }, []);

    // ── STT ──────────────────────────────────────────────────────────────────
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { }
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const startListening = useCallback((onResult?: (text: string) => void) => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            alert("Tu navegador no soporta reconocimiento de voz. Por favor escribe manualmente.");
            return;
        }
        const rec: ISpeechRecognition = new SpeechRec();
        rec.lang = "es-PR";
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        recognitionRef.current = rec;

        rec.onstart = () => setIsListening(true);
        rec.onend = () => { setIsListening(false); recognitionRef.current = null; };
        rec.onresult = (e: SpeechRecognitionEvent) => {
            const text = e.results[0][0].transcript;
            setTranscript(text);
            if (onResult) onResult(text);
        };
        rec.onerror = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };
        rec.start();
    }, []);

    // ── Búsqueda y confirmación de residente ─────────────────────────────────
    const handleResidentConfirm = async () => {
        const name = inputText.trim() || transcript.trim();
        if (!name) return;
        stopListening();

        try {
            const hqParam = hqId ? `&hqId=${encodeURIComponent(hqId)}` : '';
            const res = await fetch(`/api/reception/search-resident?q=${encodeURIComponent(name)}${hqParam}`);
            const data = await res.json();

            if (data.patients?.length === 1) {
                const patient = data.patients[0];
                setResidentName(patient.name);
                nameStepAnnouncedRef.current = true;
                setVisitData(prev => ({ ...prev, residentName: patient.name, patientId: patient.id }));
                setTranscript('');
                setInputText('');
                setStep('asking-name');
                speak(`¿Viene a visitar a ${patient.name}? Perfecto. ¿Me puede dar su nombre completo?`, () => {
                    setTimeout(() => startListening(), 500);
                });
            } else if (data.patients?.length > 1) {
                setResidentCandidates(data.patients);
                setStep('confirming-resident');
                const names = data.patients.slice(0, 3).map((p: any) => p.name).join(', ');
                speak(`Encontré varios residentes. ¿Viene a visitar a ${names}? Por favor seleccione en la pantalla.`);
            } else {
                setResidentName(name);
                nameStepAnnouncedRef.current = true;
                setVisitData(prev => ({ ...prev, residentName: name, patientId: null }));
                setTranscript('');
                setInputText('');
                setStep('asking-name');
                speak(`De acuerdo. ¿Me puede dar su nombre completo?`, () => {
                    setTimeout(() => startListening(), 500);
                });
            }
        } catch {
            setResidentName(name);
            nameStepAnnouncedRef.current = true;
            setVisitData(prev => ({ ...prev, residentName: name, patientId: null }));
            setStep('asking-name');
            speak(`¿Me puede dar su nombre completo?`, () => {
                setTimeout(() => startListening(), 500);
            });
        }
    };

    const handleResidentSelect = (patient: any) => {
        setResidentName(patient.name);
        nameStepAnnouncedRef.current = true;
        setVisitData(prev => ({ ...prev, residentName: patient.name, patientId: patient.id }));
        setResidentCandidates([]);
        setTranscript('');
        setInputText('');
        setStep('asking-name');
        speak(`Perfecto. Visita para ${patient.name}. ¿Me puede dar su nombre completo?`, () => {
            setTimeout(() => startListening(), 500);
        });
    };

    // ── Bienvenida al montar — solo una vez ─────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            speak('Bienvenido a Vivid Senior Living Coo-peh-y. Soy Zendi, su asistente de recepción.');
        }, 800);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Sin dependencias — solo al montar

    // ── Flujo de pasos — nunca incluir 'welcome' ────────────────────────────
    useEffect(() => {
        if (step === 'asking-resident') {
            speak('¿A quién viene a visitar hoy?', () => {
                setTimeout(() => startListening(), 500);
            });
        } else if (step === 'asking-name') {
            if (nameStepAnnouncedRef.current) {
                // Ya fue anunciado por handleResidentConfirm — solo resetear el ref
                nameStepAnnouncedRef.current = false;
            } else {
                // Llegó aquí por otra vía — hablar normalmente
                speak('¿Me puede dar su nombre completo?', () => {
                    setTimeout(() => startListening(), 500);
                });
            }
        } else if (step === 'signing') {
            speak(`Gracias ${visitData.visitorName}. Por favor firme su visita en la pantalla mientras le notifico al personal.`);
        } else if (step === 'done') {
            speak(`Visita registrada. ¡Que disfrute su visita con ${visitData.residentName}!`);
            const timer = setTimeout(() => {
                setStep('welcome');
                setResidentName('');
                setVisitorName('');
                setVisitorRelation('');
                setInputText('');
                setTranscript('');
                setHasSigned(false);
                setVisitId(null);
                setErrorMsg(null);
                setResidentCandidates([]);
                setVisitData({ residentName: '', visitorName: '', visitorRelation: '', patientId: null });
                clearCanvas();
            }, 8000);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]); // Solo reacciona a cambios de step, nunca a 'welcome'

    // ── FIX 4: Timeout de inactividad ────────────────────────────────────────
    // Cualquier actividad (click/touch/key/change) reinicia el timer.
    // Si no hay actividad en 60s y el step es intermedio, reset a 'welcome'.
    const handleInactivityReset = useCallback(() => {
        stopListening();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();

        setStep('welcome');
        setResidentName('');
        setVisitorName('');
        setVisitorRelation('');
        setInputText('');
        setTranscript('');
        setHasSigned(false);
        setVisitId(null);
        setErrorMsg(null);
        setResidentCandidates([]);
        setVisitData({ residentName: '', visitorName: '', visitorRelation: '', patientId: null });
        nameStepAnnouncedRef.current = false;
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }

        speak('Sesión expirada por inactividad.');
    }, [speak, stopListening]);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
        // Solo armar el timer en pasos intermedios
        if (step === 'welcome' || step === 'done') return;
        inactivityTimerRef.current = setTimeout(handleInactivityReset, INACTIVITY_MS);
    }, [step, handleInactivityReset]);

    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
        };
    }, [step, resetInactivityTimer]);

    // ── FIX 5: Canvas firma responsive ───────────────────────────────────────
    useEffect(() => {
        const measure = () => {
            const wrap = canvasWrapRef.current;
            if (!wrap) return;
            const parentWidth = wrap.clientWidth;
            const width = Math.max(240, Math.min(parentWidth - 32, 600));
            const height = Math.round(width * 0.35);
            setCanvasSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
        };
        // Medir al montar y en cada resize (si el canvas ya está montado)
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, [step]); // remeasure cuando entramos/salimos del paso signing

    // Al cambiar de tamaño el canvas, se resetea el buffer → limpiar estado
    useEffect(() => {
        setHasSigned(false);
    }, [canvasSize.width, canvasSize.height]);

    // ── Canvas Firma ─────────────────────────────────────────────────────────
    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        if ("touches" in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return;
        e.preventDefault();
        isDrawingRef.current = true;
        lastPosRef.current = getPos(e, canvasRef.current);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const pos = getPos(e, canvasRef.current);
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        lastPosRef.current = pos;
        setHasSigned(true);
    };

    const stopDraw = () => { isDrawingRef.current = false; };

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasSigned(false);
    };

    // ── Guardar visita ────────────────────────────────────────────────────────
    const handleSignatureSubmit = async () => {
        if (!hasSigned) {
            speak("Por favor firme en la pantalla antes de continuar.");
            return;
        }
        setIsSaving(true);
        setErrorMsg(null);
        try {
            const signature = canvasRef.current?.toDataURL("image/png") || null;
            const timestamp = new Date().toISOString();
            const res = await fetch("/api/reception/visit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    residentName: visitData.residentName || residentName,
                    visitorName: visitData.visitorName || visitorName,
                    visitorRelation: visitData.visitorRelation || visitorRelation,
                    patientId: visitData.patientId || null,
                    signatureData: signature,
                    timestamp
                })
            });
            const data = await res.json();
            if (data.success) {
                setVisitId(data.visit?.id || null);
                setStep("done");
            } else {
                setErrorMsg(data.error || "Error al registrar la visita.");
                speak("Hubo un problema al registrar. Por favor avise al personal.");
            }
        } catch {
            setErrorMsg("Error de conexión.");
        } finally {
            setIsSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 select-none"
            onClick={resetInactivityTimer}
            onTouchStart={resetInactivityTimer}
            onKeyDown={resetInactivityTimer}
            onChange={resetInactivityTimer}
        >

            {/* Header */}
            <div className="w-full max-w-2xl mb-6 text-center">
                <h1 className="text-white font-black text-3xl tracking-wide mb-1">
                    Vivid Senior Living Cupey
                </h1>
                <p className="text-teal-400 text-sm font-medium tracking-widest uppercase">
                    Recepción · Powered by Zéndity
                </p>
            </div>

            {/* ── STEP: WELCOME ── */}
            {step === "welcome" && (
                <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-32 h-32 rounded-full bg-teal-900/40 border-2 border-teal-500/50 flex items-center justify-center">
                        <span className="text-6xl">👋</span>
                    </div>
                    <h1 className="text-white text-3xl font-bold text-center leading-snug">
                        ¡Bienvenido!
                    </h1>
                    <p className="text-slate-500 text-lg text-center max-w-sm">
                        Regístrese para visitar a un residente de nuestra comunidad.
                    </p>
                    <button
                        onClick={() => setStep("asking-resident")}
                        className="mt-4 bg-teal-600 hover:bg-teal-500 text-white font-black text-xl px-12 py-5 rounded-2xl shadow-[0_4px_24px_0_rgba(13,148,136,0.5)] hover:shadow-[0_6px_32px_rgba(13,148,136,0.4)] hover:-translate-y-1 transition-all duration-200"
                    >
                        Iniciar Registro
                    </button>
                </div>
            )}

            {/* ── STEP: ASKING RESIDENT ── */}
            {step === "asking-resident" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <StepIndicator current={1} total={3} />
                    <h2 className="text-white text-2xl font-bold text-center">¿A quién viene a visitar?</h2>
                    <p className="text-slate-500 text-center text-sm">Escriba o diga el nombre del residente.</p>

                    <div className="w-full relative">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Nombre del residente..."
                            className="w-full bg-slate-800 border border-slate-600 text-white text-xl rounded-2xl px-6 py-5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 placeholder:text-slate-600 font-medium"
                        />
                        {transcript && step === "asking-resident" && (
                            <p className="text-teal-400 text-sm mt-2 text-center">Escuché: &quot;{transcript}&quot;</p>
                        )}
                    </div>

                    <MicButton
                        isListening={isListening}
                        onPress={() => startListening((text) => setInputText(text))}
                    />

                    <div className="flex gap-4 w-full mt-2">
                        <button onClick={() => setStep("welcome")} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-500 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <FaTimes /> Cancelar
                        </button>
                        <button
                            onClick={handleResidentConfirm}
                            disabled={!inputText.trim() && !transcript.trim()}
                            className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            Buscar <FaCheck />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: CONFIRMING RESIDENT ── */}
            {step === 'confirming-resident' && (
                <div className="w-full max-w-2xl">
                    <div className="bg-slate-800 rounded-2xl p-6 mb-6 border border-teal-500">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-sm font-bold">Z</span>
                            </div>
                            <div>
                                <p className="text-teal-400 text-xs font-bold mb-1">ZENDI</p>
                                <p className="text-white text-xl font-medium">¿A cuál de estos residentes viene a visitar?</p>
                                <p className="text-slate-500 text-sm mt-1">Which resident are you visiting?</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {residentCandidates.map((patient: any) => (
                            <button
                                key={patient.id}
                                onClick={() => handleResidentSelect(patient)}
                                className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-teal-500 rounded-2xl px-6 py-4 transition-all text-left"
                            >
                                <div>
                                    <p className="text-white font-bold text-lg">{patient.name}</p>
                                    {patient.room && <p className="text-slate-500 text-sm">Cuarto {patient.room}</p>}
                                </div>
                                <span className="text-teal-400 text-2xl">→</span>
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                setResidentCandidates([]);
                                setStep('asking-resident');
                                setInputText('');
                                setTranscript('');
                                speak('Por favor intente de nuevo con el nombre completo del residente.');
                            }}
                            className="w-full py-3 text-slate-500 hover:text-slate-500 text-sm transition-colors"
                        >
                            Ninguno — intentar de nuevo
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: ASKING NAME ── */}
            {step === "asking-name" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <StepIndicator current={2} total={3} />
                    <h2 className="text-white text-2xl font-bold text-center">¿Cuál es su nombre?</h2>
                    <p className="text-slate-500 text-center text-sm">
                        Visitando a: <span className="text-teal-400 font-bold">{residentName}</span>
                    </p>

                    <div className="w-full space-y-3">
                        <div className="relative">
                            <input
                                type="text"
                                value={visitorName}
                                onChange={(e) => setVisitorName(e.target.value)}
                                placeholder="Su nombre completo..."
                                className="w-full bg-slate-800 border border-slate-600 text-white text-xl rounded-2xl px-6 py-5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 placeholder:text-slate-600 font-medium"
                            />
                        </div>
                        <input
                            type="text"
                            value={visitorRelation}
                            onChange={(e) => setVisitorRelation(e.target.value)}
                            placeholder="Relación (ej. Hijo/a, Cónyuge, Amigo/a)..."
                            className="w-full bg-slate-800 border border-slate-600 text-white text-base rounded-2xl px-6 py-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 placeholder:text-slate-600"
                        />
                        {transcript && step === "asking-name" && (
                            <p className="text-teal-400 text-sm text-center">Escuché: &quot;{transcript}&quot;</p>
                        )}
                    </div>

                    <MicButton
                        isListening={isListening}
                        onPress={() => startListening((text) => setVisitorName(text))}
                    />

                    <div className="flex gap-4 w-full mt-2">
                        <button onClick={() => setStep("asking-resident")} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-500 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <FaTimes /> Atrás
                        </button>
                        <button
                            onClick={() => {
                                if (visitorName.trim()) {
                                    setVisitData(prev => ({ ...prev, visitorName, visitorRelation }));
                                    setTranscript("");
                                    setStep("signing");
                                }
                            }}
                            disabled={!visitorName.trim()}
                            className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            Continuar <FaCheck />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: SIGNING ── */}
            {step === "signing" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <StepIndicator current={3} total={3} />
                    <h2 className="text-white text-2xl font-bold text-center">Firme para confirmar</h2>
                    <div className="text-center space-y-0.5">
                        <p className="text-slate-500 text-sm">Visitante: <span className="text-white font-semibold">{visitorName}</span></p>
                        <p className="text-slate-500 text-sm">Residente: <span className="text-teal-400 font-semibold">{residentName}</span></p>
                    </div>

                    {/* Canvas */}
                    <div ref={canvasWrapRef} className="w-full bg-white rounded-2xl overflow-hidden border-4 border-slate-700 relative">
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            className="w-full touch-none cursor-crosshair"
                            onMouseDown={startDraw}
                            onMouseMove={draw}
                            onMouseUp={stopDraw}
                            onMouseLeave={stopDraw}
                            onTouchStart={startDraw}
                            onTouchMove={draw}
                            onTouchEnd={stopDraw}
                        />
                        {!hasSigned && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-slate-500 text-base font-medium opacity-70">Firme aquí ✍️</span>
                            </div>
                        )}
                    </div>

                    <button onClick={clearCanvas} className="text-slate-500 hover:text-slate-500 text-sm flex items-center gap-1.5 transition-colors">
                        <FaRedo className="text-xs" /> Borrar firma
                    </button>

                    {errorMsg && (
                        <p className="text-rose-400 text-sm text-center">{errorMsg}</p>
                    )}

                    <div className="flex gap-4 w-full">
                        <button onClick={() => setStep("asking-name")} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-500 font-bold py-4 rounded-xl transition-colors">
                            Atrás
                        </button>
                        <button
                            onClick={handleSignatureSubmit}
                            disabled={!hasSigned || isSaving}
                            className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</span>
                            ) : (
                                <><FaCheck /> Confirmar Visita</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: DONE ── */}
            {step === "done" && (
                <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500 text-center">
                    <div className="w-28 h-28 rounded-full bg-teal-900/50 border-2 border-teal-500 flex items-center justify-center">
                        <FaCheck className="text-teal-400 text-4xl" />
                    </div>
                    <h2 className="text-white text-3xl font-black">¡Visita Registrada!</h2>
                    <div className="space-y-1">
                        <p className="text-slate-500 text-lg">Bienvenido, <span className="text-white font-bold">{visitorName}</span></p>
                        <p className="text-slate-500">Visita a <span className="text-teal-400 font-semibold">{residentName}</span> confirmada.</p>
                        {visitId && <p className="text-slate-600 text-xs mt-2">ID: {visitId}</p>}
                    </div>
                    <p className="text-slate-500 text-sm mt-4">Esta pantalla se reiniciará en unos segundos...</p>
                </div>
            )}

            {/* Footer */}
            <div className="mt-16 text-slate-700 text-xs tracking-widest uppercase">
                Zéndity Healthcare Management Platform
            </div>
        </div>
    );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${
                        i + 1 === current ? "w-8 bg-teal-500" :
                        i + 1 < current ? "w-2 bg-teal-700" :
                        "w-2 bg-slate-700"
                    }`}
                />
            ))}
            <span className="text-slate-500 text-xs ml-1">{current} de {total}</span>
        </div>
    );
}

function MicButton({ isListening, onPress }: { isListening: boolean; onPress: () => void }) {
    return (
        <button
            onClick={onPress}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${
                isListening
                    ? "bg-rose-600 border-rose-400 scale-110 shadow-[0_0_24px_rgba(239,68,68,0.6)] animate-pulse"
                    : "bg-slate-800 border-slate-600 hover:border-teal-500 hover:bg-slate-700"
            }`}
        >
            <FaMicrophone className={`text-xl ${isListening ? "text-white" : "text-slate-500"}`} />
        </button>
    );
}
