"use client";

import { useEffect, useState } from "react";
import { FaRegCalendarCheck, FaRegUser, FaNotesMedical } from "react-icons/fa";
import Link from "next/link";

export default function FamilyDashboard() {
    const [resident, setResident] = useState<any>(null);
    const [hqLogo, setHqLogo] = useState<string | null>(null);
    const [hqName, setHqName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch('/api/family/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setResident(data.resident);
                    setHqLogo(data.resident?.headquarters?.logoUrl || null);
                    setHqName(data.resident?.headquarters?.name || "Zendity Partner");
                }
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
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-3xl mb-4"></div>
            <h3 className="text-xl font-bold text-slate-800">Bienvenido al Portal Familiar</h3>
            <p className="text-slate-500 mt-2">{error || "Esta cuenta no tiene residentes asignados. Contacta a Gerencia."}</p>
        </div>
    );

    const latestVitals = resident.vitalSigns?.[0];
    const latestLog = resident.dailyLogs?.[0];

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            
            {/* Massive Headquarters Logo Branding Spotlight */}
            <div className="flex flex-col items-center justify-center pt-2 pb-6 text-center">
                {hqLogo ? (
                    <img src={hqLogo} alt={hqName} className="h-28 object-contain drop-shadow-lg mb-4" />
                ) : (
                    <div className="text-4xl font-black tracking-tighter text-slate-900 mb-2">{hqName}</div>
                )}
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Portal Oficial Exclusivo para Familiares</p>
                <div className="w-12 h-1 bg-rose-500 rounded-full mt-4"></div>
            </div>

            {/* Header / Profile */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 flex items-center sm:items-start gap-6 shadow-md shadow-slate-100/50 border border-slate-100/60 relative overflow-hidden mt-2">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-bl-full -z-0 opacity-50"></div>
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border-4 border-white shadow-xl shadow-slate-200/50 flex flex-shrink-0 items-center justify-center z-10 relative overflow-hidden">
                    <FaRegUser className="text-4xl text-slate-500" />
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
                                    <span className="font-black text-sky-500 text-lg">
                                        {latestLog.foodIntake != null ? `${latestLog.foodIntake}% consumido` : 'Sin registro'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                    <span className="text-slate-500 font-medium">Higiene Personal</span>
                                    <span className={`font-black text-lg ${latestLog.bathCompleted ? 'text-emerald-600' : 'text-amber-500'}`}>
                                        {latestLog.bathCompleted ? 'Completado ✓' : 'Pendiente'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <span className="text-slate-500 font-medium">Observaciones</span>
                                    <span className="font-semibold text-slate-700 text-sm text-right max-w-[60%] leading-relaxed">
                                        {latestLog.notes && latestLog.notes.trim() ? latestLog.notes.trim() : 'Sin observaciones'}
                                    </span>
                                </div>
                                <div className="pt-4 mt-2 border-t border-dashed border-slate-100 text-right">
                                    <span className="inline-block bg-slate-50 px-3 py-1 rounded-lg text-xs font-bold text-slate-500">
                                        {new Date(latestLog.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm font-medium">Aún no hay reportes para el turno actual.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Card Signos Vitales */}
            {latestVitals && (
                <div className="bg-white rounded-3xl p-8 shadow-md shadow-slate-100/50 border border-slate-100/60 relative overflow-hidden group hover:shadow-xl hover:border-rose-100 transition-all duration-500">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-rose-50 to-pink-50 rounded-full -z-0 transition-transform duration-700 group-hover:scale-150"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-extrabold text-slate-800 text-lg">💓 Signos Vitales Recientes</h3>
                            <span className="text-[10px] font-bold text-slate-400">
                                {new Date(latestVitals.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-rose-50 rounded-2xl p-4 text-center">
                                <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Presión</div>
                                <div className="text-xl font-black text-rose-600">{latestVitals.systolic}/{latestVitals.diastolic}</div>
                                <div className="text-[10px] font-bold text-rose-300 mt-0.5">mmHg</div>
                            </div>
                            <div className="bg-sky-50 rounded-2xl p-4 text-center">
                                <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1">SpO₂</div>
                                <div className="text-xl font-black text-sky-600">{latestVitals.spo2 ?? '—'}</div>
                                <div className="text-[10px] font-bold text-sky-300 mt-0.5">%</div>
                            </div>
                            <div className="bg-amber-50 rounded-2xl p-4 text-center">
                                <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Temperatura</div>
                                <div className="text-xl font-black text-amber-600">{latestVitals.temperature}</div>
                                <div className="text-[10px] font-bold text-amber-300 mt-0.5">°C / °F</div>
                            </div>
                            <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Pulso</div>
                                <div className="text-xl font-black text-emerald-600">{latestVitals.heartRate}</div>
                                <div className="text-[10px] font-bold text-emerald-300 mt-0.5">bpm</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Zendi Updates — WellnessDiary entries enviados por el equipo de cuidado */}
            <div className="bg-white rounded-3xl p-8 shadow-md shadow-slate-100/50 border border-slate-100/60 relative overflow-hidden group hover:shadow-xl hover:border-emerald-100 transition-all duration-500">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-emerald-50 to-green-50 rounded-full -z-0 transition-transform duration-700 group-hover:scale-150"></div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-slate-800 text-lg">💚 Actualizaciones del Equipo</h3>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl uppercase tracking-widest">
                            Zendi
                        </span>
                    </div>

                    {resident.wellnessNotes && resident.wellnessNotes.length > 0 ? (
                        <div className="space-y-3">
                            {resident.wellnessNotes.slice(0, 5).map((note: any, idx: number) => (
                                <div key={idx} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                    <p className="text-slate-700 font-medium text-sm leading-relaxed">
                                        {note.note.replace(/^\[Zendi Update\]\s*/i, '')}
                                    </p>
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-emerald-100/70">
                                        <span className="text-[11px] font-black text-emerald-700">
                                            {note.author?.name || 'Equipo de cuidado'}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {new Date(note.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm font-medium text-center py-4">
                            Aún no hay actualizaciones del equipo de cuidado.
                        </p>
                    )}
                </div>
            </div>

            {/* Plan de Atención — enlace al portal */}
            <Link href="/family/pai" className="block group">
                <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 rounded-3xl p-8 shadow-xl shadow-teal-500/20 text-white relative overflow-hidden hover:shadow-2xl transition-shadow duration-500">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -z-0"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl text-white backdrop-blur-md shadow-inner">
                                    <FaNotesMedical className="text-2xl" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl text-white tracking-tight">Plan de Atención (PAI)</h3>
                                    <p className="text-teal-200 text-sm mt-0.5">Ver historial de planes aprobados</p>
                                </div>
                            </div>
                            <div className="bg-white/20 px-4 py-2 rounded-xl text-sm font-bold text-white group-hover:bg-white/30 transition">
                                Ver →
                            </div>
                        </div>
                        {resident.lifePlan?.status === 'APPROVED' && (
                            <p className="text-emerald-200 text-xs font-bold mt-4 flex items-center gap-1">
                                ✅ Plan activo aprobado por el equipo clínico
                            </p>
                        )}
                    </div>
                </div>
            </Link>
        </div>
    );
}
