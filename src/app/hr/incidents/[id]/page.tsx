"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
    ArrowLeft, CheckCircle2, XCircle, MessageSquare, Clock,
    AlertTriangle, User, Shield, FileWarning, Send
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Borrador',
    NOTIFIED: 'Notificada',
    PENDING_EXPLANATION: 'Esperando explicación',
    EXPLANATION_RECEIVED: 'Respuesta recibida',
    APPLIED: 'Aplicada',
    DISMISSED: 'Desestimada',
    CLOSED: 'Cerrada',
};
const SEVERITY_LABELS: Record<string, string> = {
    OBSERVATION: 'Observación',
    WARNING: 'Amonestación Escrita',
    SUSPENSION: 'Suspensión Temporal',
    TERMINATION: 'Despido Justificado',
};
const CATEGORY_LABELS: Record<string, string> = {
    PUNCTUALITY: 'Puntualidad',
    PATIENT_CARE: 'Cuidado del Residente',
    HYGIENE: 'Higiene',
    BEHAVIOR: 'Conducta',
    DOCUMENTATION: 'Documentación',
    UNIFORM: 'Uniforme',
    OTHER: 'Otro',
};

const DIRECTOR_ROLES = ['DIRECTOR', 'ADMIN'];
const HR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

function hoursRemaining(from: Date, totalHours: number): number {
    const elapsed = (Date.now() - from.getTime()) / (1000 * 60 * 60);
    return Math.max(0, Math.round(totalHours - elapsed));
}

export default function IncidentDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [incident, setIncident] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [directorNoteDraft, setDirectorNoteDraft] = useState('');
    const [employeeResponse, setEmployeeResponse] = useState('');
    const [appealText, setAppealText] = useState('');

    const isDirector = !!user?.role && DIRECTOR_ROLES.includes(user.role);
    const isHr = !!user?.role && HR_ROLES.includes(user.role);
    const isOwnEmployee = !!user && !!incident && incident.employeeId === user.id;

    const fetchIncident = async () => {
        if (!params.id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}`);
            const data = await res.json();
            if (data.success) {
                setIncident(data.incident);
                setDirectorNoteDraft(data.incident.directorNote || '');
            } else {
                alert(data.error || 'No se pudo cargar');
                router.replace('/hr/incidents');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!user) { router.replace('/login'); return; }
        fetchIncident();
    }, [params.id, user, authLoading]);

    const handleDecide = async (action: 'REQUEST_EXPLANATION' | 'APPLY' | 'DISMISS') => {
        if (!isDirector) return;
        if (action === 'APPLY' && !confirm('¿Confirmas aplicar esta observación? Se deducirán puntos y se enviará email al empleado.')) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}/decide`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, directorNote: directorNoteDraft || undefined })
            });
            const data = await res.json();
            if (data.success) {
                await fetchIncident();
            } else {
                alert(data.error || 'Error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRespond = async (type: 'RESPONSE' | 'APPEAL') => {
        const txt = type === 'RESPONSE' ? employeeResponse : appealText;
        if (!txt || txt.trim().length < 3) return alert('Escribe tu respuesta antes de enviar.');
        setSubmitting(true);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: txt, type })
            });
            const data = await res.json();
            if (data.success) {
                await fetchIncident();
                if (type === 'RESPONSE') setEmployeeResponse('');
                else setAppealText('');
            } else {
                alert(data.error || 'Error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const timeline = useMemo(() => {
        if (!incident) return [];
        const items: Array<{ icon: any; label: string; date: string | null; color: string; description?: string }> = [];
        items.push({
            icon: FileWarning,
            label: 'Observación creada',
            date: incident.createdAt,
            color: 'bg-slate-500',
            description: `Por ${incident.supervisor?.name || 'Supervisor'}`
        });
        if (incident.status === 'PENDING_EXPLANATION' || incident.respondedAt || incident.appliedAt || incident.dismissedAt || incident.visibleToEmployee) {
            items.push({
                icon: Clock,
                label: 'Notificada al empleado',
                date: null,
                color: 'bg-amber-500',
                description: 'Director solicitó explicación (48h)'
            });
        }
        if (incident.respondedAt) {
            items.push({
                icon: MessageSquare,
                label: 'Empleado respondió',
                date: incident.respondedAt,
                color: 'bg-teal-500'
            });
        }
        if (incident.appliedAt) {
            items.push({
                icon: CheckCircle2,
                label: 'Observación aplicada',
                date: incident.appliedAt,
                color: 'bg-rose-500',
                description: incident.pointsDeducted ? `${incident.pointsDeducted} puntos deducidos` : undefined
            });
        }
        if (incident.appealedAt) {
            items.push({
                icon: AlertTriangle,
                label: 'Empleado apeló',
                date: incident.appealedAt,
                color: 'bg-orange-500'
            });
        }
        if (incident.dismissedAt) {
            items.push({
                icon: XCircle,
                label: 'Desestimada',
                date: incident.dismissedAt,
                color: 'bg-emerald-500'
            });
        }
        return items;
    }, [incident]);

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-slate-400">Cargando...</div></div>;
    }
    if (!incident) return null;

    const hoursLeft = incident.status === 'PENDING_EXPLANATION'
        ? hoursRemaining(new Date(incident.createdAt), 48)
        : 0;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto p-6 md:p-8">
                <Link href="/hr/incidents" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium mb-6">
                    <ArrowLeft size={16} /> Volver a observaciones
                </Link>

                {/* Header card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-6">
                    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-700">
                                    {STATUS_LABELS[incident.status] || incident.status}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-rose-50 text-rose-700">
                                    {SEVERITY_LABELS[incident.severity] || incident.severity}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-teal-50 text-teal-700">
                                    {CATEGORY_LABELS[incident.category] || incident.category}
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                {incident.employee?.name}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">
                                {incident.employee?.role} · Score actual: <strong>{incident.employee?.complianceScore ?? '—'}/100</strong>
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-400 uppercase tracking-wide">Creada</div>
                            <div className="text-slate-700 font-bold">
                                {new Date(incident.createdAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">por {incident.supervisor?.name}</div>
                        </div>
                    </div>

                    {/* Countdown 48h */}
                    {incident.status === 'PENDING_EXPLANATION' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                            <Clock className="text-amber-600" size={20} />
                            <div className="text-sm">
                                <strong className="text-amber-800">Esperando respuesta del empleado.</strong>
                                <span className="text-amber-700 ml-1">Quedan ~{hoursLeft} horas para responder.</span>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Descripción</h3>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {incident.description}
                        </div>
                    </div>

                    {/* Director note */}
                    {incident.directorNote && (
                        <div className="mt-6">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nota del Director</h3>
                            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 text-slate-800 whitespace-pre-wrap">
                                {incident.directorNote}
                            </div>
                        </div>
                    )}

                    {/* Employee response */}
                    {incident.employeeResponse && (
                        <div className="mt-6">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                                <User size={14} /> Respuesta del empleado
                                {incident.respondedAt && <span className="text-slate-400 font-normal ml-2">· {new Date(incident.respondedAt).toLocaleDateString('es-PR')}</span>}
                            </h3>
                            <div className="bg-teal-50 border-l-4 border-teal-400 rounded-r-xl p-4 text-slate-800 whitespace-pre-wrap">
                                {incident.employeeResponse}
                            </div>
                        </div>
                    )}

                    {/* Applied info */}
                    {incident.status === 'APPLIED' && (
                        <div className="mt-6 bg-rose-50 border border-rose-200 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="text-rose-600" size={18} />
                                <strong className="text-rose-800">Observación aplicada</strong>
                            </div>
                            <div className="text-sm text-rose-700">
                                Fecha: {incident.appliedAt && new Date(incident.appliedAt).toLocaleDateString('es-PR')}
                                {incident.pointsDeducted != null && (
                                    <span className="ml-3">· Puntos deducidos: <strong>{incident.pointsDeducted}</strong></span>
                                )}
                            </div>
                            {incident.appealText && (
                                <div className="mt-4 bg-white border border-rose-200 rounded-lg p-3">
                                    <div className="text-xs font-bold text-rose-600 uppercase mb-1">Apelación pendiente</div>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{incident.appealText}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Línea de tiempo</h3>
                    <div className="space-y-4">
                        {timeline.map((item, idx) => {
                            const Icon = item.icon;
                            return (
                                <div key={idx} className="flex items-start gap-4">
                                    <div className={`w-9 h-9 rounded-full ${item.color} text-white flex items-center justify-center shrink-0`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="font-bold text-slate-800 text-sm">{item.label}</div>
                                        {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                                        {item.date && <div className="text-xs text-slate-400 mt-0.5">{new Date(item.date).toLocaleString('es-PR')}</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* DIRECTOR ACTIONS — DRAFT or EXPLANATION_RECEIVED */}
                {isDirector && (incident.status === 'DRAFT' || incident.status === 'EXPLANATION_RECEIVED') && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Shield size={16} /> Decisión del Director
                        </h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nota del director (opcional)</label>
                            <textarea
                                rows={3}
                                value={directorNoteDraft}
                                onChange={e => setDirectorNoteDraft(e.target.value)}
                                placeholder="Observaciones internas, contexto de la decisión..."
                                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {incident.status === 'DRAFT' && (
                                <button
                                    onClick={() => handleDecide('REQUEST_EXPLANATION')}
                                    disabled={submitting}
                                    className="py-3 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 font-bold text-sm hover:bg-amber-100 transition-colors disabled:opacity-50"
                                >
                                    Solicitar explicación
                                </button>
                            )}
                            <button
                                onClick={() => handleDecide('APPLY')}
                                disabled={submitting}
                                className="py-3 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20 disabled:opacity-50"
                            >
                                Aplicar observación
                            </button>
                            <button
                                onClick={() => handleDecide('DISMISS')}
                                disabled={submitting}
                                className="py-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                                Desestimar
                            </button>
                        </div>
                    </div>
                )}

                {/* EMPLOYEE RESPONSE (PENDING_EXPLANATION) */}
                {isOwnEmployee && incident.status === 'PENDING_EXPLANATION' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <MessageSquare size={16} /> Tu respuesta
                        </h3>
                        <textarea
                            rows={5}
                            value={employeeResponse}
                            onChange={e => setEmployeeResponse(e.target.value)}
                            placeholder="Explica tu versión de los hechos..."
                            className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-sm mb-3"
                        />
                        <button
                            onClick={() => handleRespond('RESPONSE')}
                            disabled={submitting}
                            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Send size={14} /> Enviar respuesta
                        </button>
                    </div>
                )}

                {/* EMPLOYEE APPEAL (APPLIED) */}
                {isOwnEmployee && incident.status === 'APPLIED' && !incident.appealText && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <AlertTriangle size={16} /> Apelar esta observación
                        </h3>
                        <textarea
                            rows={5}
                            value={appealText}
                            onChange={e => setAppealText(e.target.value)}
                            placeholder="Describe por qué consideras que esta observación no procede..."
                            className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-sm mb-3"
                        />
                        <button
                            onClick={() => handleRespond('APPEAL')}
                            disabled={submitting}
                            className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-700 transition-colors disabled:opacity-50"
                        >
                            <Send size={14} /> Enviar apelación
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
