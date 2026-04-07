"use client";

import { useState, useRef } from "react";
import { Loader2, Sparkles, Volume2, VolumeX } from "lucide-react";

interface ZendiAssistProps {
    value: string;
    onChange: (newValue: string) => void;
    context?: string;
    type?: "FORMAT_NOTES" | "SUPERVISOR_MEMO" | "FAMILY_MESSAGE" | "KITCHEN_OBS" | "CORPORATE_COMMS_POLISH";
    placeholder?: string;
    rows?: number;
    className?: string;
    label?: string;
}

export default function ZendiAssist({
    value,
    onChange,
    context = "nota clínica operativa",
    type = "FORMAT_NOTES",
    placeholder = "Escribe aquí...",
    rows = 4,
    className = "",
    label,
}: ZendiAssistProps) {
    const [improving, setImproving] = useState(false);
    const [improved, setImproved] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const speakText = async () => {
        if (!value?.trim()) return;

        if (isSpeaking) {
            audioRef.current?.pause();
            audioRef.current = null;
            setIsSpeaking(false);
            return;
        }

        try {
            setIsSpeaking(true);
            const res = await fetch('/api/zendi/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: value })
            });
            if (!res.ok) throw new Error('TTS failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; };
            audio.onerror = () => { setIsSpeaking(false); audioRef.current = null; };
            await audio.play();
        } catch {
            setIsSpeaking(false);
        }
    };

    const handleImprove = async () => {
        if (!value.trim() || improving) return;
        setImproving(true);
        setImproved(false);
        try {
            const res = await fetch("/api/ai/shadow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, rawText: value, context }),
            });
            const data = await res.json();
            if (data.success && data.formattedText) {
                onChange(data.formattedText);
                setImproved(true);
                setTimeout(() => setImproved(false), 3000);
            }
        } catch (e) {
            console.error("ZendiAssist error:", e);
        } finally {
            setImproving(false);
        }
    };

    return (
        <div className="relative w-full">
            {label && (
                <label className="block text-sm font-bold text-slate-700 mb-1">{label}</label>
            )}
            <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className={`w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-400 outline-none resize-none pr-14 transition-colors ${improved ? 'border-teal-300 bg-teal-50/30' : ''} ${className}`}
            />
            {value?.trim() && (
                <button
                    type="button"
                    onClick={speakText}
                    className={`absolute bottom-3 right-14 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isSpeaking
                            ? 'bg-teal-500 text-white animate-pulse'
                            : 'bg-slate-100 hover:bg-teal-50 text-slate-400 hover:text-teal-600'
                    }`}
                    title={isSpeaking ? 'Detener' : 'Escuchar con Zendi'}
                >
                    {isSpeaking
                        ? <VolumeX size={14} />
                        : <Volume2 size={14} />
                    }
                </button>
            )}
            <button
                type="button"
                onClick={handleImprove}
                disabled={!value.trim() || improving}
                title="Zendi — Mejorar redacción"
                className={`absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm border
                    ${improved
                        ? 'bg-teal-500 border-teal-500 text-white scale-110'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:shadow-md'
                    }
                    disabled:opacity-30 disabled:cursor-not-allowed active:scale-95`}
            >
                {improving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />
                }
            </button>
            {improved && (
                <p className="text-xs text-teal-600 font-medium mt-1.5 flex items-center gap-1 ml-1">
                    <Sparkles className="w-3 h-3" /> Zendi mejoró la redacción
                </p>
            )}
        </div>
    );
}
