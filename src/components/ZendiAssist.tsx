"use client";

/**
 * ZENDI PROPONE. LA PERSONA DECIDE.
 * ─────────────────────────────────
 * Este botón REESCRIBÍA el texto en el sitio: `onChange(data.formattedText)`, y
 * lo que había escrito la persona desaparecía. Nadie podía saber después qué
 * escribió la cuidadora y qué escribió el modelo, y varios de estos cuadros son
 * notas clínicas que quedan firmadas con el nombre de quien las escribió.
 *
 * Va contra la regla que ya rige el resto del sistema —"la IA pasa de escribir
 * a leer"—: Zendi propone, una persona confirma. Los borradores de enfermería
 * funcionan así y son la única superficie de Zendi que se usa de verdad.
 *
 * POR QUÉ ESTO Y NO GUARDAR LAS DOS VERSIONES. Guardar original y reescrito
 * habría pedido una columna nueva en cada modelo donde cae este texto —notas de
 * turno, observaciones de cocina, memos, mensajes a familias— y aun así el
 * expediente seguiría enseñando prosa de una máquina firmada por una persona.
 * El problema no era la falta de registro: era que se sustituía sin que nadie
 * leyera. Si la persona LEE la propuesta y decide quedársela, es suya — eso es
 * autoría. Y si no la lee, ahora tiene que dar un paso más para aceptarla.
 *
 * El original no se pierde nunca: se queda en el cuadro hasta que alguien
 * pulsa "usar esta versión", y hay "volver a lo mío" después de aceptar.
 */

import { useState, useRef } from "react";
import { Loader2, Sparkles, Volume2, VolumeX, Undo2 } from "lucide-react";

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
    /** La propuesta de Zendi. No toca el cuadro hasta que alguien la acepta. */
    const [propuesta, setPropuesta] = useState<string | null>(null);
    /** Lo que había escrito la persona antes de aceptar, para poder volver. */
    const [original, setOriginal] = useState<string | null>(null);
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
        setPropuesta(null);
        try {
            const res = await fetch("/api/ai/shadow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, rawText: value, context }),
            });
            const data = await res.json();
            if (data.success && data.formattedText) {
                const sugerido = String(data.formattedText).trim();
                // Si no cambia nada, no se enseña un panel para nada.
                if (sugerido && sugerido !== value.trim()) setPropuesta(sugerido);
            }
        } catch (e) {
            console.error("ZendiAssist error:", e);
        } finally {
            setImproving(false);
        }
    };

    const aceptarPropuesta = () => {
        if (!propuesta) return;
        setOriginal(value);
        onChange(propuesta);
        setPropuesta(null);
    };

    const volverALoMio = () => {
        if (original === null) return;
        onChange(original);
        setOriginal(null);
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
                className={`w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-400 outline-none resize-none pr-14 transition-colors ${original !== null ? 'border-teal-300 bg-teal-50/30' : ''} ${className}`}
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
                title="Zendi — proponer otra redacción"
                className={`absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm border
                    ${propuesta
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
            {/* LA PROPUESTA, AL LADO. No sustituye nada hasta que alguien la
                lee y decide quedársela. */}
            {propuesta && (
                <div className="mt-2 rounded-2xl border-2 border-teal-200 bg-teal-50/60 p-3">
                    <p className="text-[10px] font-black text-teal-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Zendi propone
                    </p>
                    <p className="text-sm text-slate-800 leading-snug whitespace-pre-line">{propuesta}</p>
                    <div className="flex gap-2 mt-3">
                        <button
                            type="button"
                            onClick={aceptarPropuesta}
                            className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-lg transition-colors"
                        >
                            Usar esta versión
                        </button>
                        <button
                            type="button"
                            onClick={() => setPropuesta(null)}
                            className="px-4 py-2 bg-white border-2 border-slate-200 hover:border-slate-400 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                        >
                            Dejar lo mío
                        </button>
                    </div>
                    <p className="text-[10px] text-teal-800/70 mt-2 leading-snug">
                        Léela antes de aceptarla. Lo que se guarde va firmado con tu nombre.
                    </p>
                </div>
            )}

            {original !== null && (
                <button
                    type="button"
                    onClick={volverALoMio}
                    className="mt-1.5 ml-1 text-xs text-teal-700 font-bold flex items-center gap-1 hover:underline"
                >
                    <Undo2 className="w-3 h-3" /> Volver a lo que yo había escrito
                </button>
            )}
        </div>
    );
}
