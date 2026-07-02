"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
    ArrowLeft, CheckCircle2, XCircle, MessageSquare, Clock,
    AlertTriangle, User, Shield, FileWarning, Send, Sparkles, RotateCcw,
    FilePen, X, Printer,
} from 'lucide-react';
import { SignaturePad } from '@/components/sw-evaluation/SignaturePad';
import { generateIncidentReportPDF } from '@/lib/incident-report-pdf';

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
    HYGIENE: 'Desempeño',
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
    const [zendiLoading, setZendiLoading] = useState(false);
    const [employeeResponse, setEmployeeResponse] = useState('');
    const [appealText, setAppealText] = useState('');
    // Sprint incident-employee-acknowledge (jun-2026): acuse de recibo write-once.
    // `ackSignature` guarda la base64 capturada por el SignaturePad dentro del
    // modal hasta que el empleado confirma el envío.
    const [ackModalOpen, setAckModalOpen] = useState(false);
    const [ackSignature, setAckSignature] = useState<string | null>(null);
    // Sprint incident-refuse-signature (jul-2026): rehúso a firmar → reunión formal.
    const [refuseModalOpen, setRefuseModalOpen] = useState(false);
    const [refuseReason, setRefuseReason] = useState('');

    const isDirector = !!user?.role && DIRECTOR_ROLES.includes(user.role);
    const isHr = !!user?.role && HR_ROLES.includes(user.role);
    const isOwnEmployee = !!user && !!incident && incident.employeeId === user.id;

    // Sprint incident-print (jul-2026): descarga PDF de esta observación individual.
    const handlePrint = () => {
        if (!incident) return;
        generateIncidentReportPDF({
            id: incident.id,
            hqName: incident.hq?.name || 'Zéndity',
            createdAt: incident.createdAt,
            type: incident.type,
            severity: incident.severity,
            category: incident.category,
            status: incident.status,
            description: incident.description || '',
            directorNote: incident.directorNote,
            employeeResponse: incident.employeeResponse,
            respondedAt: incident.respondedAt,
            employeeName: incident.employee?.name || 'Empleado',
            employeeRole: incident.employee?.role,
            supervisorName: incident.supervisor?.name,
            supervisorSignature: incident.signatureBase64,
            signedAt: incident.signedAt,
            acknowledgedAt: incident.acknowledgedAt,
            acknowledgedSignature: incident.acknowledgedSignature,
            acknowledgeRefusedAt: incident.acknowledgeRefusedAt,
            acknowledgeRefusedReason: incident.acknowledgeRefusedReason,
        });
    };

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

    // Sprint incident-employee-acknowledge (jun-2026): envía el acuse con la
    // firma capturada en el modal. El endpoint valida estado + write-once +
    // empleado-propio. No cambia status ni toca la firma del supervisor.
    const handleAcknowledge = async () => {
        if (!ackSignature) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}/acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureBase64: ackSignature }),
            });
            const data = await res.json();
            if (data.success) {
                setAckModalOpen(false);
                setAckSignature(null);
                await fetchIncident();
            } else {
                alert(data.error || 'Error al firmar acuse');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Sprint incident-refuse-signature (jul-2026): el empleado se niega a firmar.
    // Registra el rehúso (motivo opcional) → el endpoint notifica a DIRECTOR/ADMIN
    // y queda marcado como "requiere reunión formal". Write-once, excluyente con firmar.
    const handleRefuse = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}/refuse-acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: refuseReason.trim() || undefined }),
            });
            const data = await res.json();
            if (data.success) {
                setRefuseModalOpen(false);
                setRefuseReason('');
                await fetchIncident();
            } else {
                alert(data.error || 'Error al registrar el rehúso');
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
        if (incident.acknowledgedAt) {
            items.push({
                icon: FilePen,
                label: 'Empleado acusó recibo',
                date: incident.acknowledgedAt,
                color: 'bg-slate-700',
                description: 'Firma de recibo (no necesariamente conformidad)'
            });
        }
        if (incident.acknowledgeRefusedAt) {
            items.push({
                icon: XCircle,
                label: 'Empleado rehusó firmar',
                date: incident.acknowledgeRefusedAt,
                color: 'bg-red-600',
                description: 'Requiere reunión formal con administración'
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

    const handleZendiNote = async () => {
        setZendiLoading(true);
        try {
            const res = await fetch('/api/hr/incidents/zendi-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rawNote: directorNoteDraft,
                    severity: incident?.severity,
                    category: incident?.category,
                    employeeName: incident?.employee?.name,
                }),
            });
            const data = await res.json();
            if (data.success && data.note) {
                setDirectorNoteDraft(data.note);
            } else {
                alert('Zendi no pudo generar la nota. Inténtalo de nuevo.');
            }
        } catch {
            alert('Error de conexión con Zendi.');
        }
        setZendiLoading(false);
    };

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
                            {(isHr || isOwnEmployee) && (
                                <button
                                    onClick={handlePrint}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                                >
                                    <Printer size={14} /> Imprimir / PDF
                                </button>
                            )}
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
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nota del director (opcional)</label>
                                <button
                                    type="button"
                                    onClick={handleZendiNote}
                                    disabled={zendiLoading}
                                    className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition disabled:opacity-50"
                                    title="Zendi mejora o redacta la nota profesionalmente"
                                >
                                    {zendiLoading ? (
                                        <span className="w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin inline-block" />
                                    ) : directorNoteDraft.trim() ? (
                                        <><RotateCcw size={12} strokeWidth={2.5} /> Mejorar con Zendi</>
                                    ) : (
                                        <><Sparkles size={12} strokeWidth={2.5} /> Redactar con Zendi</>
                                    )}
                                </button>
                            </div>
                            <textarea
                                rows={4}
                                value={directorNoteDraft}
                                onChange={e => setDirectorNoteDraft(e.target.value)}
                                placeholder="Escribe un borrador o deja vacío y presiona «Redactar con Zendi»..."
                                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-400 outline-none bg-slate-50 text-sm resize-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                Zendi redactará una nota formal y profesional basada en el tipo y categoría de la observación.
                            </p>
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

                {/* ─── ACUSE DE RECIBO DEL EMPLEADO ─────────────────────────────
                    Sprint incident-employee-acknowledge (jun-2026).
                    Acuse = RECIBO, NO acuerdo. La explicación (employeeResponse) es
                    separada y opcional. Write-once: una vez firmado, queda read-only.
                    Visible al empleado-propio cuando el reporte está visible y el
                    status permite acuse. La firma se guarda en acknowledgedSignature
                    (NO en signatureBase64, que es del supervisor). */}
                {isOwnEmployee
                    && incident.visibleToEmployee
                    && (incident.status === 'PENDING_EXPLANATION' || incident.status === 'EXPLANATION_RECEIVED')
                    && !incident.acknowledgedAt
                    && !incident.acknowledgeRefusedAt && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <FilePen size={16} /> Acuse de recibo
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            Confirmo que recibí y se me explicó esta observación. Mi firma indica recibo, no necesariamente conformidad.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => { setAckSignature(null); setAckModalOpen(true); }}
                                disabled={submitting}
                                className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-900 transition-colors disabled:opacity-50"
                            >
                                <FilePen size={14} /> Firmar acuse
                            </button>
                            <button
                                onClick={() => { setRefuseReason(''); setRefuseModalOpen(true); }}
                                disabled={submitting}
                                className="bg-white text-red-700 border border-red-200 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                <XCircle size={14} /> No firmo
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-3">
                            Si no firmas, se notifica a administración y se coordina una reunión formal.
                        </p>
                    </div>
                )}

                {/* Acuse YA firmado — vista read-only visible al empleado y a HR */}
                {incident.acknowledgedAt && (isOwnEmployee || isHr) && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-teal-600" /> Acuse de recibo registrado
                        </h3>
                        <p className="text-xs text-slate-500 mb-3">
                            Firmado el {new Date(incident.acknowledgedAt).toLocaleString('es-PR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {incident.acknowledgedSignature && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={incident.acknowledgedSignature}
                                alt="Firma de acuse del empleado"
                                className="max-h-32 border border-slate-200 rounded-xl bg-white p-2"
                            />
                        )}
                        <p className="text-[11px] text-slate-400 italic mt-3">
                            Acuse indica recibo del documento. No constituye aceptación del contenido.
                        </p>
                    </div>
                )}

                {/* Rehúso a firmar — vista read-only visible al empleado y a HR */}
                {incident.acknowledgeRefusedAt && (isOwnEmployee || isHr) && (
                    <div className="bg-red-50 rounded-2xl border border-red-200 p-6 mb-6">
                        <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <XCircle size={16} className="text-red-600" /> Rehusó firmar · requiere reunión formal
                        </h3>
                        <p className="text-xs text-red-700 mb-2">
                            Registrado el {new Date(incident.acknowledgeRefusedAt).toLocaleString('es-PR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {incident.acknowledgeRefusedReason && (
                            <div className="bg-white border border-red-100 rounded-xl px-3 py-2 mb-2">
                                <p className="text-[10px] font-black uppercase text-red-400 mb-0.5">Motivo del empleado</p>
                                <p className="text-sm text-red-900">{incident.acknowledgeRefusedReason}</p>
                            </div>
                        )}
                        <p className="text-[11px] text-red-500 italic mt-1">
                            El empleado se negó a firmar el acuse. Se notificó a administración para coordinar una reunión formal.
                        </p>
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

            {/* MODAL — Acuse de recibo del empleado.
                Reusa SignaturePad del SW Eval. Mismo patrón: capturar → mostrar
                preview con opción de "Volver a firmar" → confirmar persiste.
                NO maneja modal SignaturePad por sí mismo; aquí va el chrome. */}
            {ackModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <FilePen className="w-5 h-5 text-slate-700" />
                                <h3 className="font-extrabold text-slate-800">Acuse de recibo</h3>
                            </div>
                            <button
                                onClick={() => { setAckModalOpen(false); setAckSignature(null); }}
                                className="p-1 rounded-lg hover:bg-slate-100"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border-l-4 border-slate-400 p-3 rounded-r-lg">
                                Confirmo que recibí y se me explicó esta observación.
                                Mi firma indica recibo, no necesariamente conformidad.
                            </p>

                            {!ackSignature ? (
                                <SignaturePad
                                    onAccept={(b64) => setAckSignature(b64)}
                                    onCancel={() => { setAckModalOpen(false); setAckSignature(null); }}
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <p className="text-sm font-semibold text-slate-700">Firma capturada — confirma para acusar recibo.</p>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={ackSignature}
                                        alt="Firma de acuse capturada"
                                        className="max-h-32 border border-slate-300 rounded-xl bg-white p-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAckSignature(null)}
                                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                                    >
                                        Volver a firmar
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => { setAckModalOpen(false); setAckSignature(null); }}
                                    disabled={submitting}
                                    className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAcknowledge}
                                    disabled={!ackSignature || submitting}
                                    className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black text-sm disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {submitting ? 'Firmando…' : 'Confirmar acuse'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL — Rehúso a firmar (Sprint incident-refuse-signature).
                El empleado confirma que NO firma; motivo opcional. Al confirmar,
                se notifica a administración y queda marcado para reunión formal. */}
            {refuseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <XCircle className="w-5 h-5 text-red-600" />
                                <h3 className="font-extrabold text-slate-800">No firmar el acuse</h3>
                            </div>
                            <button
                                onClick={() => { setRefuseModalOpen(false); setRefuseReason(''); }}
                                className="p-1 rounded-lg hover:bg-slate-100"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-slate-700 leading-relaxed bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg">
                                Estás por dejar constancia de que <strong>no firmas</strong> el acuse.
                                Esto notifica a administración y se coordinará una <strong>reunión formal</strong>.
                                Esta acción no se puede deshacer.
                            </p>
                            <div>
                                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                                    Motivo <span className="text-slate-400">(opcional)</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={refuseReason}
                                    onChange={e => setRefuseReason(e.target.value)}
                                    placeholder="Puedes explicar por qué no firmas…"
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-red-400 outline-none bg-slate-50 text-sm resize-none"
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => { setRefuseModalOpen(false); setRefuseReason(''); }}
                                    disabled={submitting}
                                    className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRefuse}
                                    disabled={submitting}
                                    className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {submitting ? 'Registrando…' : 'Confirmar que no firmo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
