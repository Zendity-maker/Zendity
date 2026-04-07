"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FaMicrophone, FaCheck, FaTimes, FaRedo } from "react-icons/fa";

// ─── Tipos ──────────────────────────────────────────────────────────────────
type KioskStep = "welcome" | "asking-resident" | "asking-name" | "signing" | "done";

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
}

declare global {
    interface Window {
        SpeechRecognition: new () => ISpeechRecognition;
        webkitSpeechRecognition: new () => ISpeechRecognition;
    }
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function ReceptionKiosk() {
    const [step, setStep] = useState<KioskStep>("welcome");
    const [residentName, setResidentName] = useState("");
    const [visitorName, setVisitorName] = useState("");
    const [visitorRelation, setVisitorRelation] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [visitId, setVisitId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Canvas firma
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const [hasSigned, setHasSigned] = useState(false);

    // ── Voz TTS ──────────────────────────────────────────────────────────────
    const speak = useCallback((text: string) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "es-PR";
        utt.rate = 0.95;
        window.speechSynthesis.speak(utt);
    }, []);

    // ── STT ──────────────────────────────────────────────────────────────────
    const startListening = useCallback((onResult: (text: string) => void) => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            alert("Tu navegador no soporta reconocimiento de voz. Por favor escribe manualmente.");
            return;
        }
        const rec: ISpeechRecognition = new SpeechRec();
        rec.lang = "es-PR";
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (e: SpeechRecognitionEvent) => {
            const text = e.results[0][0].transcript;
            setTranscript(text);
            onResult(text);
        };
        rec.onerror = () => {
            setIsListening(false);
        };
        rec.start();
    }, []);

    // ── Flujo de pasos ───────────────────────────────────────────────────────
    useEffect(() => {
        if (step === "welcome") {
            setTimeout(() => speak("¡Bienvenido a Zéndity! Para registrar su visita, toque la pantalla o presione el micrófono."), 600);
        } else if (step === "asking-resident") {
            speak("¿A cuál residente viene a visitar hoy? Diga el nombre completo.");
        } else if (step === "asking-name") {
            speak("Perfecto. Ahora, ¿cuál es su nombre completo?");
        } else if (step === "signing") {
            speak("Excelente. Por favor firme en la pantalla para completar su registro.");
        } else if (step === "done") {
            speak("¡Listo! Su visita ha sido registrada. Bienvenido. El personal le atenderá en breve.");
            setTimeout(() => {
                setStep("welcome");
                setResidentName("");
                setVisitorName("");
                setVisitorRelation("");
                setTranscript("");
                setHasSigned(false);
                setVisitId(null);
                setErrorMsg(null);
                clearCanvas();
            }, 8000);
        }
    }, [step, speak]);

    // ── Canvas Firma ─────────────────────────────────────────────────────────
    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        if ("touches" in e) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
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
    const saveVisit = async () => {
        if (!hasSigned) {
            speak("Por favor firme en la pantalla antes de continuar.");
            return;
        }
        setIsSaving(true);
        setErrorMsg(null);
        try {
            const signatureData = canvasRef.current?.toDataURL("image/png") || null;
            const res = await fetch("/api/reception/visit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ residentName, visitorName, visitorRelation, signatureData })
            });
            const data = await res.json();
            if (data.success) {
                setVisitId(data.visitId);
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
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 select-none">

            {/* Header */}
            <div className="w-full max-w-2xl mb-8">
                <div className="text-center">
                    <h1 className="text-white font-black text-3xl mb-1">Vivid Senior Living Cupey</h1>
                    <p className="text-teal-400 text-sm font-medium tracking-widest">Recepción — Powered by ZÉNDITY</p>
                </div>
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
                    <p className="text-slate-400 text-lg text-center max-w-sm">
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
                    <p className="text-slate-400 text-center text-sm">Escriba o diga el nombre del residente.</p>

                    <div className="w-full relative">
                        <input
                            type="text"
                            value={residentName}
                            onChange={(e) => setResidentName(e.target.value)}
                            placeholder="Nombre del residente..."
                            className="w-full bg-slate-800 border border-slate-600 text-white text-xl rounded-2xl px-6 py-5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 placeholder:text-slate-600 font-medium"
                        />
                        {transcript && step === "asking-resident" && (
                            <p className="text-teal-400 text-sm mt-2 text-center">Escuché: "{transcript}"</p>
                        )}
                    </div>

                    <MicButton
                        isListening={isListening}
                        onPress={() => startListening((text) => setResidentName(text))}
                    />

                    <div className="flex gap-4 w-full mt-2">
                        <button onClick={() => setStep("welcome")} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <FaTimes /> Cancelar
                        </button>
                        <button
                            onClick={() => { if (residentName.trim()) { setTranscript(""); setStep("asking-name"); } }}
                            disabled={!residentName.trim()}
                            className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            Continuar <FaCheck />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP: ASKING NAME ── */}
            {step === "asking-name" && (
                <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    <StepIndicator current={2} total={3} />
                    <h2 className="text-white text-2xl font-bold text-center">¿Cuál es su nombre?</h2>
                    <p className="text-slate-400 text-center text-sm">
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
                            <p className="text-teal-400 text-sm text-center">Escuché: "{transcript}"</p>
                        )}
                    </div>

                    <MicButton
                        isListening={isListening}
                        onPress={() => startListening((text) => setVisitorName(text))}
                    />

                    <div className="flex gap-4 w-full mt-2">
                        <button onClick={() => setStep("asking-resident")} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <FaTimes /> Atrás
                        </button>
                        <button
                            onClick={() => { if (visitorName.trim()) { setTranscript(""); setStep("signing"); } }}
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
                        <p className="text-slate-400 text-sm">Visitante: <span className="text-white font-semibold">{visitorName}</span></p>
                        <p className="text-slate-400 text-sm">Residente: <span className="text-teal-400 font-semibold">{residentName}</span></p>
                    </div>

                    {/* Canvas */}
                    <div className="w-full bg-white rounded-2xl overflow-hidden border-4 border-slate-700 relative">
                        <canvas
                            ref={canvasRef}
                            width={480}
                            height={180}
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
                                <span className="text-slate-300 text-base font-medium opacity-70">Firme aquí ✍️</span>
                            </div>
                        )}
                    </div>

                    <button onClick={clearCanvas} className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1.5 transition-colors">
                        <FaRedo className="text-xs" /> Borrar firma
                    </button>

                    {errorMsg && (
                        <p className="text-rose-400 text-sm text-center">{errorMsg}</p>
                    )}

                    <div className="flex gap-4 w-full">
                        <button onClick={() => setStep("asking-name")} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-4 rounded-xl transition-colors">
                            Atrás
                        </button>
                        <button
                            onClick={saveVisit}
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
                        <p className="text-slate-300 text-lg">Bienvenido, <span className="text-white font-bold">{visitorName}</span></p>
                        <p className="text-slate-400">Visita a <span className="text-teal-400 font-semibold">{residentName}</span> confirmada.</p>
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
            <FaMicrophone className={`text-xl ${isListening ? "text-white" : "text-slate-400"}`} />
        </button>
    );
}
