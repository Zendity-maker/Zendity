"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
    BeakerIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ChartPieIcon,
    ClockIcon
} from "@heroicons/react/24/outline";

export default function PatientEMARTab({ patientId }: { patientId: string }) {
    const [medications, setMedications] = useState<any[]>([]);
    const [adherenceRate, setAdherenceRate] = useState<number>(0);
    const [weeklyLogsCount, setWeeklyLogsCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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

        if (patientId) {
            fetchData();
        }
    }, [patientId]);

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
                        <p className="text-slate-500 font-medium">El paciente no figura con tratamientos farmacológicos activos.</p>
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
                                        <p className="text-sm font-bold text-slate-500 mt-1">
                                            Dosis: {pm.medication.dosage} • Vía: {pm.medication.route} • Freq: {pm.frequency === 'PRN' ? 'A demanda' : pm.scheduleTimes}
                                        </p>
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

        </div>
    );
}
