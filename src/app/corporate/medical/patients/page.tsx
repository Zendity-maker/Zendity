"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    UserIcon,
    ArrowRightIcon,
    ExclamationTriangleIcon,
    BuildingOffice2Icon,
    SparklesIcon,
    XMarkIcon,
    CheckCircleIcon
} from "@heroicons/react/24/outline";
import SendFamilyEmailModal from "@/components/medical/patient/SendFamilyEmailModal";

// ── Modal de generación masiva de PAIs ──────────────────────────────────────
function BatchPaiModal({ patients, onClose }: { patients: any[]; onClose: () => void }) {
    const activePatients = patients.filter(p => p.status === 'ACTIVE');
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const [results, setResults] = useState<{ id: string; name: string; status: 'pending' | 'ok' | 'error'; error?: string }[]>(
        activePatients.map(p => ({ id: p.id, name: p.name, status: 'pending' }))
    );
    const [current, setCurrent] = useState(-1);

    const run = async () => {
        setRunning(true);
        for (let i = 0; i < activePatients.length; i++) {
            setCurrent(i);
            const p = activePatients[i];
            try {
                // 1. Llamar ai-build para generar el PAI
                const buildRes = await fetch(`/api/corporate/patients/${p.id}/pai/ai-build`, { method: 'POST' });
                const buildData = await buildRes.json();
                if (!buildData.success) throw new Error(buildData.error || 'Error IA');

                // 2. Obtener el PAI DRAFT existente para tener su id
                const getRes = await fetch(`/api/corporate/patients/${p.id}/pai`);
                const getData = await getRes.json();
                const existingId = getData.lifePlan?.status === 'DRAFT' ? getData.lifePlan?.id : undefined;

                // 3. Guardar el PAI generado (mantiene DRAFT para revisión)
                const saveBody = {
                    ...(existingId ? { id: existingId } : {}),
                    ...buildData.aiGeneratedPai,
                    familyVersion: buildData.familyVersion,
                    status: 'DRAFT',
                    type: 'INITIAL'
                };
                const saveRes = await fetch(`/api/corporate/patients/${p.id}/pai`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(saveBody)
                });
                const saveData = await saveRes.json();
                if (!saveData.success) throw new Error(saveData.error || 'Error al guardar');

                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'ok' } : r));
            } catch (err: any) {
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', error: err.message } : r));
            }
        }
        setCurrent(-1);
        setRunning(false);
        setDone(true);
    };

    const okCount = results.filter(r => r.status === 'ok').length;
    const errCount = results.filter(r => r.status === 'error').length;
    const progress = Math.round(((okCount + errCount) / activePatients.length) * 100);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                            <SparklesIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-800 text-lg leading-none">Generación Masiva de PAIs</h2>
                            <p className="text-slate-500 text-sm mt-0.5">{activePatients.length} residentes activos · Los PAIs quedan en BORRADOR para revisión</p>
                        </div>
                    </div>
                    {!running && <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors"><XMarkIcon className="w-6 h-6" /></button>}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                    {!running && !done && (
                        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-4">
                            <p className="text-violet-800 font-bold text-sm">¿Qué hará Zendi AI?</p>
                            <ul className="mt-2 text-violet-700 text-sm space-y-1">
                                <li>• Analiza signos vitales, medicamentos y adherencia (30 días)</li>
                                <li>• Detecta caídas, UPPs activas y alertas clínicas</li>
                                <li>• Genera resumen clínico, riesgos priorizados y objetivos de cuidado</li>
                                <li>• Redacta versión familiar en lenguaje cálido y comprensible</li>
                                <li>• Guarda todo como BORRADOR — tú decides cuándo aprobar cada uno</li>
                            </ul>
                        </div>
                    )}

                    {running && (
                        <div className="mb-4">
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-bold text-slate-600">Progreso</span>
                                <span className="text-sm font-black text-violet-700">{okCount + errCount} / {activePatients.length}</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}

                    {done && (
                        <div className={`rounded-2xl p-4 mb-4 border ${errCount === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <p className={`font-black text-base ${errCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {errCount === 0 ? '✅ Todos los PAIs generados exitosamente' : `⚠️ ${okCount} generados, ${errCount} con error`}
                            </p>
                            <p className="text-sm mt-1 text-slate-600">Ingresa al expediente de cada residente para revisar y aprobar su PAI.</p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        {results.map((r, i) => (
                            <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${r.status === 'ok' ? 'bg-emerald-50 border-emerald-200' : r.status === 'error' ? 'bg-red-50 border-red-200' : current === i ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex-shrink-0">
                                    {r.status === 'ok' && <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
                                    {r.status === 'error' && <span className="text-red-500 text-sm font-black">✕</span>}
                                    {r.status === 'pending' && current === i && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
                                    {r.status === 'pending' && current !== i && <div className="w-4 h-4 rounded-full border border-slate-200" />}
                                </div>
                                <span className={`text-sm font-bold flex-1 ${r.status === 'ok' ? 'text-emerald-700' : r.status === 'error' ? 'text-red-700' : current === i ? 'text-violet-700' : 'text-slate-500'}`}>
                                    {r.name}
                                </span>
                                {r.status === 'ok' && <span className="text-xs font-bold text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded-full">Listo</span>}
                                {r.status === 'error' && <span className="text-xs text-red-600 truncate max-w-[140px]">{r.error}</span>}
                                {current === i && r.status === 'pending' && <span className="text-xs font-bold text-violet-500 animate-pulse">Generando...</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                    {!running && !done && (
                        <>
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
                            <button onClick={run} className="px-6 py-2.5 rounded-xl font-black bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4" /> Generar {activePatients.length} PAIs con IA
                            </button>
                        </>
                    )}
                    {done && (
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-black bg-slate-800 text-white hover:bg-slate-900 transition-colors">Cerrar</button>
                    )}
                    {running && (
                        <p className="text-sm text-slate-500 font-medium py-2">Procesando... no cierre esta ventana.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MasterPatientDirectory() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [view, setView] = useState<'list' | 'color'>('list');
    const [showBatchPai, setShowBatchPai] = useState(false);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const res = await fetch("/api/corporate/patients");
                const data = await res.json();
                if (data.success) {
                    setPatients(data.patients);
                }
            } catch (error) {
                console.error("Error fetching master directory:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, []);

    const getLastName = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return parts.length > 1 ? parts[parts.length - 1] : parts[0];
    };

    const filteredPatients = useMemo(() => {
        return patients
            .filter((p) => {
                const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (p.roomNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
                const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => getLastName(a.name).localeCompare(getLastName(b.name), 'es', { sensitivity: 'base' }));
    }, [patients, searchTerm, statusFilter]);

    const getStatusBadge = (status: string, leaveType?: string) => {
        switch (status) {
            case "ACTIVE":
                return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">Activo</span>;
            case "TEMPORARY_LEAVE":
                return <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"><ExclamationTriangleIcon className="w-3 h-3" /> Ausente ({leaveType === 'HOSPITAL' ? 'Hospital' : 'Familia'})</span>;
            case "DISCHARGED":
            case "DECEASED":
                return <span className="bg-slate-100 text-slate-500 border border-slate-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">Dado de Baja</span>;
            default:
                return <span className="bg-slate-100 text-slate-500 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">{status}</span>;
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center p-20 font-bold text-slate-500 animate-pulse text-xl">Sincronizando Directorio de Residentes...</div>;
    }

    return (
        <>
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                            <BuildingOffice2Icon className="w-10 h-10 text-indigo-600" />
                            Directorio Global
                        </h1>
                        <p className="text-slate-500 font-medium mt-2 text-lg max-w-2xl">
                            Censo Maestro de Residentes. Búsqueda centralizada de expedientes activos, ausencias temporales y archivos históricos (bajas definitivas).
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                        <div className="px-4 py-2 text-center border-r border-slate-100">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Activos</p>
                            <p className="text-2xl font-black text-emerald-600">{patients.filter(p => p.status === 'ACTIVE').length}</p>
                        </div>
                        <div className="px-4 py-2 text-center border-r border-slate-100">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hospital</p>
                            <p className="text-2xl font-black text-amber-500">{patients.filter(p => p.status === 'TEMPORARY_LEAVE').length}</p>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bajas</p>
                            <p className="text-2xl font-black text-slate-500">{patients.filter(p => p.status === 'DISCHARGED' || p.status === 'DECEASED').length}</p>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">

                    <div className="flex gap-3 w-full md:w-auto">
                        <SendFamilyEmailModal defaultMode="BROADCAST" />
                        <button
                            onClick={() => setShowBatchPai(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl transition-colors whitespace-nowrap"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            Generar PAIs con IA
                        </button>
                    </div>

                    <div className="relative w-full md:w-96">
                        <MagnifyingGlassIcon className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar residente por nombre o habitación..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto">
                        <button onClick={() => setStatusFilter('ALL')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'ALL' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Todos</button>
                        <button onClick={() => setStatusFilter('ACTIVE')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'ACTIVE' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>Activos</button>
                        <button onClick={() => setStatusFilter('TEMPORARY_LEAVE')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'TEMPORARY_LEAVE' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}>Ausentes / Hospital</button>
                        <button onClick={() => setStatusFilter('DISCHARGED')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${statusFilter === 'DISCHARGED' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>Residentes dados de baja</button>
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-xl">
                        <button onClick={() => setView('list')} title="Vista lista" className={`px-3 py-2 rounded-lg transition-colors ${view === 'list' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <button onClick={() => setView('color')} title="Vista por grupo de color" className={`px-3 py-2 rounded-lg transition-colors ${view === 'color' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><circle cx="6" cy="6" r="3.5" className="fill-red-500" /><circle cx="14" cy="6" r="3.5" className="fill-yellow-400" /><circle cx="6" cy="14" r="3.5" className="fill-green-500" /><circle cx="14" cy="14" r="3.5" className="fill-blue-500" /></svg>
                        </button>
                    </div>
                </div>

                {/* Patient Directory — List or Color View */}
                {view === 'list' ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-200">
                                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Residente</th>
                                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest hidden md:table-cell">Habitacion</th>
                                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Estatus</th>
                                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Accion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPatients.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                No se encontraron residentes con esos criterios.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPatients.map((patient) => (
                                            <tr key={patient.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex flex-shrink-0 items-center justify-center font-black overflow-hidden relative ${patient.status === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : patient.status === 'TEMPORARY_LEAVE' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            {patient.photoUrl ? (
                                                                <img src={patient.photoUrl} alt={patient.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <UserIcon className="w-6 h-6" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-800 text-base">{patient.name}</p>
                                                            <p className="text-sm font-medium text-slate-500 hidden md:block group-hover:text-indigo-600 transition-colors">ID: {patient.id.split('-')[0].toUpperCase()}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 hidden md:table-cell">
                                                    <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                                                        {patient.roomNumber}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {getStatusBadge(patient.status, patient.leaveType)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link
                                                        href={`/corporate/medical/patients/${patient.id}`}
                                                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group-hover:scale-110"
                                                    >
                                                        <ArrowRightIcon className="w-5 h-5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {[
                            { key: 'RED', label: 'Rojo', bg: 'bg-red-500', border: 'border-red-200' },
                            { key: 'YELLOW', label: 'Amarillo', bg: 'bg-yellow-400', border: 'border-yellow-200' },
                            { key: 'GREEN', label: 'Verde', bg: 'bg-green-500', border: 'border-green-200' },
                            { key: 'BLUE', label: 'Azul', bg: 'bg-blue-500', border: 'border-blue-200' },
                            { key: 'UNASSIGNED', label: 'Sin Asignar', bg: 'bg-slate-400', border: 'border-slate-200' },
                        ].map(group => {
                            const groupPatients = filteredPatients.filter(p => (p.colorGroup || 'UNASSIGNED') === group.key);
                            if (groupPatients.length === 0) return null;
                            return (
                                <div key={group.key} className={`bg-white rounded-2xl shadow-sm border ${group.border} overflow-hidden`}>
                                    <div className={`${group.bg} px-6 py-3 flex items-center justify-between`}>
                                        <h3 className="text-white font-black text-sm uppercase tracking-widest">{group.label}</h3>
                                        <span className="text-white/80 text-xs font-bold">{groupPatients.length} residente{groupPatients.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
                                        {groupPatients.map(patient => (
                                            <Link key={patient.id} href={`/corporate/medical/patients/${patient.id}`} className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors group">
                                                <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ${patient.status === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {patient.photoUrl ? (
                                                        <img src={patient.photoUrl} alt={patient.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <UserIcon className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <p className="font-bold text-slate-800 text-sm text-center leading-tight group-hover:text-indigo-600 transition-colors">{patient.name}</p>
                                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{patient.roomNumber || 'S/N'}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </div>

        {showBatchPai && (
            <BatchPaiModal patients={patients} onClose={() => setShowBatchPai(false)} />
        )}
    </>
    );
}
