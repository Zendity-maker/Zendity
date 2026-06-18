"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, Calendar } from "lucide-react";

export interface ContactLogRow {
    id: string;
    channel: string;
    direction: string;
    purpose: string | null;
    outcome: string | null;
    note: string | null;
    durationMin: number | null;
    coordinatedAppointment: boolean;
    contactedAt: string;
    patient:      { id: string; name: string; roomNumber: string | null };
    familyMember: { id: string; name: string; phone: string | null; relationship: string | null };
    loggedBy:     { id: string; name: string };
}

const CHANNEL_LABEL: Record<string, { label: string; icon: string }> = {
    PHONE:     { label: 'Llamada',    icon: '📞' },
    VIDEO:     { label: 'Video',      icon: '📹' },
    IN_PERSON: { label: 'Presencial', icon: '🏠' },
    WHATSAPP:  { label: 'WhatsApp',   icon: '💬' },
    OTHER:     { label: 'Otro',       icon: '•' },
};
const OUTCOME_LABEL: Record<string, string> = {
    SPOKE:        'Habló',
    VOICEMAIL:    'Buzón de voz',
    NO_ANSWER:    'No contestó',
    WRONG_NUMBER: 'Número equivocado',
};

function formatDateTime(s: string) {
    const d = new Date(s);
    return d.toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ContactLogList({
    patientId,
    refreshKey,
    showResidentColumn = true,
}: {
    patientId?:           string;
    refreshKey?:          number;
    showResidentColumn?:  boolean;
}) {
    const [logs, setLogs] = useState<ContactLogRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
            const res = await fetch(`/api/corporate/family-contact-logs${qs}`);
            const data = await res.json();
            if (data.success) setLogs(data.logs);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, [patientId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                <Phone className="w-8 h-8 mx-auto text-slate-300 mb-3" />
                <p className="font-bold text-slate-600">Sin contactos registrados</p>
                <p className="text-xs text-slate-400 mt-1">Cuando registres una llamada, aparecerá aquí.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {logs.map(l => {
                const ch = CHANNEL_LABEL[l.channel] || { label: l.channel, icon: '•' };
                return (
                    <div key={l.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-xl flex-shrink-0 mt-0.5">{ch.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className="font-extrabold text-slate-800">{ch.label}</span>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-slate-500 font-medium">
                                        {l.direction === 'OUTBOUND' ? 'Yo llamé' : 'Me llamaron'}
                                    </span>
                                    {l.outcome && (
                                        <>
                                            <span className="text-slate-400">·</span>
                                            <span className="text-slate-500 font-medium">{OUTCOME_LABEL[l.outcome] || l.outcome}</span>
                                        </>
                                    )}
                                    {l.coordinatedAppointment && (
                                        <span className="ml-1 bg-teal-50 border border-teal-100 text-teal-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                                            Coordinó cita
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                    {showResidentColumn && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400">Residente</p>
                                            <p className="font-bold text-slate-700 truncate">{l.patient.name}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Familiar</p>
                                        <p className="font-bold text-slate-700 truncate">
                                            {l.familyMember.name}
                                            {l.familyMember.relationship ? <span className="text-slate-400 font-normal"> ({l.familyMember.relationship})</span> : null}
                                        </p>
                                    </div>
                                </div>

                                {l.note && (
                                    <div className="mt-3 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
                                        <p className="text-[10px] font-black uppercase text-sky-500">Nota</p>
                                        <p className="text-xs text-sky-900 font-medium whitespace-pre-wrap">{l.note}</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400">
                                    <Calendar className="w-3 h-3" />
                                    <span>{formatDateTime(l.contactedAt)}</span>
                                    {l.durationMin ? <span>· {l.durationMin} min</span> : null}
                                    <span>·</span>
                                    <span>registrado por {l.loggedBy.name}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
