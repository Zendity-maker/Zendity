"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Clock, Send, FileWarning, MessageSquare, AlertTriangle, CheckCircle2, User, Shield, FilePen, XCircle, X } from "lucide-react";
import { SignaturePad } from "@/components/sw-evaluation/SignaturePad";

const SEVERITY_LABELS: Record<string, string> = {
    OBSERVATION: 'Observación', WARNING: 'Amonestación Escrita',
    SUSPENSION: 'Suspensión Temporal', TERMINATION: 'Despido Justificado',
};

const CATEGORY_LABELS: Record<string, string> = {
    PUNCTUALITY: 'Puntualidad', PATIENT_CARE: 'Cuidado del Residente', HYGIENE: 'Desempeño',
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
    // Acuse de recibo — ver el bloque de más abajo.
    const [ackModalOpen, setAckModalOpen] = useState(false);
    const [ackSignature, setAckSignature] = useState<string | null>(null);
    const [refuseModalOpen, setRefuseModalOpen] = useState(false);
    const [refuseReason, setRefuseReason] = useState("");

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

    /**
     * ACUSE DE RECIBO — firmar, o dejar constancia de que no se firma.
     *
     * Los dos endpoints existen desde jul-2026 y estaban bien hechos: validan
     * empleado-propio contra la sesión, sede, estado y write-once. Lo que no
     * existía era una puerta: la única pantalla del producto que los llamaba
     * era /hr/incidents/[id], y AuthContext rebota de /hr a CAREGIVER y NURSE.
     * Todos los avisos y correos traen al empleado aquí, donde no había ni
     * botón de firmar ni de negarse.
     *
     * Lo que eso produjo, medido el 13-sep-2026: la firma del acuse estaba
     * NULA en las 100 observaciones de producción, con 89 en estado firmable y
     * 83 ya aplicadas y 226 puntos descontados sin que nadie firmara nunca.
     */
    const handleAcknowledge = async () => {
        if (!ackSignature) return;
        setSubmitting(true);
        setToast(null);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}/acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureBase64: ackSignature }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (data?.success) {
                setAckModalOpen(false);
                setAckSignature(null);
                setToast({ kind: 'ok', msg: 'Acuse firmado. Queda constancia con tu firma.' });
                await fetchIncident();
            } else {
                setToast({ kind: 'err', msg: data?.error || 'No se pudo firmar el acuse' });
            }
        } catch (e: any) {
            setToast({ kind: 'err', msg: e?.message || 'Error de conexión' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRefuse = async () => {
        setSubmitting(true);
        setToast(null);
        try {
            const res = await fetch(`/api/hr/incidents/${params.id}/refuse-acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: refuseReason.trim() || undefined }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (data?.success) {
                setRefuseModalOpen(false);
                setRefuseReason("");
                setToast({ kind: 'ok', msg: 'Queda constancia de que no firmas. Administración fue notificada.' });
                await fetchIncident();
            } else {
                setToast({ kind: 'err', msg: data?.error || 'No se pudo registrar el rehúso' });
            }
        } catch (e: any) {
            setToast({ kind: 'err', msg: e?.message || 'Error de conexión' });
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

                {/* ─── ACUSE DE RECIBO ──────────────────────────────────────────
                    Acuse = RECIBO, NO acuerdo. La explicación va aparte y es
                    opcional: se puede firmar el recibo y aun así no estar de
                    acuerdo, que es justo lo que la frase de abajo deja por
                    escrito. Write-once en el servidor. */}
                {incident.visibleToEmployee
                    && ['PENDING_EXPLANATION', 'EXPLANATION_RECEIVED', 'APPLIED'].includes(incident.status)
                    && !incident.acknowledgedAt
                    && !incident.acknowledgeRefusedAt && (
                    <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 mb-5 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                            <FilePen className="text-slate-700" size={16} /> Acuse de recibo
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            Confirmo que recibí y se me explicó esta observación. Mi firma indica <strong>recibo, no necesariamente conformidad</strong>.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => { setAckSignature(null); setAckModalOpen(true); }}
                                disabled={submitting}
                                className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
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

                {/* Acuse ya firmado — el empleado ve su propia firma */}
                {incident.acknowledgedAt && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
                        <h3 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="text-teal-600" size={16} /> Acuse de recibo registrado
                        </h3>
                        <p className="text-xs text-slate-500 mb-3">
                            Firmado el {new Date(incident.acknowledgedAt).toLocaleString('es-PR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {incident.acknowledgedSignature && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={incident.acknowledgedSignature}
                                alt="Tu firma de acuse"
                                className="max-h-32 border border-slate-200 rounded-xl bg-white p-2"
                            />
                        )}
                        <p className="text-[11px] text-slate-400 italic mt-3">
                            El acuse indica recibo del documento. No constituye aceptación del contenido.
                        </p>
                    </div>
                )}

                {/* Rehúso registrado */}
                {incident.acknowledgeRefusedAt && (
                    <div className="bg-red-50 rounded-2xl border border-red-200 p-6 mb-5">
                        <h3 className="text-sm font-black text-red-800 mb-2 flex items-center gap-2">
                            <XCircle className="text-red-600" size={16} /> Rehusaste firmar · requiere reunión formal
                        </h3>
                        <p className="text-xs text-red-700 mb-2">
                            Registrado el {new Date(incident.acknowledgeRefusedAt).toLocaleString('es-PR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {incident.acknowledgeRefusedReason && (
                            <div className="bg-white border border-red-100 rounded-xl px-3 py-2">
                                <p className="text-[10px] font-black uppercase text-red-400 mb-0.5">Tu motivo</p>
                                <p className="text-sm text-red-900">{incident.acknowledgeRefusedReason}</p>
                            </div>
                        )}
                    </div>
                )}

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

            {/* MODAL — Firmar el acuse */}
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

            {/* MODAL — Negarse a firmar. Queda constancia y se coordina reunión. */}
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
