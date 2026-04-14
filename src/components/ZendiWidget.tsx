"use client";

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function ZendiWidget() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [responseMsg, setResponseMsg] = useState("");

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Setup Web Speech API (SpeechRecognition)
        // Usamos (window as any) para evadir tipado estricto en SSR
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'es-PR'; // Español Puerto Rico / neutral
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                setTranscript(text);
                handleZendiQuery(text);
            };

            recognition.onerror = (event: any) => {
                console.error("Speech Recognition Error:", event.error);
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    setResponseMsg(" Necesito permiso de micrófono para escucharte.");
                } else if (event.error === 'network') {
                    setResponseMsg(" Error de red. Revisa tu conexión.");
                } else {
                    setResponseMsg(" No te escuché bien. ¿Puedes repetir?");
                }
                setIsListening(false);
            };

            recognition.onend = () => setIsListening(false);

            recognitionRef.current = recognition;
        }
    }, []);

    const toggleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setTranscript("");
            setResponseMsg("");
            recognitionRef.current?.start();
        }
    };

    const playZendiVoice = async (text: string) => {
        setIsSpeaking(true);
        try {
            const res = await fetch("/api/ai/zendi-voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });

            if (!res.ok) throw new Error("Fallo en la síntesis de Zendi");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);

            audio.onended = () => {
                setIsSpeaking(false);
                URL.revokeObjectURL(url); // Liberar memoria
            };

            audio.onerror = (e) => {
                console.error("Error reproduciendo Módulos Neurales de Zendi", e);
                setIsSpeaking(false);
                URL.revokeObjectURL(url);
            };

            await audio.play();
        } catch (error) {
            console.error("Zendi Voice Integration Error:", error);
            // Fallback de tiempo visual por si falla el API de voz
            const estimatedTime = (text.split(' ').length / 2.5) * 1000 + 1000;
            setTimeout(() => { setIsSpeaking(false); }, estimatedTime);
        }
    };

    const handleZendiQuery = async (queryText: string) => {
        setIsSpeaking(true); // Simulando pensar...
        setResponseMsg("Procesando en Zendity RAG...");
        try {
            const res = await fetch("/api/ai/zendi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transcript: queryText,
                    authorId: user?.id,
                    contextPath: pathname
                })
            });

            const data = await res.json();
            if (data.success) {
                setResponseMsg(data.response);
                playZendiVoice(data.response); // Call neural voice player
            } else {
                setResponseMsg(data.error || "Lo siento, falló la conexión con mi servidor.");
                setIsSpeaking(false);
            }
        } catch (error) {
            setResponseMsg("Lo siento, no tengo conexión con los servidores de la instalación.");
            setIsSpeaking(false);
        }
    };

    // Prevenir que Zendi renderize sobre pantallas de Login
    if (pathname === '/login' || pathname === '/unauthorized') return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 animate-in fade-in slide-in-from-bottom-8">

            {/* Panel de Chat Activo */}
            {isOpen && (
                <div className="w-80 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl mb-2 origin-bottom-right transition-transform">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : (isSpeaking ? 'bg-teal-400 animate-pulse' : 'bg-slate-600')}`}></div>
                            <h3 className="font-black text-white text-sm tracking-widest uppercase">ZENDI AI</h3>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-5 space-y-4 min-h-[150px] max-h-[300px] overflow-y-auto">
                        {!transcript && !responseMsg && (
                            <p className="text-sm text-slate-400 font-medium text-center italic mt-10">
                                "Hola, soy Zendi. Tu asistente clínico. ¿En qué protocolo de cuidado te apoyo hoy?"
                            </p>
                        )}

                        {transcript && (
                            <div className="bg-teal-900/40 border border-teal-800/50 p-3 rounded-2xl rounded-tr-sm ml-6 w-[80%] float-right">
                                <p className="text-xs text-teal-100 font-bold">{transcript}</p>
                            </div>
                        )}

                        {responseMsg && (
                            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-sm mr-6 w-[90%] float-left clear-both mt-4 border border-slate-700">
                                <p className="text-xs text-white leading-relaxed font-medium">{responseMsg}</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-black/40 flex justify-center border-t border-slate-800 relative">
                        <button
                            onClick={toggleListen}
                            disabled={isSpeaking}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${isListening
                                ? 'bg-rose-500 text-white scale-110 shadow-rose-500/40 animate-pulse ring-4 ring-rose-500/20'
                                : (isSpeaking ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50' : 'bg-teal-500 text-white hover:bg-teal-400 hover:scale-105')
                                }`}
                        >
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
                        </button>
                        {isSpeaking && <p className="absolute bottom-2 font-bold text-[9px] uppercase tracking-widest text-slate-500">PROCESANDO...</p>}
                    </div>
                </div>
            )}

            {/* Botón Flotante Global (Pill Trigger) */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group flex items-center gap-2.5 bg-teal-600 hover:bg-teal-500 rounded-full px-4 py-3 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-300"
                >
                    {isSpeaking && (
                        <span className="w-2 h-2 rounded-full bg-teal-300 animate-pulse shrink-0" />
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none" className="shrink-0">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="text-[13px] font-medium text-white tracking-[0.2px]">
                        Zendi
                    </span>
                </button>
            )}
        </div>
    );
}
