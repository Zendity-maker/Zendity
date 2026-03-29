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
    isReprogrammed?: boolean;
}

interface TransversalCalendarProps {
    role: "CAREGIVER" | "CLINICAL_DIRECTOR" | "SUPER_ADMIN";
    events: TransversalEvent[];
    currentDate: Date;
    onDismiss?: (eventId: string, reason: string) => Promise<void>;
    onComplete?: (eventId: string) => Promise<void>;
}

export default function TransversalCalendar({ role, events, currentDate, onDismiss, onComplete }: TransversalCalendarProps) {
    const [viewMode, setViewMode] = useState<"DAILY" | "WEEKLY">("DAILY");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [dismissModalEventId, setDismissModalEventId] = useState<string | null>(null);
    const [dismissReason, setDismissReason] = useState("");

    // --- Filtro real conectado al toggle ---
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const filteredEvents = viewMode === "DAILY"
        ? events.filter(e => e.startTime >= startOfDay && e.startTime <= endOfDay)
        : events.filter(e => e.startTime >= startOfWeek && e.startTime <= endOfWeek);

    // --- Lógica Visual: Clínico vs Operativo ---
    const getEventStyles = (type: CalendarEventType) => {
        switch (type) {
            case "MEDICAL_APPOINTMENT":
            case "REEVALUATION_DUE":
                return {
                    container: "border-l-[8px] border-l-blue-500 bg-white border-y border-r border-slate-200 shadow-sm",
                    text: "text-blue-900",
                    badge: "bg-blue-50 text-blue-700 border border-blue-100",
                    iconBg: "bg-blue-100 text-blue-600",
                    isClinical: true
                };
            case "THERAPY":
                return {
                    container: "border-l-[8px] border-l-indigo-500 bg-white border-y border-r border-slate-200 shadow-sm",
                    text: "text-indigo-900",
                    badge: "bg-indigo-50 text-indigo-700 border border-indigo-100",
                    iconBg: "bg-indigo-100 text-indigo-600",
                    isClinical: true
                };
            case "FACILITY_ROUTINE":
            default:
                return {
                    container: "border-l-[8px] border-l-slate-400 bg-white border-y border-r border-slate-200 shadow-sm",
                    text: "text-slate-900",
                    badge: "bg-slate-50 text-slate-600 border border-slate-200",
                    iconBg: "bg-slate-100 text-slate-500",
                    isClinical: false
                };
        }
    };

    // --- Dismiss: abre modal inline (reemplaza prompt()) ---
    const handleDismissAction = (eventId: string) => {
        setDismissModalEventId(eventId);
        setDismissReason("");
    };

    const confirmDismiss = async () => {
        if (!dismissModalEventId || !dismissReason.trim() || !onDismiss) return;
        setProcessingId(dismissModalEventId);
        try {
            await onDismiss(dismissModalEventId, dismissReason.trim());
        } finally {
            setProcessingId(null);
            setDismissModalEventId(null);
            setDismissReason("");
        }
    };

    const handleCompleteAction = async (eventId: string) => {
        if (!onComplete || processingId) return;
        setProcessingId(eventId);
        try {
            await onComplete(eventId);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto bg-slate-50 rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col font-sans">
            {/* Header / Context Panel */}
            <div className="p-8 md:p-10 bg-white flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <CalendarIcon size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                            Línea de Tiempo Operativa
                        </h2>
                        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs mt-2 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                            {role === "CAREGIVER" ? "Tus Responsabilidades Asignadas (Hoy)" : "Panorama General de la Sede"}
                        </p>
                    </div>
                </div>
                {role !== "CAREGIVER" && (
                    <div className="bg-slate-100 p-2 rounded-[2rem] flex border border-slate-200 shadow-inner">
                        <button
                            className={`px-6 py-3 rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all ${viewMode === "DAILY" ? "bg-white text-slate-900 shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                            onClick={() => setViewMode("DAILY")}
                        >
                            Vista Día
                        </button>
                        <button
                            className={`px-6 py-3 rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all ${viewMode === "WEEKLY" ? "bg-white text-slate-900 shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                            onClick={() => setViewMode("WEEKLY")}
                        >
                            Vista Semana
                        </button>
                    </div>
                )}
            </div>

            {/* Timeline Stream */}
            <div className="p-6 md:p-10 lg:p-12 bg-slate-50/50 min-h-[600px] flex flex-col">
                {filteredEvents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20 bg-white rounded-[2.5rem] border-2 border-slate-200 border-dashed">
                        <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center shadow-sm mb-6">
                            <CheckCircle size={48} className="text-teal-400" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-800">Agenda Despejada</h3>
                        <p className="text-slate-500 font-medium mt-2 text-lg">No hay eventos programados en este bloque temporal.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredEvents.map((evt) => {
                            const styles = getEventStyles(evt.type);
                            const isCompleted = evt.status === "COMPLETED";
                            const isDismissed = evt.status === "DISMISSED";
                            const canDismiss = !styles.isClinical && !isCompleted && !isDismissed;

                            return (
                                <div key={evt.id} className={`p-8 lg:p-10 rounded-[2.5rem] transition-all flex flex-col xl:flex-row gap-8 justify-between xl:items-center ${styles.container} ${isCompleted || isDismissed ? 'opacity-40 grayscale pointer-events-none' : 'hover:shadow-lg'}`}>

                                    {/* Event Info */}
                                    <div className="flex items-start gap-6">
                                        <div className={`mt-1 shrink-0 w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${styles.iconBg}`}>
                                            <Clock size={32} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`text-sm font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm ${styles.badge}`}>
                                                    {evt.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {evt.isReprogrammed && (
                                                    <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 shadow-sm flex items-center gap-1 uppercase tracking-widest">
                                                        <ShieldAlert size={14} strokeWidth={3} /> Reprogramado Auto
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className={`text-2xl font-black ${styles.text} ${isCompleted ? 'line-through' : ''}`}>
                                                {evt.title}
                                            </h4>
                                            {evt.patientName && (
                                                <p className="font-bold text-slate-600 mt-1 text-lg">
                                                    Sujeto: <span className="text-slate-900">{evt.patientName}</span>
                                                </p>
                                            )}
                                            {evt.description && (
                                                <p className="text-base font-medium mt-3 text-slate-500 border-l-[4px] border-slate-200 pl-4 bg-slate-50 p-4 rounded-2xl">
                                                    {evt.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col sm:flex-row xl:flex-col items-stretch xl:items-end gap-3 shrink-0 mt-2 xl:mt-0">
                                        {isCompleted && (
                                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold px-6 py-4 rounded-[1.5rem] text-sm md:text-base uppercase tracking-widest justify-center">
                                                <CheckCircle size={20} /> Validado Exitosamente
                                            </div>
                                        )}
                                        {isDismissed && (
                                            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-500 font-extrabold px-6 py-4 rounded-[1.5rem] text-sm md:text-base uppercase tracking-widest justify-center">
                                                <XCircle size={20} /> Silenciado
                                            </div>
                                        )}

                                        {!isCompleted && !isDismissed && role === "CAREGIVER" && (
                                            <>
                                                {canDismiss && (
                                                    <button
                                                        onClick={() => handleDismissAction(evt.id)}
                                                        disabled={processingId !== null}
                                                        className="flex items-center justify-center gap-2 px-8 py-5 rounded-[2rem] bg-white text-slate-600 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 text-sm xl:min-w-[200px]"
                                                    >
                                                        <XCircle size={20} /> {processingId === evt.id ? "Procesando" : "No Aplica / Pospone"}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleCompleteAction(evt.id)}
                                                    disabled={processingId !== null}
                                                    className={`flex items-center justify-center gap-2 px-10 py-5 rounded-[2rem] text-white font-black uppercase tracking-widest transition-transform shadow-lg active:scale-[0.98] disabled:scale-100 disabled:opacity-50 text-sm md:text-base xl:min-w-[280px] ${styles.isClinical ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/40'}`}
                                                >
                                                    {processingId === evt.id ? "PROCESANDO..." : <>CONFIRMAR COMPLETADO <ChevronRight size={22} strokeWidth={3} /></>}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Dismiss Inline (reemplaza prompt() nativo) */}
            {dismissModalEventId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-200">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Razón del descarte</h3>
                        <p className="text-slate-500 text-sm font-medium mb-6">Esta razón queda registrada en el sistema. No aplica a citas médicas.</p>
                        <textarea
                            value={dismissReason}
                            onChange={e => setDismissReason(e.target.value)}
                            placeholder="Ej: Residente en terapia, se reprograma para mañana..."
                            className="w-full h-28 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-5 text-sm font-medium focus:ring-2 focus:ring-slate-400 outline-none resize-none mb-6"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDismissModalEventId(null)}
                                className="flex-1 py-4 rounded-[2rem] bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDismiss}
                                disabled={!dismissReason.trim() || processingId !== null}
                                className="flex-1 py-4 rounded-[2rem] bg-slate-900 text-white font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
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
