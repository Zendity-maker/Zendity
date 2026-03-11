"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import ZendiWidget from "@/components/ZendiWidget";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function KitchenDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [activePatients, setActivePatients] = useState<any[]>([]);
    const [hospitalPatients, setHospitalPatients] = useState<any[]>([]);
    const [observations, setObservations] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;

        // Prevent non-kitchen/admin access
        if (user.role !== "KITCHEN" && user.role !== "ADMIN" && user.role !== "DIRECTOR") {
            router.replace("/");
            return;
        }

        const fetchDashboard = async () => {
            try {
                const res = await fetch(`/api/kitchen/dashboard?hqId=${user.headquartersId || user.hqId}`);
                const data = await res.json();
                if (data.success) {
                    setActivePatients(data.activePatients);
                    setHospitalPatients(data.hospitalPatients);
                    setObservations(data.observations);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [user, router]);

    if (!user || loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-500">Cargando ZENDITY Kitchen...</div>;
    }

    const solidoCount = activePatients.filter(p => !p.diet || p.diet.toLowerCase().includes("solido") || p.diet.toLowerCase().includes("sólido") || p.diet.toLowerCase().includes("regular")).length;
    const mojadoCount = activePatients.filter(p => p.diet && (p.diet.toLowerCase().includes("mojado") || p.diet.toLowerCase().includes("puré"))).length;
    const pegCount = activePatients.filter(p => p.diet && p.diet.toLowerCase().includes("peg")).length;
    const otherCount = activePatients.length - (solidoCount + mojadoCount + pegCount);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-xl shadow-md">
                            🍳
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Cocina y Nutrición</h1>
                            <p className="text-xs font-bold text-slate-400 capitalize">{user.hqName || 'Zendity Network'}</p>
                        </div>
                    </div>
                    <button onClick={logout} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition">
                        Cerrar Sesión / Salir
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Residentes</p>
                        <p className="text-4xl font-black text-slate-800">{activePatients.length}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl shadow-sm flex flex-col justify-center">
                        <p className="text-xs font-bold text-amber-600/70 uppercase tracking-widest mb-1">En Hospital</p>
                        <p className="text-4xl font-black text-amber-700">{hospitalPatients.length}</p>
                    </div>
                    <div className="col-span-2 bg-gradient-to-r from-orange-500 to-rose-500 p-6 rounded-2xl shadow-md text-white flex items-center justify-between">
                        <div>
                            <p className="text-xs text-white/80 font-bold uppercase tracking-widest mb-1">Satisfacción Reciente</p>
                            <p className="text-2xl font-black text-white">
                                {observations.length > 0 ? (
                                    <>
                                        {observations[0].satisfactionScore} <span className="text-rose-200">/ 5 Estrellas</span>
                                    </>
                                ) : (
                                    "Sin Evaluaciones"
                                )}
                            </p>
                        </div>
                        <div className="text-4xl opacity-80">⭐</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Census & Diets */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Diet Breakdown */}
                        <div>
                            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                                <span className="w-2 h-6 bg-orange-500 rounded-full inline-block"></span> Distribución de Dietas
                            </h2>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                                    <p className="text-3xl font-black text-slate-700 mb-1">{solidoCount + otherCount}</p>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sólido / Regular</p>
                                </div>
                                <div className="bg-sky-50 p-5 rounded-2xl border border-sky-200 shadow-sm text-center">
                                    <p className="text-3xl font-black text-sky-700 mb-1">{mojadoCount}</p>
                                    <p className="text-xs font-bold text-sky-600 uppercase tracking-widest">Mojado / Puré</p>
                                </div>
                                <div className="bg-purple-50 p-5 rounded-2xl border border-purple-200 shadow-sm text-center">
                                    <p className="text-3xl font-black text-purple-700 mb-1">{pegCount}</p>
                                    <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">Alimentación PEG</p>
                                </div>
                            </div>
                        </div>

                        {/* Resident List */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-lg font-black text-slate-800">Censo Activo para Preparación</h3>
                                <p className="text-sm text-slate-500 font-medium">Lista de residentes presentes en la facilidad y su tipo de dieta requerida.</p>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                {activePatients.map(patient => (
                                    <div key={patient.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold tracking-tighter">
                                                {patient.name.charAt(0)}{patient.name.split(' ')[1]?.charAt(0) || ''}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{patient.name}</p>
                                                <p className="text-xs font-medium text-slate-400">Cuarto: {patient.roomNumber || 'No Asignado'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${(patient.diet || '').toLowerCase().includes('peg') ? 'bg-purple-100 text-purple-700' :
                                                    (patient.diet || '').toLowerCase().includes('mojado') || (patient.diet || '').toLowerCase().includes('puré') ? 'bg-sky-100 text-sky-700' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {patient.diet || 'Regular (Sólida)'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Supervisor Observations */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-6 bg-rose-500 rounded-full inline-block"></span> Observaciones del Supervisor
                        </h2>

                        <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                            {observations.length === 0 ? (
                                <div className="text-center p-8 bg-slate-50 rounded-3xl border border-slate-200">
                                    <p className="text-4xl mb-3">✅</p>
                                    <p className="font-bold text-slate-500 text-sm">No hay reportes ni observaciones recientes.</p>
                                </div>
                            ) : (
                                observations.map(obs => (
                                    <div key={obs.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} className={`text-lg ${i < obs.satisfactionScore ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                                                ))}
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                                {format(new Date(obs.createdAt), "dd MMM, hh:mm a", { locale: es })}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-600 mb-4">{obs.comments}</p>

                                        {obs.photoUrl && (
                                            <div className="mb-4 rounded-xl overflow-hidden border border-slate-200">
                                                <img src={obs.photoUrl} alt="Observación" className="w-full h-auto object-cover" />
                                            </div>
                                        )}

                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-t border-slate-100 pt-3">
                                            <span>Enviado por: {obs.supervisor?.name || 'Supervisor'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <ZendiWidget />
        </div>
    );
}
