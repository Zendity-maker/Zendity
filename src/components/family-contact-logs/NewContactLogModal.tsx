"use client";

import { useEffect, useState } from "react";
import { Phone, X } from "lucide-react";

interface PatientOpt      { id: string; name: string; roomNumber?: string; }
interface FamilyMemberOpt { id: string; name: string; phone?: string; relationship?: string; }

const CHANNELS = [
    { value: 'PHONE',     label: 'Llamada',     icon: '📞' },
    { value: 'VIDEO',     label: 'Video',       icon: '📹' },
    { value: 'IN_PERSON', label: 'Presencial',  icon: '🏠' },
    { value: 'WHATSAPP',  label: 'WhatsApp',    icon: '💬' },
    { value: 'OTHER',     label: 'Otro',        icon: '•' },
] as const;

const DIRECTIONS = [
    { value: 'OUTBOUND', label: 'Yo llamé' },
    { value: 'INBOUND',  label: 'Me llamaron' },
] as const;

const PURPOSES = [
    { value: '',           label: 'Sin clasificar' },
    { value: 'UPDATE',     label: 'Actualización' },
    { value: 'PLANNING',   label: 'Planificación' },
    { value: 'COMPLAINT',  label: 'Queja' },
    { value: 'FOLLOWUP',   label: 'Seguimiento' },
    { value: 'OTHER',      label: 'Otro' },
] as const;

const OUTCOMES = [
    { value: '',              label: 'Sin especificar' },
    { value: 'SPOKE',         label: 'Sí hablamos' },
    { value: 'VOICEMAIL',     label: 'Buzón de voz' },
    { value: 'NO_ANSWER',     label: 'No contestó' },
    { value: 'WRONG_NUMBER',  label: 'Número equivocado' },
] as const;

// "YYYY-MM-DDTHH:MM" en hora local del navegador (formato del <input type=datetime-local>)
function nowLocalIso(): string {
    const now = new Date();
    const tz = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tz).toISOString().slice(0, 16);
}

export default function NewContactLogModal({
    open,
    onClose,
    onCreated,
    lockedPatientId, // si viene, el dropdown de residente queda bloqueado (tab del perfil)
}: {
    open:             boolean;
    onClose:          () => void;
    onCreated:        () => void;
    lockedPatientId?: string;
}) {
    const [patients, setPatients]           = useState<PatientOpt[]>([]);
    const [family, setFamily]               = useState<FamilyMemberOpt[]>([]);
    const [loadingFamily, setLoadingFamily] = useState(false);
    const [submitting, setSubmitting]       = useState(false);
    const [error, setError]                 = useState<string | null>(null);

    // Form state
    const [patientId, setPatientId]                           = useState('');
    const [familyMemberId, setFamilyMemberId]                 = useState('');
    const [channel, setChannel]                               = useState<typeof CHANNELS[number]['value']>('PHONE');
    const [direction, setDirection]                           = useState<typeof DIRECTIONS[number]['value']>('OUTBOUND');
    const [purpose, setPurpose]                               = useState('');
    const [outcome, setOutcome]                               = useState('');
    const [note, setNote]                                     = useState('');
    const [durationMin, setDurationMin]                       = useState<number | ''>('');
    const [contactedAt, setContactedAt]                       = useState(nowLocalIso());
    const [coordinatedAppointment, setCoordinatedAppointment] = useState(false);

    // Reset al abrir
    useEffect(() => {
        if (!open) return;
        setPatientId(lockedPatientId ?? '');
        setFamilyMemberId('');
        setChannel('PHONE'); setDirection('OUTBOUND');
        setPurpose(''); setOutcome('');
        setNote(''); setDurationMin('');
        setContactedAt(nowLocalIso()); setCoordinatedAppointment(false);
        setFamily([]); setError(null);

        // Solo cargar lista de residentes si no viene lockedPatientId
        if (!lockedPatientId) {
            (async () => {
                try {
                    const res = await fetch('/api/corporate/patients');
                    const data = await res.json();
                    if (data.success) setPatients(data.patients);
                } catch { /* no-op */ }
            })();
        }
    }, [open, lockedPatientId]);

    // Cargar familiares al elegir residente (o al iniciar con lockedPatientId)
    useEffect(() => {
        if (!patientId) { setFamily([]); setFamilyMemberId(''); return; }
        setLoadingFamily(true);
        setFamilyMemberId('');
        (async () => {
            try {
                const res = await fetch(`/api/corporate/patients/${patientId}/family`);
                const data = await res.json();
                if (data.success) setFamily(data.familyMembers || []);
            } catch { /* no-op */ }
            finally { setLoadingFamily(false); }
        })();
    }, [patientId]);

    const submit = async () => {
        setError(null);
        if (!patientId || !familyMemberId || !channel || !direction) {
            setError('Completa los campos requeridos');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/corporate/family-contact-logs', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId,
                    familyMemberId,
                    channel,
                    direction,
                    purpose: purpose || undefined,
                    outcome: outcome || undefined,
                    note: note.trim() || undefined,
                    durationMin: durationMin === '' ? undefined : durationMin,
                    contactedAt: contactedAt ? new Date(contactedAt).toISOString() : undefined,
                    coordinatedAppointment,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'No se pudo registrar el contacto');
                return;
            }
            onCreated();
            onClose();
        } catch {
            setError('Error al registrar el contacto');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Phone className="w-5 h-5 text-teal-600" />
                        <h3 className="font-extrabold text-slate-800">Registrar contacto</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Residente */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Residente</label>
                    {lockedPatientId ? (
                        <div className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-500">
                            (Residente del perfil — bloqueado)
                        </div>
                    ) : (
                        <select
                            value={patientId}
                            onChange={e => setPatientId(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                        >
                            <option value="">Selecciona un residente…</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.name}{p.roomNumber ? ` · Hab. ${p.roomNumber}` : ''}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Familiar */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Familiar</label>
                    <select
                        value={familyMemberId}
                        onChange={e => setFamilyMemberId(e.target.value)}
                        disabled={!patientId || loadingFamily}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50 disabled:opacity-50"
                    >
                        <option value="">
                            {!patientId ? 'Primero elige un residente' : loadingFamily ? 'Cargando…' : family.length === 0 ? 'Sin familiares registrados' : 'Selecciona un familiar…'}
                        </option>
                        {family.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.name}{f.relationship ? ` (${f.relationship})` : ''}{f.phone ? ` · ${f.phone}` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Canal */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Canal</label>
                    <div className="grid grid-cols-5 gap-1.5">
                        {CHANNELS.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setChannel(opt.value)}
                                className={`rounded-xl py-2 text-center transition-all ${
                                    channel === opt.value ? 'bg-teal-500 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <div className="text-base leading-none">{opt.icon}</div>
                                <div className="text-[9px] font-black uppercase mt-1 truncate px-1">{opt.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dirección + Resultado en row */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Dirección</label>
                        <select
                            value={direction}
                            onChange={e => setDirection(e.target.value as 'OUTBOUND' | 'INBOUND')}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                        >
                            {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Resultado</label>
                        <select
                            value={outcome}
                            onChange={e => setOutcome(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                        >
                            {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* Propósito + Duración */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Propósito</label>
                        <select
                            value={purpose}
                            onChange={e => setPurpose(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                        >
                            {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Duración (min)</label>
                        <input
                            type="number" min={0}
                            value={durationMin}
                            onChange={e => setDurationMin(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                            placeholder="opcional"
                        />
                    </div>
                </div>

                {/* Cuándo */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Cuándo fue el contacto</label>
                    <input
                        type="datetime-local"
                        value={contactedAt}
                        onChange={e => setContactedAt(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Default = ahora. Edita si registras un contacto pasado.</p>
                </div>

                {/* Nota (PHI) */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                        Nota <span className="text-slate-400">(opcional)</span>
                    </label>
                    <textarea
                        rows={3}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Resumen breve de la conversación…"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal resize-none focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                    />
                </div>

                {/* Coordinó cita */}
                <label className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100">
                    <input
                        type="checkbox"
                        checked={coordinatedAppointment}
                        onChange={e => setCoordinatedAppointment(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium text-slate-700">En esta conversación se coordinó una cita</span>
                </label>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        <p className="text-xs text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-2xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-black text-sm transition-all active:scale-95"
                    >
                        {submitting ? '…' : 'Registrar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
