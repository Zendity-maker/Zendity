"use client";

import React, { useState } from "react";
import { AlertCircle, FileText, CheckCircle, ChevronDown, Activity, User, ShieldAlert, X } from "lucide-react";

interface Novelty {
    patientName: string;
    description: string;
    level: "CRITICAL" | "PENDING" | "INFO";
}

interface IncomingShiftBriefingProps {
    isOpen: boolean;
    userName: string;
    shiftName: string;
    novelties: Novelty[];
    onAccept: () => void;
    onBypass: () => void;
}

export default function IncomingShiftBriefing({ isOpen, userName, shiftName, novelties, onAccept, onBypass }: IncomingShiftBriefingProps) {
    const [accepted, setAccepted] = useState(false);
    const [showFullHistory, setShowFullHistory] = useState(false);

    if (!isOpen) return null;

    const criticalItems = novelties.filter(n => n.level === "CRITICAL");
    const pendingItems = novelties.filter(n => n.level === "PENDING");
    
    // Si no hay novedades rojas ni amarillas, consideramos el piso estable
    const isStable = criticalItems.length === 0 && pendingItems.length === 0;

    const criticalCount = criticalItems.length;
    const pendingCount = pendingItems.length;
    const totalIssues = criticalCount + pendingCount;

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
            <div className="w-full max-w-4xl flex flex-col items-center animate-in zoom-in-95 duration-300">
                {/* Header Welcome */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-5 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-600/30 mb-6">
                        <User size={40} />
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tight mb-2">¡Hola, {userName}!</h1>
                    <p className="text-2xl text-blue-200 font-medium">Iniciando Turno: <strong className="text-white">{shiftName}</strong></p>
                </div>

                {/* Zendi Main Card */}
                <div className="bg-white rounded-[2.5rem] w-full shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                    
                    {/* Header Strip */}
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">🤖</span>
                            <div>
                                <h2 className="text-3xl font-black tracking-tight">Síntesis de Novedades (Zendi)</h2>
                                <p className="text-slate-400 font-medium text-lg mt-1">Léeme antes de pisar pabellón.</p>
                            </div>
                        </div>
                        {/* Risk Indicator Slider Mock */}
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Termómetro Clínico</span>
                            <div className="h-3 w-40 bg-slate-800 rounded-full overflow-hidden flex">
                                {isStable && <div className="h-full bg-emerald-500 w-full"></div>}
                                {!isStable && (
                                    <>
                                        <div className="h-full bg-red-500" style={{width: `${(criticalCount/(totalIssues||1))*100}%`}}></div>
                                        <div className="h-full bg-amber-400" style={{width: `${(pendingCount/(totalIssues||1))*100}%`}}></div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-10 space-y-8 bg-slate-50 flex-grow overflow-y-auto max-h-[60vh]">
                        {/* CRITICAL (ROJO) */}
                        {criticalItems.length > 0 && (
                            <div className="bg-white border-2 border-red-200 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
                                <div className="flex items-center gap-3 text-red-700 font-black mb-6 uppercase tracking-wider text-xl">
                                    <ShieldAlert size={28} />
                                    <span>Novedades Críticas</span>
                                </div>
                                <ul className="space-y-5">
                                    {criticalItems.map((item, idx) => (
                                        <li key={idx} className="flex gap-5 items-start bg-red-50/50 p-5 rounded-2xl border border-red-100">
                                            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 font-bold flex-shrink-0 text-xl shadow-sm">!</div>
                                            <div>
                                                <strong className="text-slate-900 block text-2xl font-black mb-1">{item.patientName}</strong>
                                                <p className="text-slate-600 font-medium text-lg leading-relaxed">{item.description}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* PENDING (AMARILLO) */}
                        {pendingItems.length > 0 && (
                            <div className="bg-white border-2 border-amber-200 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
                                <div className="flex items-center gap-3 text-amber-900 font-black mb-6 uppercase tracking-wider text-xl">
                                    <AlertCircle size={28} className="text-amber-500" />
                                    <span>Pendientes Relevantes</span>
                                </div>
                                <ul className="space-y-5">
                                    {pendingItems.map((item, idx) => (
                                        <li key={idx} className="flex gap-5 items-start bg-amber-50/50 p-5 rounded-2xl border border-amber-100">
                                            <div className="w-3 h-3 mt-2 rounded-full bg-amber-400 flex-shrink-0"></div>
                                            <div>
                                                <strong className="text-slate-900 block text-2xl font-black mb-1">{item.patientName}</strong>
                                                <p className="text-slate-600 font-medium text-lg leading-relaxed">{item.description}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* ESTABLE (VERDE) */}
                        {isStable && (
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center shadow-lg">
                                <div className="bg-white p-6 rounded-full shadow-md mb-6 animate-bounce border border-emerald-100">
                                    <CheckCircle size={64} className="text-emerald-500" />
                                </div>
                                <h3 className="text-4xl font-black text-emerald-900 tracking-tight mb-4">Piso Estable</h3>
                                <p className="text-emerald-700 text-xl font-medium max-w-md">El turno saliente cerró impecable. Sin deudas clínicas ni incidencias rojas.</p>
                            </div>
                        )}

                        {/* METRICAS SECUNDARIAS */}
                        <div className="pt-4">
                            <button 
                                onClick={() => setShowFullHistory(!showFullHistory)}
                                className="flex items-center justify-between w-full p-6 bg-white border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-2xl text-slate-700 font-bold text-xl transition-all shadow-sm group active:scale-95"
                            >
                                <div className="flex items-center gap-4">
                                    <Activity size={24} className="text-blue-500" />
                                    <span>{showFullHistory ? "Ocultar Telemetría del Turno Previsto" : "Ver Telemetría Logística (Censo/Rondas)"}</span>
                                </div>
                                <ChevronDown size={28} className={`transition-transform text-slate-400 group-hover:text-blue-500 ${showFullHistory ? "rotate-180" : ""}`} />
                            </button>
                            
                            {showFullHistory && (
                                <div className="mt-4 p-8 bg-white rounded-2xl border-2 border-blue-100 text-lg text-slate-600 shadow-inner grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-sm font-black uppercase tracking-widest text-slate-400">Población Activa</span>
                                        <span className="text-3xl font-black text-slate-800">24 <span className="text-lg font-medium text-slate-500">presentes</span></span>
                                    </div>
                                    <div className="flex flex-col gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                                        <span className="text-sm font-black uppercase tracking-widest text-slate-400">eMAR Dispense</span>
                                        <span className="text-3xl font-black text-emerald-600">42 <span className="text-lg font-medium text-emerald-700/70">dosis dadas</span></span>
                                    </div>
                                    <div className="flex flex-col gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                                        <span className="text-sm font-black uppercase tracking-widest text-slate-400">Excepciones</span>
                                        <span className="text-3xl font-black text-amber-600">0 <span className="text-lg font-medium text-amber-700/70">rechazos</span></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CTAs */}
                    <div className="p-10 pt-6 bg-white border-t border-slate-100">
                        {/* THE SWITCHER / TOGGLE */}
                        <label className="flex items-center gap-6 p-6 bg-slate-50 border-2 border-slate-200 rounded-3xl cursor-pointer hover:bg-slate-100 transition-colors mb-8 shadow-sm group">
                            <div className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={accepted}
                                    onChange={(e) => setAccepted(e.target.checked)}
                                />
                                <div className="w-20 h-10 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[2.4rem] peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:bg-blue-600 shadow-inner group-hover:after:scale-[0.9]"></div>
                            </div>
                            <span className="font-black text-slate-800 text-xl md:text-2xl leading-tight select-none">
                                Confirmo lectura de Novedades y ASUMO RESPONSABILIDAD del piso.
                            </span>
                        </label>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={onAccept}
                                disabled={!accepted}
                                className={`flex-1 py-8 rounded-3xl font-black text-2xl transition-all shadow-xl flex items-center justify-center gap-3
                                    ${accepted ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                INICIAR GUARDIA <Activity size={28} />
                            </button>

                            <button 
                                onClick={onBypass}
                                className="sm:w-1/3 py-8 text-red-600 font-bold border-4 border-red-50 hover:bg-red-50 hover:border-red-100 rounded-3xl transition-colors flex items-center justify-center gap-2 active:scale-95"
                            >
                                <AlertCircle size={24} /> BYPASS URGENCIA
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
