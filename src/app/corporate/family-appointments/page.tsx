"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Check, X, Clock, ChevronDown } from "lucide-react";

type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Appointment {
    id: string;
    type: string;
    title: string;
    description?: string;
    requestedDate: string;
    requestedTime: string;
    durationMins: number;
    status: AppStatus;
    rejectedReason?: string;
    patient: { name: string; roomNumber?: string };
    familyMember: { name: string; email: string; relationship?: string };
    approvedBy?: { name: string };
    approvedAt?: string;
}

const TYPE_ICONS: Record<string, string> = {
    VISIT:            '🏠',
    VIDEO_CALL:       '📹',
    PHONE_CALL:       '📞',
    DIRECTOR_MEETING: '👔',
    SPECIAL_OCCASION: '🎉',
};
const TYPE_LABELS: Record<string, string> = {
    VISIT:            'Visita Presencial',
    VIDEO_CALL:       'Videollamada',
    PHONE_CALL:       'Llamada Telefónica',
    DIRECTOR_MEETING: 'Reunión con Director',
    SPECIAL_OCCASION: 'Ocasión Especial',
};

const TABS: { value: AppStatus; label: string; color: string }[] = [
    { value: 'PENDING',  label: 'Pendientes', color: 'text-amber-600' },
    { value: 'APPROVED', label: 'Aprobadas',  color: 'text-emerald-600' },
    { value: 'REJECTED', label: 'Rechazadas', color: 'text-slate-500' },
];

export default function FamilyAppointmentsPage() {
    const [activeTab, setActiveTab] = useState<AppStatus>('PENDING');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    // Modal rechazar
    const [rejectModal, setRejectModal] = useState<{ apptId: string; familyName: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const load = useCallback(async (tab: AppStatus = activeTab) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/corporate/family-appointments?status=${tab}`);
            const data = await res.json();
            if (data.success) setAppointments(data.appointments);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, [activeTab]);

    useEffect(() => { load(activeTab); }, [activeTab]); // eslint-disable-line

    const handleAction = async (id: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/corporate/family-appointments/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, rejectedReason: reason }),
            });
            const data = await res.json();
            if (data.success) {
                setRejectModal(null);
                setRejectReason('');
                await load(activeTab);
            }
        } catch { /* no-op */ }
        finally { setProcessing(null); }
    };

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-teal-500 rounded-2xl flex items-center justify-center shadow-md shadow-teal-200">
                    <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Citas Familiares</h1>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Gestiona las solicitudes de visitas y citas</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
                {TABS.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === tab.value
                                ? 'bg-white shadow-sm text-slate-800'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
                </div>
            ) : appointments.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                    <div className="text-4xl mb-3 opacity-30">📅</div>
                    <p className="font-bold text-slate-600">Sin solicitudes {activeTab === 'PENDING' ? 'pendientes' : activeTab === 'APPROVED' ? 'aprobadas' : 'rechazadas'}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {appointments.map(appt => (
                        <div key={appt.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-5">
                                {/* Top row */}
                                <div className="flex items-start gap-3 mb-3">
                                    <span className="text-2xl flex-shrink-0 mt-0.5">{TYPE_ICONS[appt.type] || '📅'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-extrabold text-slate-800 text-sm">{TYPE_LABELS[appt.type] || appt.type}</span>
                                            {activeTab === 'APPROVED' && (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">✅ Aprobada</span>
                                            )}
                                            {activeTab === 'REJECTED' && (
                                                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black">❌ Rechazada</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 font-semibold mt-0.5 capitalize">{formatDate(appt.requestedDate)}</p>
                                    </div>
                                </div>

                                {/* Details grid */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Familiar</p>
                                        <p className="text-xs font-bold text-slate-700 truncate">{appt.familyMember.name}</p>
                                        {appt.familyMember.relationship && (
                                            <p className="text-[10px] text-slate-400">{appt.familyMember.relationship}</p>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Residente</p>
                                        <p className="text-xs font-bold text-slate-700 truncate">{appt.patient.name}</p>
                                        {appt.patient.roomNumber && (
                                            <p className="text-[10px] text-slate-400">Hab. {appt.patient.roomNumber}</p>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Hora</p>
                                        <p className="text-xs font-bold text-slate-700">{appt.requestedTime}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Duración</p>
                                        <p className="text-xs font-bold text-slate-700">{appt.durationMins} min</p>
                                    </div>
                                </div>

                                {appt.description && (
                                    <div className="bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 mb-3">
                                        <p className="text-[10px] font-black uppercase text-sky-500 mb-0.5">Notas del familiar</p>
                                        <p className="text-xs text-sky-800 font-medium">{appt.description}</p>
                                    </div>
                                )}

                                {appt.rejectedReason && (
                                    <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
                                        <p className="text-[10px] font-black uppercase text-red-400 mb-0.5">Motivo de rechazo</p>
                                        <p className="text-xs text-red-700 font-medium">{appt.rejectedReason}</p>
                                    </div>
                                )}

                                {appt.approvedBy && (
                                    <p className="text-[11px] text-slate-400 mb-3">
                                        {activeTab === 'APPROVED' ? 'Aprobada' : 'Procesada'} por <strong>{appt.approvedBy.name}</strong>
                                        {appt.approvedAt && ` · ${new Date(appt.approvedAt).toLocaleDateString('es-PR', { day: '2-digit', month: 'short' })}`}
                                    </p>
                                )}

                                {/* Acciones solo para PENDING */}
                                {activeTab === 'PENDING' && (
                                    <div className="flex gap-2 pt-3 border-t border-slate-50">
                                        <button
                                            onClick={() => handleAction(appt.id, 'APPROVE')}
                                            disabled={processing === appt.id}
                                            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black rounded-2xl py-3 text-sm transition-all active:scale-95"
                                        >
                                            {processing === appt.id ? (
                                                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                            ) : (
                                                <><Check className="w-4 h-4" /> Aprobar</>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setRejectModal({ apptId: appt.id, familyName: appt.familyMember.name })}
                                            disabled={processing === appt.id}
                                            className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 text-red-600 font-black rounded-2xl py-3 text-sm transition-all active:scale-95"
                                        >
                                            <X className="w-4 h-4" /> Rechazar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal rechazar */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-in slide-in-from-bottom-4 duration-200 p-6 space-y-4">
                        <div className="flex items-center gap-2.5">
                            <X className="w-5 h-5 text-red-500" />
                            <h3 className="font-extrabold text-slate-800">Rechazar solicitud</h3>
                        </div>
                        <p className="text-sm text-slate-500">
                            Vas a rechazar la solicitud de <strong>{rejectModal.familyName}</strong>.
                            Puedes incluir un motivo (opcional).
                        </p>
                        <textarea
                            rows={3}
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Motivo del rechazo (opcional)…"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal resize-none transition-all"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleAction(rejectModal.apptId, 'REJECT', rejectReason)}
                                disabled={!!processing}
                                className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-black text-sm transition-all active:scale-95"
                            >
                                {processing ? '…' : 'Confirmar rechazo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
