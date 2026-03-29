"use client";

import React, { useState } from "react";
import { Calendar as CalendarIcon, Clock, ShieldAlert, CheckCircle, ChevronRight, XCircle } from "lucide-react";
import type { CalendarEventType, CalendarEventStatus } from "@/actions/calendar/calendar.actions";

export interface TransversalEvent {
    id: string;
    type: CalendarEventType;
    status: CalendarEventStatus;
    title: string;
    description?: string;
    startTime: Date;
    patientName?: string;
    isReprogrammed?: boolean; // Derivado del originContext localmente
}

interface TransversalCalendarProps {
    role: "CAREGIVER" | "CLINICAL_DIRECTOR" | "SUPER_ADMIN";
    events: TransversalEvent[];
    currentDate: Date;
    onDismiss?: (eventId: string, reason: string) => Promise<void>;
    onComplete?: (eventId: string) => Promise<void>;
}

export default function TransversalCalendar({ role, events, currentDate, onDismiss, onComplete }: TransversalCalendarProps) {
    // Filtro nativo de visibilidad Daily
    const [viewMode, setViewMode] = useState<"DAILY" | "WEEKLY">("DAILY");

    // Lógica Visual: Clínico vs Operativo
    const getEventStyles = (type: CalendarEventType) => {
        switch (type) {
            case "MEDICAL_APPOINTMENT":
            case "REEVALUATION_DUE":
                return { bg: "bg-blue-50 border-blue-200", text: "text-blue-900", badge: "bg-blue-100 text-blue-800", isClinical: true };
            case "THERAPY":
                return { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-900", badge: "bg-indigo-100 text-indigo-800", isClinical: true };
            case "FACILITY_ROUTINE":
            default:
                // Operativo: Sobrio y tenue
                return { bg: "bg-slate-50 border-slate-200", text: "text-slate-800", badge: "bg-slate-200 text-slate-700", isClinical: false };
        }
    };

    const handleDismiss = (eventId: string) => {
        const reason = prompt("Razón para descartar esta rutina (No aplica a citas médicas):");
        if (reason && onDismiss) {
            onDismiss(eventId, reason);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header / Context Panel */}
            <div className="p-6 md:p-8 bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <CalendarIcon className="text-blue-400" />
                        Línea de Tiempo Operativa
                    </h2>
                    <p className="text-slate-400 font-medium mt-1">
                        {role === "CAREGIVER" ? "Tus responsabilidades asignadas de hoy" : "Panorama General de la Sede"}
                    </p>
                </div>
                {role !== "CAREGIVER" && (
                    <div className="bg-slate-800 p-1 rounded-xl flex">
                        <button 
                            className={`px-4 py-2 rounded-lg font-bold text-sm ${viewMode === "DAILY" ? "bg-slate-700 text-white" : "text-slate-400"}`}
                            onClick={() => setViewMode("DAILY")}
                        >
                            Día
                        </button>
                        <button 
                            className={`px-4 py-2 rounded-lg font-bold text-sm ${viewMode === "WEEKLY" ? "bg-slate-700 text-white" : "text-slate-400"}`}
                            onClick={() => setViewMode("WEEKLY")}
                        >
                            Semana
                        </button>
                    </div>
                )}
            </div>

            {/* Timeline Stream */}
            <div className="p-6 md:p-8 bg-slate-50 min-h-[500px]">
                {events.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                        <CheckCircle size={48} className="mb-4 text-emerald-200" />
                        <h3 className="text-xl font-bold text-slate-500">Agenda Despejada</h3>
                        <p>No hay eventos programados en este bloque.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {events.map((evt) => {
                            const styles = getEventStyles(evt.type);
                            const isCompleted = evt.status === "COMPLETED";
                            const isDismissed = evt.status === "DISMISSED";
                            
                            // Un evento clínico NUNCA puede ser "Dismissed"
                            const canDismiss = !styles.isClinical && !isCompleted && !isDismissed;

                            return (
                                <div key={evt.id} className={`p-5 rounded-2xl border-2 transition-all ${styles.bg} ${isCompleted || isDismissed ? 'opacity-50 grayscale' : 'shadow-sm'}`}>
                                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                        
                                        {/* Event Info */}
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1">
                                                <Clock className={styles.text} size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${styles.badge}`}>
                                                        {evt.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                    {evt.isReprogrammed && (
                                                        <span className="text-xs font-bold px-2 py-1 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                                                            <ShieldAlert size={12}/> REPROGRAMADO AUTO
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className={`text-lg font-bold ${styles.text} ${isCompleted ? 'line-through' : ''}`}>
                                                    {evt.title}
                                                </h4>
                                                {evt.patientName && (
                                                    <p className={`font-medium ${styles.text} opacity-80`}>
                                                        Paciente: {evt.patientName}
                                                    </p>
                                                )}
                                                {evt.description && (
                                                    <p className={`text-sm mt-2 ${styles.text} opacity-70 border-l-2 border-current pl-3`}>
                                                        {evt.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions (Only Caregiver / Operator roles interact directly here) */}
                                        <div className="flex gap-2">
                                            {isCompleted && <span className="text-emerald-600 font-bold px-4 py-2">Completado</span>}
                                            {isDismissed && <span className="text-slate-500 font-bold px-4 py-2">Silenciado</span>}
                                            
                                            {!isCompleted && !isDismissed && role === "CAREGIVER" && (
                                                <>
                                                    {canDismiss && (
                                                        <button 
                                                            onClick={() => handleDismiss(evt.id)}
                                                            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white text-slate-600 font-bold border border-slate-300 hover:bg-slate-100 transition-colors"
                                                        >
                                                            <XCircle size={18}/> Pospone
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => onComplete?.(evt.id)}
                                                        className={`flex items-center gap-1 px-6 py-2 rounded-xl text-white font-bold transition-transform active:scale-95 ${styles.isClinical ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                                                    >
                                                        Confirmar <ChevronRight size={18}/>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
