"use client";

import { useState, useEffect } from "react";
import { FaTimes, FaCheck, FaHeartbeat } from "react-icons/fa";

export default function ZendiNursingWidget() {
    const [update, setUpdate] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState<1 | 2 | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchUpdate();
    }, []);

    const fetchUpdate = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/care/zendi/nursing-updates");
            const data = await res.json();
            if (data.success && data.update) {
                setUpdate(data.update);
            } else {
                setUpdate(null);
            }
        } catch (e) {
            console.error("[ZendiNursingWidget] fetch error:", e);
            setUpdate(null);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'ACCEPT' | 'DECLINE') => {
        if (!update) return;
        if (action === 'ACCEPT' && selectedOption === null) {
            alert("Por favor selecciona una de las opciones de mensaje.");
            return;
        }

        setIsSubmitting(true);
        const selectedText = action === 'ACCEPT'
            ? (selectedOption === 1 ? update.optionGen1 : update.optionGen2)
            : undefined;

        try {
            const res = await fetch(`/api/care/zendi/nursing-updates/${update.id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, selectedOption: selectedText })
            });
            const data = await res.json();

            if (data.success) {
                alert(data.message);
                setUpdate(null);
                setSelectedOption(null);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error("[ZendiNursingWidget] action error:", e);
            alert("Error de conexión interno.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // No renderizar mientras carga o si no hay update
    if (loading || !update) return null;

    return (
        <div className="bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 rounded-2xl shadow-lg p-1 relative overflow-hidden mb-6 animate-in slide-in-from-bottom flex-shrink-0">
            {/* Fondo decorativo */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <circle cx="15" cy="15" r="2" fill="white" />
                    <circle cx="85" cy="30" r="1.5" fill="white" />
                    <circle cx="50" cy="85" r="2.5" fill="white" />
                    <circle cx="75" cy="75" r="1" fill="white" />
                    <circle cx="25" cy="60" r="1.8" fill="white" />
                </svg>
            </div>

            <div className="bg-white rounded-xl p-5 sm:p-6 relative z-10 flex flex-col items-center text-center">
                {/* Icono */}
                <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center text-2xl mb-3 shadow-inner border border-teal-100">
                    <FaHeartbeat />
                </div>

                {/* Título */}
                <h3 className="font-black text-slate-800 text-lg sm:text-xl">
                    📋 Update de Enfermería para Familia
                </h3>
                <p className="text-slate-500 text-sm mt-1 sm:px-4 leading-relaxed">
                    Envía un update clínico positivo a la familia de{' '}
                    <strong className="text-teal-600">{update.patient.name}</strong>
                    {update.patient.roomNumber ? ` — Hab. ${update.patient.roomNumber}` : ''}.
                </p>

                {/* Opciones */}
                <div className="w-full mt-5 space-y-3">
                    {/* Opción 1 */}
                    <button
                        onClick={() => setSelectedOption(1)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                            selectedOption === 1
                                ? 'border-teal-500 bg-teal-50 shadow-sm'
                                : 'border-slate-100 hover:border-teal-200 hover:bg-slate-50'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selectedOption === 1 ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                            }`}>
                                {selectedOption === 1 && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <p className="text-sm font-medium text-slate-700 italic text-left leading-relaxed">
                                "{update.optionGen1}"
                            </p>
                        </div>
                    </button>

                    {/* Opción 2 */}
                    <button
                        onClick={() => setSelectedOption(2)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                            selectedOption === 2
                                ? 'border-teal-500 bg-teal-50 shadow-sm'
                                : 'border-slate-100 hover:border-teal-200 hover:bg-slate-50'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selectedOption === 2 ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                            }`}>
                                {selectedOption === 2 && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <p className="text-sm font-medium text-slate-700 italic text-left leading-relaxed">
                                "{update.optionGen2}"
                            </p>
                        </div>
                    </button>
                </div>

                {/* Botones de acción */}
                <div className="w-full flex flex-col sm:flex-row gap-3 mt-6">
                    <button
                        onClick={() => handleAction('DECLINE')}
                        disabled={isSubmitting}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-rose-200 disabled:opacity-50"
                    >
                        <FaTimes />
                        <span>
                            Declinar
                            <span className="text-xs ml-1 bg-white px-1.5 py-0.5 rounded shadow-sm opacity-70">-1 Pto</span>
                        </span>
                    </button>

                    <button
                        onClick={() => handleAction('ACCEPT')}
                        disabled={isSubmitting || selectedOption === null}
                        className="flex-[2] py-3 px-4 rounded-xl font-black text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <FaCheck />
                        <span>
                            Enviar a Familia
                            <span className="text-xs ml-1 bg-white/20 px-1.5 py-0.5 rounded font-bold">+3 Pts</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
