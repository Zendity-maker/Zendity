"use client";

import React, { useState } from "react";
import { Activity, Award, AlertTriangle, BookOpen, CheckCircle, ShieldAlert, Edit2 } from "lucide-react";
import type { AcademyAssignmentStatus } from "@/actions/performance/performance.actions";

export interface PerformanceUI {
    id: string;
    userId: string;
    userName: string;
    systemScore: number;
    humanScore: number | null;
    finalScore: number;
    systemFindings: Record<string, number>;
}

export interface AcademyCapsuleUI {
    id: string;
    userId: string;
    moduleCode: string;
    moduleTitle: string;
    reason: string;
    status: AcademyAssignmentStatus;
}

interface PerformanceAcademyProps {
    role: "CAREGIVER" | "SUPERVISOR" | "HQ_OWNER";
    performances: PerformanceUI[]; 
    activeCapsules: AcademyCapsuleUI[];
    onTakeModule?: (capsuleId: string) => void;
    onApplyOverride?: (scoreId: string, newScore: number) => void;
}

export default function PerformanceAcademyDashboard({ role, performances, activeCapsules, onTakeModule, onApplyOverride }: PerformanceAcademyProps) {
    const [overrideModal, setOverrideModal] = useState<{ id: string; name: string } | null>(null);
    const [overrideValue, setOverrideValue] = useState("");

    // Vista Caregiver (Solo ve su propio desempeño en Array Index 0)
    if (role === "CAREGIVER") {
        const myScore = performances[0];
        const myCapsule = activeCapsules.find(c => c.status === "PENDING" || c.status === "IN_PROGRESS");

        return (
            <div className="w-full max-w-4xl mx-auto space-y-6">
                
                {/* Score Card */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-2">
                            <Activity className="text-blue-500" /> Mi Salud Operativa Quincenal
                        </h2>
                        <p className="text-slate-500 font-medium">Este puntaje refleja tu puntualidad en eMAR y la limpieza de tus Cierres de Turno.</p>
                        
                        <div className="mt-6 flex flex-wrap gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col min-w-[140px]">
                                <span className="text-slate-400 font-bold text-sm uppercase">Score Base</span>
                                <span className="font-black text-2xl text-slate-700">{myScore?.systemScore || 100}</span>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col min-w-[140px]">
                                <span className="text-blue-500 font-bold text-sm uppercase">Score Final</span>
                                <span className="font-black text-3xl text-blue-700">{myScore?.finalScore || 100}</span>
                            </div>
                        </div>
                    </div>
                    {myScore?.humanScore && (
                        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-200 text-sm font-bold flex flex-col gap-1 items-center text-center max-w-[200px]">
                            <Award size={24} className="text-emerald-500"/>
                            El supervisor aplicó un ajuste positivo valorando tu calidez humana.
                        </div>
                    )}
                </div>

                {/* Academy Restrictiva */}
                {myCapsule ? (
                    <div className="bg-amber-50 rounded-3xl p-8 border-2 border-amber-200 shadow-sm">
                        <div className="flex items-center gap-3 text-amber-700 mb-4">
                            <BookOpen size={28} />
                            <h3 className="text-xl font-black uppercase tracking-tight">Capacitación Requerida</h3>
                        </div>
                        <p className="text-amber-900 font-medium text-lg leading-snug mb-2">
                            Hemos detectado oportunidades de mejora técnica: <strong>{myCapsule.reason}</strong>
                        </p>
                        <p className="text-amber-700 mb-6 font-medium">Por favor, completa esta cápsula formativa de 3 minutos para desbloquear tu score.</p>
                        
                        <div className="bg-white p-5 rounded-2xl border border-amber-100 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800 text-lg">{myCapsule.moduleTitle}</p>
                                <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-700 rounded-full mt-2 inline-block">PENDIENTE</span>
                            </div>
                            <button 
                                onClick={() => onTakeModule?.(myCapsule.id)}
                                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black rounded-xl transition-all"
                            >
                                Tomar Módulo
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-8 text-center text-slate-400 font-bold">
                        <CheckCircle size={32} className="mx-auto mb-3 opacity-50" />
                        No tienes obligaciones de reentrenamiento. ¡Sigue así!
                    </div>
                )}
            </div>
        );
    }

    // Vista SUPERVISOR / CLINICAL_DIRECTOR
    return (
        <div className="w-full max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-3xl font-black text-slate-800">Monitoreo y Corrección de Piso</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {performances.map(perf => {
                    // Buscar si tiene bloqueo pedagógico
                    const pendingCapsule = activeCapsules.find(c => c.userId === perf.userId && c.status === "PENDING");

                    return (
                        <div key={perf.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                            {/* Warning Banner */}
                            {pendingCapsule && (
                                <div className="absolute top-0 left-0 right-0 bg-red-50 text-red-700 text-xs font-bold px-4 py-2 flex items-center gap-2">
                                    <ShieldAlert size={14}/> REQUIERE REENTRENAMIENTO URGENTE
                                </div>
                            )}

                            <div className={`flex justify-between items-center ${pendingCapsule ? 'mt-6' : ''}`}>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{perf.userName}</h3>
                                    <span className="text-sm font-medium text-slate-500">ID: {perf.userId.slice(0,8)}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`text-3xl font-black ${perf.finalScore < 85 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {perf.finalScore}
                                    </span>
                                </div>
                            </div>

                            {/* Breakdown */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm font-medium text-slate-600 flex justify-between">
                                <span>Algoritmo (eMAR): {perf.systemScore}</span>
                                <span>Overrides (Humano): {perf.humanScore || 'N/A'}</span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100">
                                <button 
                                    onClick={() => setOverrideModal({ id: perf.id, name: perf.userName })}
                                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-xl text-sm transition-colors"
                                >
                                    <Edit2 size={16}/> Override Humano
                                </button>
                                {pendingCapsule && (
                                    <button className="flex-1 bg-red-50 text-red-700 font-bold py-2 rounded-xl text-sm opacity-50 cursor-not-allowed">
                                        Módulo Pendiente
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {overrideModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200">
                        <h3 className="text-xl font-black text-slate-800 mb-1">Override Humano</h3>
                        <p className="text-slate-500 text-sm font-medium mb-6">Ajuste para <strong>{overrideModal.name}</strong>. Valor entre 1 y 100.</p>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            value={overrideValue}
                            onChange={e => setOverrideValue(e.target.value)}
                            placeholder="Ej: 87"
                            className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-4 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-slate-400 outline-none mb-6"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setOverrideModal(null); setOverrideValue(""); }}
                                className="flex-1 py-4 rounded-[2rem] bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const val = Number(overrideValue);
                                    if (val >= 1 && val <= 100 && onApplyOverride) {
                                        onApplyOverride(overrideModal.id, val);
                                        setOverrideModal(null);
                                        setOverrideValue("");
                                    }
                                }}
                                disabled={!overrideValue || Number(overrideValue) < 1 || Number(overrideValue) > 100}
                                className="flex-1 py-4 rounded-[2rem] bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-40"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
