"use client";

import { useEffect, useState } from "react";
import { Calendar, X, AlertTriangle } from "lucide-react";

interface PatientOpt {
    id:         string;
    name:       string;
    roomNumber?: string;
}
interface FamilyMemberOpt {
    id:           string;
    name:         string;
    email?:       string;
    relationship?: string;
}

const TYPE_OPTIONS = [
    { value: 'VISIT',            label: 'Visita Presencial', icon: '🏠' },
    { value: 'VIDEO_CALL',       label: 'Videollamada',      icon: '📹' },
    { value: 'PHONE_CALL',       label: 'Llamada',           icon: '📞' },
    { value: 'DIRECTOR_MEETING', label: 'Con Director',      icon: '👔' },
    { value: 'SPECIAL_OCCASION', label: 'Ocasión Especial',  icon: '🎉' },
] as const;

const DURATION_OPTS = [30, 45, 60, 90, 120];

// Convierte "14:30" (input type=time) a "2:30 PM" (formato schema).
function toAmPm(t24: string): string {
    if (!t24 || !/^\d{2}:\d{2}$/.test(t24)) return t24;
    const [hStr, mStr] = t24.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

// Detecta lunes en zona AST (Puerto Rico). El input <type=date> entrega
// 'YYYY-MM-DD' interpretado como medianoche local del navegador, suficiente
// para day-of-week (no hay riesgo de cruzar al día siguiente).
function isMonday(dateStr: string): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T12:00:00');  // medio día evita DST edges
    return d.getDay() === 1;
}

function isOutsideBusinessHours(t24: string): boolean {
    if (!t24 || !/^\d{2}:\d{2}$/.test(t24)) return false;
    const [hStr, mStr] = t24.split(':');
    const totalMin = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    const MIN = 10 * 60;       // 10:00
    const MAX = 18 * 60;       // 18:00 (exclusivo: 6 PM en punto = fuera)
    return totalMin < MIN || totalMin >= MAX;
}

export default function NewAppointmentModal({
    open,
    onClose,
    onCreated,
}: {
    open:      boolean;
    onClose:   () => void;
    onCreated: () => void;
}) {
    const [patients, setPatients]               = useState<PatientOpt[]>([]);
    const [family,   setFamily]                 = useState<FamilyMemberOpt[]>([]);
    const [loadingFamily, setLoadingFamily]     = useState(false);
    const [submitting, setSubmitting]           = useState(false);
    const [error, setError]                     = useState<string | null>(null);
    const [needsOverrideConfirm, setNeedsOverrideConfirm] = useState(false);

    // Form state
    const [patientId, setPatientId]             = useState('');
    const [familyMemberId, setFamilyMemberId]   = useState('');
    const [type, setType]                       = useState<typeof TYPE_OPTIONS[number]['value']>('VISIT');
    const [requestedDate, setRequestedDate]     = useState('');
    const [requestedTime24, setRequestedTime24] = useState('14:00');
    const [durationMins, setDurationMins]       = useState(60);
    const [title, setTitle]                     = useState('');
    const [description, setDescription]         = useState('');

    // Reset al abrir
    useEffect(() => {
        if (!open) return;
        setPatientId(''); setFamilyMemberId(''); setType('VISIT');
        setRequestedDate(''); setRequestedTime24('14:00'); setDurationMins(60);
        setTitle(''); setDescription('');
        setFamily([]); setError(null); setNeedsOverrideConfirm(false);

        // Cargar residentes
        (async () => {
            try {
                const res = await fetch('/api/corporate/patients');
                const data = await res.json();
                if (data.success) setPatients(data.patients);
            } catch { /* no-op */ }
        })();
    }, [open]);

    // Al elegir residente: cargar SUS familiares (filtrados server-side)
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

    const hasOverride = isMonday(requestedDate) || isOutsideBusinessHours(requestedTime24);

    const submit = async (confirmingOverride = false) => {
        setError(null);

        // Validación cliente — mínima, el servidor revalida
        if (!patientId || !familyMemberId || !type || !title.trim() || !requestedDate || !requestedTime24) {
            setError('Completa todos los campos requeridos');
            return;
        }

        // Override gate UI — si toca lunes o fuera de 10-6, pide confirmación.
        // El servidor permite la creación de todas formas; este gate es UX para
        // que Wanda no envíe sin querer fuera del horario regular.
        if (hasOverride && !confirmingOverride) {
            setNeedsOverrideConfirm(true);
            return;
        }
        setNeedsOverrideConfirm(false);
        setSubmitting(true);
        try {
            const res = await fetch('/api/corporate/family-appointments', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    patientId,
                    familyMemberId,
                    type,
                    title:         title.trim(),
                    description:   description.trim() || undefined,
                    requestedDate,
                    requestedTime: toAmPm(requestedTime24),
                    durationMins,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'No se pudo crear la cita');
                return;
            }
            onCreated();
            onClose();
        } catch (e) {
            console.error(e);
            setError('Error al crear la cita');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    // Override confirm sub-modal (encima del form)
    if (needsOverrideConfirm) {
        const reasons: string[] = [];
        if (isMonday(requestedDate)) reasons.push('La fecha cae lunes (día sin visitas regulares)');
        if (isOutsideBusinessHours(requestedTime24)) reasons.push('La hora está fuera del horario de visitas (10 AM - 6 PM)');
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h3 className="font-extrabold text-slate-800">Fuera del horario regular</h3>
                    </div>
                    <ul className="space-y-1.5">
                        {reasons.map(r => (
                            <li key={r} className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{r}</li>
                        ))}
                    </ul>
                    <p className="text-sm text-slate-600">¿Confirmas la excepción? La cita se creará igual y aparecerá en el calendario.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setNeedsOverrideConfirm(false)}
                            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                        >
                            Volver
                        </button>
                        <button
                            onClick={() => submit(true)}
                            className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm"
                        >
                            Confirmar excepción
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Calendar className="w-5 h-5 text-teal-600" />
                        <h3 className="font-extrabold text-slate-800">Nueva cita familiar</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Residente */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Residente</label>
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
                            <option key={f.id} value={f.id}>{f.name}{f.relationship ? ` (${f.relationship})` : ''}</option>
                        ))}
                    </select>
                </div>

                {/* Tipo */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Tipo</label>
                    <div className="grid grid-cols-5 gap-1.5">
                        {TYPE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setType(opt.value)}
                                className={`rounded-xl py-2 text-center transition-all ${
                                    type === opt.value
                                        ? 'bg-teal-500 text-white shadow-sm'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <div className="text-base leading-none">{opt.icon}</div>
                                <div className="text-[9px] font-black uppercase mt-1 truncate px-1">{opt.label.split(' ')[0]}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fecha + Hora */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Fecha</label>
                        <input
                            type="date"
                            value={requestedDate}
                            onChange={e => setRequestedDate(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Hora</label>
                        <input
                            type="time"
                            value={requestedTime24}
                            onChange={e => setRequestedTime24(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                        />
                    </div>
                </div>

                {/* Duración */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Duración</label>
                    <select
                        value={durationMins}
                        onChange={e => setDurationMins(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                    >
                        {DURATION_OPTS.map(d => <option key={d} value={d}>{d} minutos</option>)}
                    </select>
                </div>

                {/* Título */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Título</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ej. Visita semanal de Carmen"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                    />
                </div>

                {/* Descripción */}
                <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Notas <span className="text-slate-400">(opcional)</span></label>
                    <textarea
                        rows={2}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Detalles adicionales…"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal resize-none focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50"
                    />
                </div>

                {/* Indicador discreto del override (info, no bloqueo) */}
                {hasOverride && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                            Fuera del horario regular. Al confirmar te pediré aprobar la excepción.
                        </p>
                    </div>
                )}

                {/* Error servidor */}
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
                        onClick={() => submit(false)}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-2xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-black text-sm transition-all active:scale-95"
                    >
                        {submitting ? '…' : 'Crear cita'}
                    </button>
                </div>
            </div>
        </div>
    );
}
