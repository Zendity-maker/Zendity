"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Clock, Send, FileWarning, MessageSquare, AlertTriangle, CheckCircle2, User, Shield } from "lucide-react";

const SEVERITY_LABELS: Record<string, string> = {
    OBSERVATION: 'Observación', WARNING: 'Amonestación Escrita',
    SUSPENSION: 'Suspensión Temporal', TERMINATION: 'Despido Justificado',
};

const CATEGORY_LABELS: Record<string, string> = {
    PUNCTUALITY: 'Puntualidad', PATIENT_CARE: 'Cuidado del Residente', HYGIENE: 'Higiene',
    BEHAVIOR: 'Conducta', DOCUMENTATION: 'Documentación', UNIFORM: 'Uniforme', OTHER: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
    PENDING_EXPLANATION: 'Esperando tu explicación',
    EXPLANATION_RECEIVED: 'Respuesta enviada',
    APPLIED: 'Aplicada',
    DISMISSED: 'Desestimada',
    NOTIFIED: 'Notificada',
    CLOSED: 'Cerrada',
};

function hoursRemaining(from: Date, totalHours: number): number {
    const elapsed = (Date.now() - from.getTime()) / (1000 * 60 * 60);
    return Math.max(0, Math.round(totalHours - elapsed));
}

export default function MyObservationDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [incident, setIncident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [response, setResponse] = useState("");
    const [appealText, setAppealText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

    const fetchIncident = async () => {
        if (!params.id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}`);
            const data = await res.json();
            if (data.success) {
                setIncident(data.incident);
            } else {
                setToast({ kind: 'err', msg: data.error || 'No se pudo cargar' });
            }
        } catch (e) {
            console.error('[my-obs detail]', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.replace('/login'); return; }
        fetchIncident();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id, user, authLoading]);

    const isOwnEmployee = !!user && !!incident && incident.employeeId === (user as any).id;

    const handleSubmit = async (type: 'RESPONSE' | 'APPEAL') => {
        const txt = type === 'RESPONSE' ? response.trim() : appealText.trim();
        if (txt.length < 20) {
            setToast({ kind: 'err', msg: 'Mínimo 20 caracteres' });
            return;
        }
        setSubmitting(true);
        setToast(null);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: txt, type }),
            });
            const data = await res.json();
            if (data.success) {
                setToast({ kind: 'ok', msg: type === 'RESPONSE' ? 'Explicación enviada al director' : 'Apelación enviada' });
                setResponse(""); setAppealText("");
                await fetchIncident();
            } else {
                setToast({ kind: 'err', msg: data.error || 'Error' });
            }
        } catch (e: any) {
            setToast({ kind: 'err', msg: e.message || 'Error de conexión' });
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium">Cargando...</div>;
    }
    if (!incident) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <FileWarning className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-black text-slate-700">No pudimos cargar esta observación</p>
                <Link href="/my-observations" className="text-teal-600 text-sm font-bold mt-4 hover:underline">Volver al listado</Link>
            </div>
        );
    }

    if (!isOwnEmployee) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <Shield className="w-12 h-12 text-rose-400 mb-3" />
                <p className="font-black text-slate-700">Esta observación no es tuya</p>
                <Link href="/my-observations" className="text-teal-600 text-sm font-bold mt-4 hover:underline">Ver mis observaciones</Link>
            </div>
        );
    }

    const hoursLeft = incident.status === 'PENDING_EXPLANATION'
        ? hoursRemaining(new Date(incident.createdAt), 48)
        : 0;

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="max-w-3xl mx-auto p-6 md:p-8">
                <Link href="/my-observations" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium mb-6">
                    <ArrowLeft size={16} /> Mis observaciones
                </Link>

                {/* Header */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-5">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-700">
                            {STATUS_LABELS[incident.status] || incident.status}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-700">
                            {SEVERITY_LABELS[incident.severity] || incident.severity}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-teal-50 text-teal-700">
                            {CATEGORY_LABELS[incident.category] || incident.category}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">
                        Registrada el <strong>{new Date(incident.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong> por {incident.supervisor?.name || 'Supervisor'}
                    </p>
                </div>

                {/* Countdown 48h */}
                {incident.status === 'PENDING_EXPLANATION' && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 mb-5 flex items-center gap-3">
                        <Clock className="text-amber-600 shrink-0" size={22} />
                        <div className="text-sm">
                            <strong className="text-amber-900">El director solicita tu explicación.</strong>
                            <span className="text-amber-800 ml-1">Quedan ~{hoursLeft} horas para responder.</span>
                        </div>
                    </div>
                )}

                {/* Description */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Descripción de los hechos</h3>
                    <div className="bg-slate-50 rounded-xl p-4 text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">
                        {incident.description}
                    </div>

                    {incident.directorNote && (
                        <>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mt-6 mb-3 flex items-center gap-2">
                                <Shield size={12} /> Nota del Director
                            </h3>
                            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 text-slate-800 whitespace-pre-wrap text-sm">
                                {incident.directorNote}
                            </div>
                        </>
                    )}

                    {incident.employeeResponse && (
                        <>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mt-6 mb-3 flex items-center gap-2">
                                <User size={12} /> Tu respuesta anterior
                                {incident.respondedAt && (
                                    <span className="text-slate-400 font-normal">· {new Date(incident.respondedAt).toLocaleDateString('es-PR')}</span>
                                )}
                            </h3>
                            <div className="bg-teal-50 border-l-4 border-teal-400 rounded-r-xl p-4 text-slate-800 whitespace-pre-wrap text-sm">
                                {incident.employeeResponse}
                            </div>
                        </>
                    )}

                    {incident.appealText && (
                        <>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mt-6 mb-3 flex items-center gap-2">
                                <AlertTriangle size={12} /> Tu apelación
                                {incident.appealedAt && (
                                    <span className="text-slate-400 font-normal">· {new Date(incident.appealedAt).toLocaleDateString('es-PR')}</span>
                                )}
                            </h3>
                            <div className="bg-orange-50 border-l-4 border-orange-400 rounded-r-xl p-4 text-slate-800 whitespace-pre-wrap text-sm">
                                {incident.appealText}
                            </div>
                        </>
                    )}

                    {incident.status === 'APPLIED' && (
                        <div className="mt-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="text-rose-600 shrink-0" size={18} />
                            <p className="text-sm text-rose-800 font-medium">
                                Observación aplicada. Puntos deducidos: <strong>{incident.pointsDeducted ?? 0}</strong>.
                            </p>
                        </div>
                    )}

                    {incident.status === 'DISMISSED' && (
                        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                            <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
                            <p className="text-sm text-emerald-800 font-medium">
                                Observación desestimada — no afecta tu expediente.
                            </p>
                        </div>
                    )}
                </div>

                {/* Formulario de respuesta */}
                {incident.status === 'PENDING_EXPLANATION' && !incident.employeeResponse && (
                    <div className="bg-white rounded-2xl border-2 border-teal-300 p-6 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                            <MessageSquare className="text-teal-600" size={16} /> Tu explicación
                        </h3>
                        <textarea
                            rows={6}
                            value={response}
                            onChange={e => setResponse(e.target.value)}
                            placeholder="Describe tu versión de los hechos con el mayor detalle posible..."
                            className="w-full border-2 border-slate-200 rounded-xl p-4 focus:outline-none focus:border-teal-500 resize-none bg-slate-50 text-sm"
                            disabled={submitting}
                        />
                        <p className="text-[11px] font-semibold text-slate-500 mt-1.5">
                            Mínimo 20 caracteres ({response.trim().length}/20)
                        </p>
                        <button
                            onClick={() => handleSubmit('RESPONSE')}
                            disabled={submitting || response.trim().length < 20}
                            className="mt-4 w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Send size={16} /> {submitting ? 'Enviando...' : 'Enviar Explicación'}
                        </button>
                    </div>
                )}

                {/* Formulario de apelación */}
                {incident.status === 'APPLIED' && !incident.appealText && (
                    <div className="bg-white rounded-2xl border-2 border-orange-300 p-6 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                            <AlertTriangle className="text-orange-600" size={16} /> Apelar esta decisión
                        </h3>
                        <textarea
                            rows={6}
                            value={appealText}
                            onChange={e => setAppealText(e.target.value)}
                            placeholder="Describe por qué consideras que esta observación no procede..."
                            className="w-full border-2 border-slate-200 rounded-xl p-4 focus:outline-none focus:border-orange-500 resize-none bg-slate-50 text-sm"
                            disabled={submitting}
                        />
                        <p className="text-[11px] font-semibold text-slate-500 mt-1.5">
                            Mínimo 20 caracteres ({appealText.trim().length}/20)
                        </p>
                        <button
                            onClick={() => handleSubmit('APPEAL')}
                            disabled={submitting || appealText.trim().length < 20}
                            className="mt-4 w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Send size={16} /> {submitting ? 'Enviando...' : 'Enviar Apelación'}
                        </button>
                    </div>
                )}

                {toast && (
                    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl font-bold text-sm shadow-lg border ${toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'}`}>
                        {toast.msg}
                    </div>
                )}
            </div>
        </div>
    );
}
