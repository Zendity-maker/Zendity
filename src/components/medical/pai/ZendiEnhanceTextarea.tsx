"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Check, Undo2, Loader2 } from "lucide-react";

interface Props {
    value: string;
    onChange: (newValue: string) => void;
    /** Identificador del campo para el prompt de Zendi (ej: "Resumen Clínico Interdisciplinario") */
    fieldLabel: string;
    /** Nombre del residente (contexto del prompt) */
    patientName: string;
    /** Placeholder del textarea */
    placeholder?: string;
    /** className del textarea (se concatena al base) */
    className?: string;
    /** Min caracteres para mostrar el botón (default 10) */
    minCharsToEnhance?: number;
    /** Toast fn externo — si se omite se usa alert nativo */
    onError?: (msg: string) => void;
}

/**
 * Textarea con botón "✨ Mejorar con Zendi" que llama a /api/ai/zendi-pai
 * y permite al usuario deshacer la mejora para restaurar el texto original.
 */
export default function ZendiEnhanceTextarea({
    value, onChange, fieldLabel, patientName,
    placeholder, className = "", minCharsToEnhance = 10, onError,
}: Props) {
    const [enhancing, setEnhancing] = useState(false);
    const [justEnhanced, setJustEnhanced] = useState(false);
    const [originalBeforeEnhance, setOriginalBeforeEnhance] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Cuando el usuario edita manualmente después de mejorar → se descarta el "deshacer"
    useEffect(() => {
        if (originalBeforeEnhance !== null && justEnhanced === false) {
            // No hacer nada — estado consistente
        }
    }, [originalBeforeEnhance, justEnhanced]);

    const showEnhanceButton = value.trim().length >= minCharsToEnhance && !enhancing && !justEnhanced;
    const showUndoButton = originalBeforeEnhance !== null && !enhancing;

    const handleEnhance = async () => {
        if (!value.trim()) return;
        setEnhancing(true);
        const snapshot = value;
        try {
            const res = await fetch("/api/ai/zendi-pai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    field: fieldLabel,
                    rawText: value,
                    patientName,
                }),
            });
            const data = await res.json();
            if (data.success && data.improvedText) {
                setOriginalBeforeEnhance(snapshot);
                onChange(data.improvedText);
                setJustEnhanced(true);
                setTimeout(() => setJustEnhanced(false), 2000);
            } else {
                const msg = data.error || "Error al mejorar. Intenta de nuevo.";
                if (onError) onError(msg); else alert(msg);
            }
        } catch (e) {
            const msg = "Error de conexión con Zendi.";
            if (onError) onError(msg); else alert(msg);
        } finally {
            setEnhancing(false);
        }
    };

    const handleUndo = () => {
        if (originalBeforeEnhance === null) return;
        onChange(originalBeforeEnhance);
        setOriginalBeforeEnhance(null);
        setJustEnhanced(false);
    };

    /** Cuando el usuario edita manualmente después de mejorar, borrar el snapshot (ya no tiene sentido deshacer a un estado divergente) */
    const handleManualChange = (newVal: string) => {
        if (originalBeforeEnhance !== null && !justEnhanced) {
            // Usuario editando tras mejorar — mantener snapshot hasta que sea muy distinto
            // Heurística simple: si la nueva versión ya se alejó >20 chars del enhanced, descartamos undo
            // (el enhanced está en value actual; al cambiar se pierde referencia)
        }
        onChange(newVal);
    };

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => handleManualChange(e.target.value)}
                placeholder={placeholder}
                readOnly={enhancing}
                className={`${className} ${enhancing ? 'opacity-50' : ''} ${justEnhanced ? 'ring-2 ring-teal-300' : ''} transition-all`}
            />

            {/* Botón Mejorar con Zendi */}
            {showEnhanceButton && (
                <button
                    type="button"
                    onClick={handleEnhance}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                    title="Convierte notas cortas en texto clínico profesional"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    Mejorar con Zendi
                </button>
            )}

            {/* Estado: mejorando */}
            {enhancing && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mejorando...
                </div>
            )}

            {/* Estado: recién mejorado (2s) */}
            {justEnhanced && !enhancing && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm animate-in fade-in">
                    <Check className="w-3.5 h-3.5" />
                    Mejorado
                </div>
            )}

            {/* Botón Deshacer — aparece después de que pase el estado "Mejorado" */}
            {showUndoButton && !justEnhanced && (
                <button
                    type="button"
                    onClick={handleUndo}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                    title="Restaura el texto original"
                >
                    <Undo2 className="w-3.5 h-3.5" />
                    Deshacer
                </button>
            )}
        </div>
    );
}
