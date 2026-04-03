"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
    BeakerIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ChartPieIcon,
    ClockIcon,
    PencilSquareIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/context/AuthContext";

const AVAILABLE_TIMES = ["06:00 AM", "08:00 AM", "02:00 PM", "05:00 PM", "08:00 PM", "10:00 PM", "08:00 AM (Semanal)"];

const FREQUENCY_PRESETS = [
    { label: "PRN (A demanda)", times: ["PRN"], color: "rose" },
    { label: "BID (2x al día)", times: ["08:00 AM", "08:00 PM"], color: "indigo" },
    { label: "TID (3x al día)", times: ["08:00 AM", "02:00 PM", "08:00 PM"], color: "emerald" },
    { label: "QID (4x al día)", times: ["06:00 AM", "02:00 PM", "05:00 PM", "08:00 PM"], color: "amber" },
    { label: "Semanal", times: ["08:00 AM (Semanal)"], color: "purple" }
];

export default function PatientEMARTab({ patientId }: { patientId: string }) {
    const { user } = useAuth();
    const [medications, setMedications] = useState<any[]>([]);
    const [adherenceRate, setAdherenceRate] = useState<number>(0);
    const [weeklyLogsCount, setWeeklyLogsCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Manual Schedule Edit State
    const [editingMedId, setEditingMedId] = useState<string | null>(null);
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [prepDuration, setPrepDuration] = useState<string>("1_SEMANA");
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/emar/patient/${patientId}`);
            const data = await res.json();
            if (data.success) {
                setMedications(data.medications);
                setAdherenceRate(data.adherenceRate);
                setWeeklyLogsCount(data.weeklyLogsCount);
            }
        } catch (error) {
            console.error("Error fetching patient eMAR data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (patientId) {
            fetchData();
        }
    }, [patientId]);

    const openEditModal = (pm: any) => {
        setEditingMedId(pm.id);
        const existing = pm.scheduleTimes ? pm.scheduleTimes.split(',').map((t: string) => t.trim()) : [];
        setSelectedTimes(existing);
        setPrepDuration(pm.prepDuration || "1_SEMANA");
    };

    const toggleTime = (time: string) => {
        setSelectedTimes(prev => {
            if (time === "PRN") return ["PRN"];
            const newTimes = prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time];
            return newTimes.filter(t => t !== "PRN");
        });
    };

    const applyPreset = (times: string[]) => {
        setSelectedTimes(times);
    };

    const saveSchedule = async () => {
        if (!editingMedId) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/med/crud", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "MODIFIED",
                    patientMedicationId: editingMedId,
                    scheduleTimes: selectedTimes.length > 0 ? selectedTimes.join(", ") : "PRN",
                    prepDuration: prepDuration,
                    authorId: user?.id,
                    reason: "Reasignación clínica de horarios (Enfermería)"
                })
            });
            const data = await res.json();
            if (data.success) {
                setEditingMedId(null);
                setLoading(true);
                fetchData();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error de red");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-12 text-center animate-pulse">
                <BeakerIcon className="w-10 h-10 text-teal-300 mx-auto mb-4" />
                <p className="text-teal-600 font-bold">Cargando Dosier eMAR...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* 1. KPIs de Adherencia (Ring Chart Simulado) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-slate-100"
                                strokeDasharray="100, 100"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3"
                            />
                            <path
                                className={`${adherenceRate >= 80 ? 'text-emerald-500' : adherenceRate >= 50 ? 'text-amber-500' : 'text-rose-500'}`}
                                strokeDasharray={`${adherenceRate}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-black text-sm text-slate-800">
                            {adherenceRate}%
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Adherencia eMAR Semanal</h3>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">
                            {adherenceRate >= 80 ? 'Óptima' : adherenceRate >= 50 ? 'Regular' : 'Crítica'}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-teal-50 p-3 rounded-xl text-teal-600">
                        <ChartPieIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Dosis Contabilizadas</p>
                        <p className="text-2xl font-black text-slate-800">{weeklyLogsCount} <span className="text-sm font-medium text-slate-400">esta semana</span></p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                        <BeakerIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Tratamientos Activos</p>
                        <p className="text-2xl font-black text-slate-800">{medications.length} <span className="text-sm font-medium text-slate-400">fármacos</span></p>
                    </div>
                </div>

            </div>

            {/* 2. Listado de Medicamentos Activos con su Historial Reciente */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-800">Posología y Trazabilidad (Últimos 20 Eventos)</h3>
                </div>

                {medications.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-slate-500 font-medium">El residente no figura con tratamientos farmacológicos activos.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {medications.map((pm: any) => (
                            <div key={pm.id} className="p-6">
                                {/* Cabecera del Medicamento */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-lg font-black text-teal-900 flex items-center gap-2">
                                            {pm.medication.name}
                                            {pm.frequency === 'PRN' && <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase tracking-widest">S.O.S</span>}
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            <p className="text-sm font-bold text-slate-500 mt-1">
                                                Dosis: {pm.medication.dosage}  Vía: {pm.medication.route}  Freq: {pm.frequency === 'PRN' ? 'A demanda' : pm.scheduleTimes}
                                            </p>
                                            {pm.prepDuration === '2_SEMANAS' && (
                                                <span className="text-[10px] mt-1 bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-violet-200">Carrito 14 Días</span>
                                            )}
                                            {pm.prepDuration === '1_SEMANA' && (
                                                <span className="text-[10px] mt-1 bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-blue-200">Carrito 7 Días</span>
                                            )}
                                            
                                            <button
                                                onClick={() => openEditModal(pm)}
                                                className="bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 font-bold px-3 py-1 rounded-lg text-xs mt-1 transition-colors flex items-center gap-1 border border-slate-200"
                                            >
                                                <PencilSquareIcon className="w-3 h-3" /> Asignar Horario
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 italic">"{pm.instructions}"</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prescrito por</p>
                                        <p className="text-sm font-medium text-slate-700">{pm.prescribedBy}</p>
                                    </div>
                                </div>

                                {/* Timeline Minimizado de Suministros (Solo los ultimos 5 por estetica) */}
                                {pm.administrations && pm.administrations.length > 0 ? (
                                    <div className="bg-slate-50 rounded-xl p-4 mt-4 border border-slate-100">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Historial Reciente de Suministros</p>
                                        <div className="space-y-3">
                                            {pm.administrations.slice(0, 5).map((log: any) => (
                                                <div key={log.id} className="flex items-start gap-3">
                                                    <div className="mt-0.5">
                                                        {log.status === 'ADMINISTERED' && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                                                        {log.status === 'REFUSED' && <XCircleIcon className="w-5 h-5 text-rose-500" />}
                                                        {log.status === 'OMITTED' && <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                            {log.status === 'ADMINISTERED' ? 'Suministrado' : log.status === 'REFUSED' ? 'Rechazado' : 'Omitido'}
                                                            <span className="text-xs text-slate-400 flex items-center gap-1 font-medium"><ClockIcon className="w-3 h-3" /> {format(new Date(log.administeredAt), "dd MMM, HH:mm")}</span>
                                                        </p>
                                                        {log.notes && <p className="text-xs text-slate-500 mt-0.5 italic text-rose-600">Nota: {log.notes}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                            {pm.administrations.length > 5 && (
                                                <p className="text-xs text-slate-400 font-medium pl-8 italic">+ {pm.administrations.length - 5} registros anteriores ocultos</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-xl p-4 mt-4 border border-dashed border-slate-200">
                                        <p className="text-xs text-slate-400 font-medium text-center">Nigún registro biométrico en el historial aún.</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Reasignación Manual de Horarios */}
            {editingMedId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 leading-relaxed">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Asignar Horarios</h3>
                        <p className="text-sm font-medium text-slate-500 mb-6 border-b border-slate-100 pb-4">Define en qué carritos aparecerá este medicamento para las cuidadoras.</p>

                        <div className="mb-6 p-4 bg-teal-50 border border-teal-100 rounded-xl">
                            <h4 className="text-sm font-black text-teal-900 mb-3 flex items-center gap-2"> Preparación de Carrito (Blíster)</h4>
                            <div className="flex gap-4">
                                <label className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${prepDuration === '1_SEMANA' ? 'border-teal-500 bg-teal-600 text-white shadow-md' : 'border-teal-200 text-teal-700 bg-white hover:border-teal-300'}`}>
                                    <input type="radio" value="1_SEMANA" checked={prepDuration === '1_SEMANA'} onChange={(e) => setPrepDuration(e.target.value)} className="hidden" />
                                    <span className="font-bold text-sm">1 Semana</span>
                                    <span className={`text-[10px] uppercase font-bold mt-1 ${prepDuration === '1_SEMANA' ? 'text-teal-200' : 'text-teal-400'}`}>7 Días</span>
                                </label>
                                <label className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${prepDuration === '2_SEMANAS' ? 'border-teal-500 bg-teal-600 text-white shadow-md' : 'border-teal-200 text-teal-700 bg-white hover:border-teal-300'}`}>
                                    <input type="radio" value="2_SEMANAS" checked={prepDuration === '2_SEMANAS'} onChange={(e) => setPrepDuration(e.target.value)} className="hidden" />
                                    <span className="font-bold text-sm">2 Semanas</span>
                                    <span className={`text-[10px] uppercase font-bold mt-1 ${prepDuration === '2_SEMANAS' ? 'text-teal-200' : 'text-teal-400'}`}>14 Días</span>
                                </label>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Accesos Rápidos (Frecuencia)</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {FREQUENCY_PRESETS.map(preset => (
                                    <button
                                        key={preset.label}
                                        onClick={() => applyPreset(preset.times)}
                                        className={`py-2 px-3 rounded-xl font-bold text-sm border-2 transition-all text-left ${JSON.stringify(selectedTimes) === JSON.stringify(preset.times)
                                            ? `border-${preset.color}-500 bg-${preset.color}-50 text-${preset.color}-700 shadow-sm ring-2 ring-${preset.color}-500/20 ring-offset-1`
                                            : `border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50`
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-8">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Distribución Manual (Recuentos)</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {AVAILABLE_TIMES.map(time => (
                                    <label key={time} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedTimes.includes(time) ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-sm' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTimes.includes(time)}
                                            onChange={() => toggleTime(time)}
                                            className="w-5 h-5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 focus:ring-2 focus:ring-offset-1"
                                        />
                                        <span className="font-bold text-sm">{time}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setEditingMedId(null)}
                                className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveSchedule}
                                disabled={submitting || selectedTimes.length === 0}
                                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'Guardando...' : 'Aplicar Horarios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
