"use client";

import { useEffect, useState } from "react";
import { FaRegCalendarCheck, FaRegUser, FaNotesMedical } from "react-icons/fa";

export default function FamilyDashboard() {
    const [resident, setResident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch('/api/family/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.success) setResident(data.resident);
                else setError(data.error || "No se encontraron datos");
                setLoading(false);
            })
            .catch(() => {
                setError("Error de conexión");
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
        </div>
    );

    if (error || !resident) return (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-3xl mb-4">🏠</div>
            <h3 className="text-xl font-bold text-slate-800">Bienvenido al Portal Familiar</h3>
            <p className="text-slate-500 mt-2">{error || "Esta cuenta no tiene residentes asignados. Contacta a Gerencia."}</p>
        </div>
    );

    const latestVitals = resident.vitalSigns?.[0];
    const latestLog = resident.dailyLogs?.[0];

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            {/* Header / Profile */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 flex items-center sm:items-start gap-6 shadow-md shadow-slate-100/50 border border-slate-100/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-bl-full -z-0 opacity-50"></div>
                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-200 border-4 border-white shadow-xl shadow-slate-200/50 flex flex-shrink-0 items-center justify-center z-10 relative overflow-hidden">
                    <FaRegUser className="text-4xl text-slate-400" />
                </div>
                <div className="text-left flex-1 z-10">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">{resident.name}</h2>
                    <p className="text-slate-500 font-bold mb-1">Habitación {resident.roomNumber || "No asignada"}</p>

                    <div className="mt-4 flex flex-wrap gap-2 justify-start">
                        {resident.lifePlan ? (
                            <span className="px-3 py-1 bg-green-50 text-green-600 rounded-xl text-[10px] font-black border border-green-100 uppercase tracking-widest shadow-sm">
                                Plan Activo
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black border border-amber-100 uppercase tracking-widest shadow-sm">
                                Plan Pendiente
                            </span>
                        )}
                        <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black border border-slate-200 uppercase tracking-widest shadow-sm">
                            {resident.diet || "Dieta Regular"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 gap-6">
                {/* Daily Log Card */}
                <div className="bg-white rounded-3xl p-8 shadow-md shadow-slate-100/50 border border-slate-100/60 relative overflow-hidden group hover:shadow-xl hover:border-sky-100 transition-all duration-500">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-sky-50 to-blue-50 rounded-full -z-0 transition-transform duration-700 group-hover:scale-150"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-extrabold text-slate-800 text-lg">Reporte de Cuidado</h3>
                            <div className="bg-sky-100 p-3 rounded-2xl text-sky-500 shadow-inner">
                                <FaRegCalendarCheck className="text-xl" />
                            </div>
                        </div>

                        {latestLog ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                    <span className="text-slate-500 font-medium">Alimentación</span>
                                    <span className="font-black text-sky-500 text-lg capitalize">{latestLog.meals}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                    <span className="text-slate-500 font-medium">Higiene Personal</span>
                                    <span className="font-black text-slate-800 text-lg">{latestLog.hygiene ? "Completado" : "Pendiente"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Movilidad Asistida</span>
                                    <span className="font-black text-slate-800 text-lg capitalize">{latestLog.mobility}</span>
                                </div>
                                <div className="pt-4 mt-2 border-t border-dashed border-slate-100 text-right">
                                    <span className="inline-block bg-slate-50 px-3 py-1 rounded-lg text-xs font-bold text-slate-400">Turno de hoy</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm font-medium">Aún no hay reportes para el turno actual.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Life Plan Summary */}
            {resident.lifePlan && (
                <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 rounded-3xl p-8 shadow-xl shadow-teal-500/20 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -z-0"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-white/20 p-3 rounded-2xl text-white backdrop-blur-md shadow-inner">
                                <FaNotesMedical className="text-2xl" />
                            </div>
                            <h3 className="font-black text-2xl text-white tracking-tight">Plan de Vida (LifePlan™)</h3>
                        </div>

                        <div className="bg-teal-900/30 rounded-2xl p-6 backdrop-blur-sm border border-white/10 mb-6">
                            <p className="text-teal-50 font-medium leading-relaxed italic">
                                "{resident.lifePlan.aiAnalysis || "El análisis de IA está en proceso."}"
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-teal-200 mb-3 text-xs uppercase tracking-widest pl-1">Protocolos Activos</h4>
                            <div className="flex flex-wrap gap-2">
                                {resident.lifePlan.activeProtocols?.split(',').map((protocol: string, idx: number) => (
                                    <span key={idx} className="bg-white/10 px-4 py-2 rounded-xl text-xs font-black text-white hover:bg-white/20 transition-colors border border-white/5">
                                        {protocol.trim()}
                                    </span>
                                ))}
                                {!resident.lifePlan.activeProtocols && <span className="text-sm font-medium text-teal-200">En fase de recolección de configuraciones.</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
