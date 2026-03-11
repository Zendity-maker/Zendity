"use client";

import { useState, useEffect } from "react";
import { FaHeart, FaStar, FaTimes, FaCheck, FaImages } from "react-icons/fa";

export default function ZendiMomentsWidget() {
    const [moments, setMoments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchMoments();
    }, []);

    const fetchMoments = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/care/zendi/family-moments");
            const data = await res.json();
            if (data.success && data.moments) {
                setMoments(data.moments);
            }
        } catch (error) {
            console.error("Error fetching Zendi moments", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (momentId: string, action: 'ACCEPT' | 'DECLINE') => {
        if (action === 'ACCEPT' && selectedOption === null) {
            alert("Por favor selecciona una de las opciones de mensaje.");
            return;
        }

        setIsSubmitting(true);

        let textToSend = "";
        if (action === 'ACCEPT') {
            const moment = moments.find(m => m.id === momentId);
            textToSend = selectedOption === 1 ? moment.optionGen1 : moment.optionGen2;
        }

        try {
            const res = await fetch(`/api/care/zendi/family-moments/${momentId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    selectedText: textToSend,
                    photoUrl: "" // TODO: Add photo upload widget for Phase 48 V2
                })
            });
            const data = await res.json();

            if (data.success) {
                alert(data.message);
                // Remove processed moment from UI
                setMoments(prev => prev.filter(m => m.id !== momentId));
                setSelectedOption(null);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Error processing Zendi action", error);
            alert("Error de conexión interno.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return null;
    if (moments.length === 0) return null;

    const currentMoment = moments[0]; // Process one at a time

    return (
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg p-1 relative overflow-hidden mb-6 animate-in slide-in-from-bottom flex-shrink-0">
            {/* Sparkles Background effect */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <circle cx="20" cy="20" r="2" fill="white" />
                    <circle cx="80" cy="40" r="1.5" fill="white" />
                    <circle cx="40" cy="80" r="2.5" fill="white" />
                    <circle cx="90" cy="80" r="1" fill="white" />
                </svg>
            </div>

            <div className="bg-white rounded-xl p-5 sm:p-6 relative z-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-2xl mb-3 shadow-inner">
                    ✨
                </div>

                <h3 className="font-black text-slate-800 text-lg sm:text-xl">Misión Zendi: Actualización Familiar</h3>
                <p className="text-slate-600 text-sm mt-1 sm:px-6">
                    Misión: Haz que la familia de <strong className="text-indigo-600">{currentMoment.patient.name}</strong> (Res. {currentMoment.patient.roomNumber || 'N/A'}) sonría hoy.
                </p>

                <div className="w-full mt-5 space-y-3">
                    <button
                        onClick={() => setSelectedOption(1)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${selectedOption === 1 ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedOption === 1 ? 'border-purple-500 bg-purple-500' : 'border-slate-300'}`}>
                                {selectedOption === 1 && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                            <p className="text-sm font-medium text-slate-700 italic">"{currentMoment.optionGen1}"</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedOption(2)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${selectedOption === 2 ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedOption === 2 ? 'border-purple-500 bg-purple-500' : 'border-slate-300'}`}>
                                {selectedOption === 2 && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                            <p className="text-sm font-medium text-slate-700 italic">"{currentMoment.optionGen2}"</p>
                        </div>
                    </button>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-3 mt-6">
                    <button
                        onClick={() => handleAction(currentMoment.id, 'DECLINE')}
                        disabled={isSubmitting}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-rose-200"
                    >
                        <FaTimes />
                        <span>Declinar <span className="text-xs ml-1 bg-white px-1.5 py-0.5 rounded shadow-sm opacity-70">-3 Pts</span></span>
                    </button>

                    <button
                        onClick={() => handleAction(currentMoment.id, 'ACCEPT')}
                        disabled={isSubmitting || selectedOption === null}
                        className="flex-[2] py-3 px-4 rounded-xl font-black text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <FaStar className="text-yellow-300" />
                        <span>Cumplir Misión <span className="text-xs ml-1 bg-white/20 px-1.5 py-0.5 rounded font-bold">+3 Pts</span></span>
                    </button>
                </div>
            </div>
        </div>
    );
}
