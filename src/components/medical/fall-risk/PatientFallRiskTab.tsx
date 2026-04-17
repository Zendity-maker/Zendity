"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardDocumentCheckIcon, ExclamationTriangleIcon, MapPinIcon, HeartIcon } from "@heroicons/react/24/outline";
import { Loader2, AlertTriangle, Printer } from "lucide-react";
import FallIncidentPrint from "./FallIncidentPrint";

interface FallIncident {
    id: string;
    patientId: string;
    location: string;
    severity: 'NONE' | 'MILD' | 'SEVERE' | 'FATAL';
    interventions: string;
    notes: string | null;
    incidentDate: string;
    reportedAt: string;
}

interface FallRiskAssessment {
    id: string;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
    morseScore: number | null;
    factors: string | null;
    evaluatedAt: string;
    nextReviewAt: string | null;
    evaluator: { name: string; role: string } | null;
}

interface FallRiskData {
    patient: { id: string; name: string; downtonRisk: boolean };
    fallIncidents: FallIncident[];
    riskAssessments: FallRiskAssessment[];
    currentRiskLevel: 'LOW' | 'MODERATE' | 'HIGH';
}

const SEVERITY_COLOR: Record<string, { bg: string; text: string; badge: string }> = {
    FATAL: { bg: 'bg-rose-50 border-rose-300', text: 'text-rose-800', badge: 'bg-rose-700 text-white' },
    SEVERE: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', badge: 'bg-rose-600 text-white' },
    MILD: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500 text-white' },
    NONE: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', badge: 'bg-slate-400 text-white' },
};

const RISK_COLOR: Record<string, string> = {
    HIGH: 'bg-rose-100 text-rose-700 border-rose-200',
    MODERATE: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function PatientFallRiskTab({ patientId }: { patientId?: string }) {
    const [data, setData] = useState<FallRiskData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [printingFallId, setPrintingFallId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!patientId) { setLoading(false); return; }
        try {
            const res = await fetch(`/api/care/fall-risk?patientId=${patientId}`);
            const json = await res.json();
            if (json.success) setData(json);
            else setError(json.error || 'Error cargando datos');
        } catch (e) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">Cargando historial de caídas...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-rose-700">{error || 'Error cargando datos'}</p>
            </div>
        );
    }

    const { patient, fallIncidents, riskAssessments, currentRiskLevel } = data;
    const lastAssessment = riskAssessments[0];

    return (
        <div className="space-y-6">
            {/* ── Header con badge de riesgo ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <ClipboardDocumentCheckIcon className="w-6 h-6 text-indigo-500" />
                            Historial de Caídas y Riesgo
                        </h2>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            {fallIncidents.length} caída(s) registrada(s) · {riskAssessments.length} evaluación(es) de riesgo
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-xl border-2 font-black text-sm uppercase tracking-wider ${RISK_COLOR[currentRiskLevel]}`}>
                            Riesgo: {currentRiskLevel}
                        </div>
                        {patient.downtonRisk && (
                            <div className="px-4 py-2 rounded-xl border-2 bg-rose-50 text-rose-700 border-rose-200 font-black text-sm uppercase tracking-wider flex items-center gap-1">
                                <HeartIcon className="w-4 h-4" /> Downton +
                            </div>
                        )}
                    </div>
                </div>

                {/* Último assessment */}
                {lastAssessment && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Última evaluación</p>
                            <p className="font-bold text-slate-800">{fmtDateTime(lastAssessment.evaluatedAt)}</p>
                            {lastAssessment.evaluator && (
                                <p className="text-xs text-slate-500">{lastAssessment.evaluator.name} ({lastAssessment.evaluator.role})</p>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Score Morse</p>
                            <p className="font-bold text-slate-800">{lastAssessment.morseScore ?? 'No aplicado'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Factores</p>
                            <p className="text-xs text-slate-700 font-medium leading-tight line-clamp-3">{lastAssessment.factors || '—'}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Timeline de caídas ── */}
            {fallIncidents.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center">
                    <HeartIcon className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <h3 className="text-base font-black text-emerald-800 mb-1">Sin caídas registradas</h3>
                    <p className="text-sm text-emerald-700 font-medium">El residente no tiene caídas documentadas en el sistema.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Timeline de caídas</h3>
                    {fallIncidents.map((fi, idx) => {
                        const style = SEVERITY_COLOR[fi.severity] || SEVERITY_COLOR.MILD;
                        return (
                            <div key={fi.id} className={`border-2 rounded-xl p-4 ${style.bg}`}>
                                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.badge}`}>
                                            <ExclamationTriangleIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className={`font-black ${style.text}`}>Caída #{fallIncidents.length - idx}</h4>
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badge}`}>
                                                    {fi.severity}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 font-medium mt-0.5">
                                                {fmtDateTime(fi.incidentDate)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setPrintingFallId(fi.id)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Imprimir Reporte
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <MapPinIcon className="w-3 h-3" /> Ubicación
                                        </p>
                                        <p className={`font-bold ${style.text}`}>{fi.location}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Evaluación clínica</p>
                                        <p className={`font-medium text-slate-700 text-xs`}>{fi.interventions}</p>
                                    </div>
                                </div>

                                {fi.notes && (
                                    <div className="mt-3 pt-3 border-t border-white/50">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Notas del cuidador</p>
                                        <p className="text-xs text-slate-700 italic leading-relaxed">"{fi.notes}"</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* PDF Incident Report modal */}
            {printingFallId && (
                <FallIncidentPrint
                    fallIncidentId={printingFallId}
                    onClose={() => setPrintingFallId(null)}
                />
            )}
        </div>
    );
}
