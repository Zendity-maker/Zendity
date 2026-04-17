"use client";

import { useState, useEffect, useCallback } from "react";
import { PhotoIcon, CheckCircleIcon, DocumentCheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";

interface UlcerLog {
    id: string;
    notes: string;
    woundSize: string | null;
    treatmentApplied: string;
    createdAt: string;
    hasPhoto: boolean;
    nurse: { name: string; role: string } | null;
}

interface Ulcer {
    id: string;
    stage: number;
    bodyLocation: string;
    status: string;
    identifiedAt: string;
    resolvedAt: string | null;
    logs: UlcerLog[];
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' });

const stageColor = (stage: number) => {
    switch (stage) {
        case 1: return 'bg-yellow-50 border-yellow-200';
        case 2: return 'bg-orange-50 border-orange-200';
        case 3: return 'bg-red-50 border-red-200';
        case 4: return 'bg-rose-50 border-rose-300';
        default: return 'bg-slate-50 border-slate-200';
    }
};

const stageBadge = (stage: number) => {
    switch (stage) {
        case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 2: return 'bg-orange-100 text-orange-800 border-orange-300';
        case 3: return 'bg-red-100 text-red-800 border-red-300';
        case 4: return 'bg-rose-100 text-rose-900 border-rose-400';
        default: return 'bg-slate-100 text-slate-600';
    }
};

export default function PatientUlcersTab({ patientId }: { patientId?: string }) {
    const [ulcers, setUlcers] = useState<Ulcer[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUlcers = useCallback(async () => {
        if (!patientId) { setLoading(false); return; }
        try {
            const res = await fetch(`/api/care/upp?patientId=${patientId}`);
            const data = await res.json();
            if (data.success) setUlcers(data.ulcers);
        } catch (e) {
            console.error('[UPP tab fetch]', e);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => { fetchUlcers(); }, [fetchUlcers]);

    const activeUlcers = ulcers.filter(u => u.status === 'ACTIVE' || u.status === 'HEALING');
    const resolvedUlcers = ulcers.filter(u => u.status === 'RESOLVED');

    if (loading) {
        return (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-400 mt-3">Cargando bitácora de UPPs...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Cabecera */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Integridad Cutánea y Curaciones</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                        {activeUlcers.length > 0
                            ? `${activeUlcers.length} úlcera(s) activa(s) · Bitácora oficial`
                            : 'Expediente dermatológico sin úlceras activas'}
                    </p>
                </div>
                <a
                    href="/corporate/medical/upp-dashboard"
                    className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl transition-colors text-center"
                >
                    Abrir tablero de UPPs
                </a>
            </div>

            {ulcers.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                        <CheckCircleIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Sin Úlceras Registradas</h3>
                    <p className="text-slate-500 font-medium max-w-sm mt-2">
                        El expediente dermatológico de este residente está limpio.
                    </p>
                </div>
            ) : (
                <>
                    {/* Úlceras Activas */}
                    {activeUlcers.map(ulcer => (
                        <div key={ulcer.id} className={`border-2 rounded-2xl p-5 ${stageColor(ulcer.stage)}`}>
                            <div className="flex items-start gap-4 mb-4">
                                <div className="bg-white p-3 rounded-xl border border-rose-100 shrink-0">
                                    <ExclamationTriangleIcon className="w-7 h-7 text-rose-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h4 className="font-bold text-slate-900 text-lg leading-tight">{ulcer.bodyLocation}</h4>
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${stageBadge(ulcer.stage)}`}>
                                            Stadio {ulcer.stage}
                                        </span>
                                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                                            {ulcer.status === 'ACTIVE' ? 'Activa' : 'Cicatrizando'}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 text-sm font-medium">
                                        Identificada el {formatDate(ulcer.identifiedAt)} · {ulcer.logs.length} registro(s) de curación
                                    </p>
                                </div>
                            </div>

                            {/* Timeline de logs */}
                            {ulcer.logs.length > 0 && (
                                <div className="pl-4 mt-5">
                                    <h5 className="font-semibold text-slate-600 mb-4 flex gap-2 items-center text-xs uppercase tracking-widest">
                                        <DocumentCheckIcon className="w-4 h-4" /> Historial de curación
                                    </h5>
                                    <div className="border-l-2 border-slate-200 ml-2 space-y-4 pb-2">
                                        {ulcer.logs.map(log => (
                                            <div key={log.id} className="relative pl-6">
                                                <div className="absolute -left-[7px] top-2 w-3.5 h-3.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                                                <div className="bg-white border border-neutral-100 p-4 rounded-xl shadow-sm">
                                                    <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                                                        <span className="text-xs font-bold text-slate-500">{formatDate(log.createdAt)}</span>
                                                        {log.hasPhoto && (
                                                            <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg">
                                                                <PhotoIcon className="w-3.5 h-3.5" /> Foto adjunta
                                                            </span>
                                                        )}
                                                    </div>
                                                    {log.woundSize && (
                                                        <p className="text-xs text-slate-600 mb-2">
                                                            <span className="font-bold uppercase tracking-widest">Tamaño:</span> {log.woundSize}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-slate-700 mb-2">
                                                        <span className="font-bold uppercase tracking-widest">Tratamiento:</span> {log.treatmentApplied}
                                                    </p>
                                                    {log.notes && (
                                                        <p className="text-xs text-slate-600 italic">"{log.notes}"</p>
                                                    )}
                                                    {log.nurse && (
                                                        <p className="text-[10px] text-slate-400 font-medium mt-2">
                                                            Enfermero(a): {log.nurse.name} ({log.nurse.role})
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Úlceras Resueltas */}
                    {resolvedUlcers.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                            <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                                <CheckCircleIcon className="w-5 h-5" /> Úlceras Resueltas ({resolvedUlcers.length})
                            </h4>
                            <div className="space-y-2">
                                {resolvedUlcers.map(u => (
                                    <div key={u.id} className="bg-white border border-emerald-100 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                                        <span className="font-bold text-slate-700">{u.bodyLocation} · Stadio {u.stage}</span>
                                        <span className="text-slate-500">Resuelta {u.resolvedAt ? formatDate(u.resolvedAt) : ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
