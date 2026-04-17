"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { UserCircleIcon, ClockIcon, ExclamationTriangleIcon, PlusCircleIcon, DocumentTextIcon, MapPinIcon } from "@heroicons/react/24/outline";
import DeclareUlcerModal from "@/components/medical/upps/DeclareUlcerModal";
import { Loader2 } from "lucide-react";

interface UlcerWithPatient {
    id: string;
    stage: number;
    bodyLocation: string;
    status: string;
    identifiedAt: string;
    resolvedAt: string | null;
    patient: {
        id: string;
        name: string;
        roomNumber: string | null;
        colorGroup: string | null;
    };
    logs: Array<{ nurse: { name: string } | null; createdAt: string }>;
}

interface PatientBrief {
    id: string;
    name: string;
    roomNumber: string | null;
}

export default function UPPsDashboard() {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [ulcers, setUlcers] = useState<UlcerWithPatient[]>([]);
    const [patients, setPatients] = useState<PatientBrief[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Reloj Master UI
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [ulcersRes, patientsRes] = await Promise.all([
                fetch('/api/care/upp'),
                fetch('/api/corporate/patients'),
            ]);
            const ulcersData = await ulcersRes.json();
            const patientsData = await patientsRes.json();
            if (ulcersData.success) setUlcers(ulcersData.ulcers);
            if (patientsData.success) setPatients(patientsData.patients);
        } catch (e) {
            console.error('[UPP dashboard fetch]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) fetchData();
    }, [user, fetchData]);

    const activeCount = ulcers.filter(u => u.status === 'ACTIVE').length;
    const healingCount = ulcers.filter(u => u.status === 'HEALING').length;
    const criticalCount = ulcers.filter(u => u.stage >= 3).length;

    const daysSince = (iso: string) => {
        const d = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
        return d === 0 ? 'Hoy' : d === 1 ? 'Hace 1 día' : `Hace ${d} días`;
    };

    const stageStyle = (stage: number) => {
        switch (stage) {
            case 1: return { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Stg 1' };
            case 2: return { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Stg 2' };
            case 3: return { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800 border-red-300', label: 'Stg 3' };
            case 4: return { bg: 'bg-rose-50 border-rose-300', badge: 'bg-rose-100 text-rose-900 border-rose-400', label: 'Stg 4' };
            default: return { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600', label: `Stg ${stage}` };
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 p-6 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Cabecera */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-8 h-8 text-rose-500" />
                            Tablero de Control de UPPs
                        </h1>
                        <p className="text-neutral-500 mt-1">Úlceras por Presión activas en la sede — datos en vivo.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-rose-700 transition"
                        >
                            <PlusCircleIcon className="w-5 h-5" />
                            Declarar Nueva Úlcera
                        </button>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
                        <span className="text-sm font-medium text-neutral-500">Úlceras Activas</span>
                        <span className="text-3xl font-black text-rose-600 mt-2">{activeCount}</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
                        <span className="text-sm font-medium text-neutral-500">En Cicatrización</span>
                        <span className="text-3xl font-black text-amber-600 mt-2">{healingCount}</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
                        <span className="text-sm font-medium text-neutral-500">Estadio 3-4 (Críticas)</span>
                        <span className="text-3xl font-black text-red-700 mt-2">{criticalCount}</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ClockIcon className="w-24 h-24" />
                        </div>
                        <span className="text-sm font-medium text-neutral-500">Hora del servidor</span>
                        <span className="text-xl font-black text-slate-800 mt-2 tracking-widest">{currentTime.toLocaleTimeString('es-PR')}</span>
                    </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-4">Úlceras Registradas</h2>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
                    </div>
                ) : ulcers.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <DocumentTextIcon className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">Sin úlceras activas en la sede</h3>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto mt-2">
                            La integridad cutánea de los residentes es óptima. Declara una nueva úlcera si detectas cambios.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ulcers.map(u => {
                            const s = stageStyle(u.stage);
                            const lastLog = u.logs[0];
                            return (
                                <div key={u.id} className={`rounded-2xl border-2 overflow-hidden flex flex-col ${s.bg}`}>
                                    <div className="p-5 border-b border-white/50 flex justify-between items-start bg-white">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <UserCircleIcon className="w-11 h-11 text-neutral-300 shrink-0" />
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-slate-800 leading-tight truncate">{u.patient.name}</h3>
                                                <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                                                    <MapPinIcon className="w-3.5 h-3.5" /> Hab. {u.patient.roomNumber || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${s.badge}`}>{s.label}</span>
                                    </div>
                                    <div className="p-5 flex-grow space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Ubicación</p>
                                            <p className="text-sm font-bold text-slate-800">{u.bodyLocation}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Estado</p>
                                                <p className="text-xs font-bold text-slate-700">{u.status === 'ACTIVE' ? 'Activa' : u.status === 'HEALING' ? 'Cicatrizando' : 'Resuelta'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Identificada</p>
                                                <p className="text-xs font-bold text-slate-700">{daysSince(u.identifiedAt)}</p>
                                            </div>
                                        </div>
                                        {lastLog && (
                                            <div className="text-[10px] text-slate-500 font-medium border-t border-white/50 pt-2">
                                                Última cura: {lastLog.nurse?.name || '—'} · {daysSince(lastLog.createdAt)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 bg-white border-t border-neutral-100 flex gap-2">
                                        <a
                                            href={`/corporate/medical/patients/${u.patient.id}`}
                                            className="flex-1 bg-slate-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition text-center"
                                        >
                                            Ver Bitácora
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <DeclareUlcerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                patients={patients.map(p => ({ id: p.id, name: p.name }))}
                onCreated={() => fetchData()}
            />
        </div>
    );
}
