"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Plus, X, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

type AppointmentType = 'VISIT' | 'VIDEO_CALL' | 'PHONE_CALL' | 'DIRECTOR_MEETING' | 'SPECIAL_OCCASION';
type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Appointment {
    id: string;
    type: AppointmentType;
    title: string;
    description?: string;
    requestedDate: string;
    requestedTime: string;
    durationMins: number;
    status: AppStatus;
    rejectedReason?: string;
    approvedAt?: string;
    patient: { name: string; roomNumber?: string };
    approvedBy?: { name: string };
}

const TYPE_OPTIONS: { value: AppointmentType; label: string; icon: string }[] = [
    { value: 'VISIT',            label: 'Visita Presencial',    icon: '🏠' },
    { value: 'VIDEO_CALL',       label: 'Videollamada',         icon: '📹' },
    { value: 'PHONE_CALL',       label: 'Llamada Telefónica',   icon: '📞' },
    { value: 'DIRECTOR_MEETING', label: 'Reunión con Director', icon: '👔' },
    { value: 'SPECIAL_OCCASION', label: 'Ocasión Especial',     icon: '🎉' },
];

const DURATION_OPTIONS = [
    { value: 30,  label: '30 min' },
    { value: 60,  label: '1 hora' },
    { value: 120, label: '2 horas' },
];

// Genera slots de 30 min entre 10:00 AM y 5:30 PM
function generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let h = 10; h < 18; h++) {
        for (const m of [0, 30]) {
            if (h === 17 && m === 30) break; // last valid start for 30min appt
            const period = h < 12 ? 'AM' : 'PM';
            const displayH = h > 12 ? h - 12 : h;
            slots.push(`${displayH}:${m === 0 ? '00' : '30'} ${period}`);
        }
    }
    return slots;
}

// Genera los próximos 30 días (excluyendo lunes)
function generateAvailableDates(): Date[] {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() !== 1) dates.push(d); // excluir lunes
    }
    return dates;
}

const STATUS_STYLES: Record<AppStatus, string> = {
    PENDING:  'bg-amber-50  border-amber-200  text-amber-700',
    APPROVED: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    REJECTED: 'bg-red-50    border-red-200    text-red-700',
};
const STATUS_ICONS: Record<AppStatus, string> = {
    PENDING:  '⏳',
    APPROVED: '✅',
    REJECTED: '❌',
};
const STATUS_LABELS: Record<AppStatus, string> = {
    PENDING:  'Pendiente',
    APPROVED: 'Aprobada',
    REJECTED: 'No aprobada',
};

const TIME_SLOTS = generateTimeSlots();
const AVAILABLE_DATES = generateAvailableDates();

export default function FamilyCalendarPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    // Form state
    const [type, setType] = useState<AppointmentType>('VISIT');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState('');
    const [duration, setDuration] = useState(60);
    const [description, setDescription] = useState('');
    const [sending, setSending] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState(false);

    // Calendar nav
    const [calMonth, setCalMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });

    const loadAppointments = async () => {
        try {
            const res = await fetch('/api/family/appointments');
            const data = await res.json();
            if (data.success) setAppointments(data.appointments);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    };

    useEffect(() => { loadAppointments(); }, []);

    const openModal = () => {
        setType('VISIT');
        setSelectedDate(null);
        setSelectedTime('');
        setDuration(60);
        setDescription('');
        setFormError(null);
        setFormSuccess(false);
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!selectedDate || !selectedTime) {
            setFormError('Selecciona fecha y hora.');
            return;
        }
        setSending(true);
        try {
            const typeOption = TYPE_OPTIONS.find(t => t.value === type)!;
            const res = await fetch('/api/family/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    title:         `${typeOption.icon} ${typeOption.label}`,
                    description:   description.trim() || null,
                    requestedDate: selectedDate.toISOString(),
                    requestedTime: selectedTime,
                    durationMins:  duration,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setFormSuccess(true);
                await loadAppointments();
                setTimeout(() => setModalOpen(false), 1800);
            } else {
                setFormError(data.error || 'Error al enviar la solicitud');
            }
        } catch {
            setFormError('Error de conexión. Intenta nuevamente.');
        } finally {
            setSending(false);
        }
    };

    // Calendar helpers
    const prevMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const nextMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const calDays = (() => {
        const year  = calMonth.getFullYear();
        const month = calMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);
        const maxDate = new Date(today); maxDate.setDate(today.getDate() + 30);
        const cells: Array<{ date: Date | null; available: boolean; selected: boolean }> = [];
        for (let i = 0; i < firstDay; i++) cells.push({ date: null, available: false, selected: false });
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isMonday = date.getDay() === 1;
            const isPast   = date <= today;
            const isFuture = date > maxDate;
            const available = !isMonday && !isPast && !isFuture;
            const sel = selectedDate ? date.toDateString() === selectedDate.toDateString() : false;
            cells.push({ date, available, selected: sel });
        }
        return cells;
    })();

    const pending  = appointments.filter(a => a.status === 'PENDING');
    const approved = appointments.filter(a => a.status === 'APPROVED' && new Date(a.requestedDate) >= new Date());
    const history  = appointments.filter(a => a.status === 'REJECTED' || (a.status === 'APPROVED' && new Date(a.requestedDate) < new Date()));

    const typeLabel = (a: Appointment) => TYPE_OPTIONS.find(t => t.value === a.type);

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-teal-500 rounded-2xl flex items-center justify-center shadow-md shadow-teal-200">
                        <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Calendario y Citas</h1>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">Gestiona tus visitas y solicitudes</p>
                    </div>
                </div>
                <button
                    onClick={openModal}
                    className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-black rounded-2xl px-4 py-3 text-sm shadow-md shadow-teal-200 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    Solicitar Cita
                </button>
            </div>

            {/* Pendientes */}
            {pending.length > 0 && (
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-2">
                        <span>⏳</span> Solicitudes Pendientes ({pending.length})
                    </h2>
                    <div className="space-y-3">
                        {pending.map(a => (
                            <AppointmentCard key={a.id} appt={a} typeLabel={typeLabel(a)} />
                        ))}
                    </div>
                </section>
            )}

            {/* Aprobadas próximas */}
            {approved.length > 0 && (
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2">
                        <span>✅</span> Citas Aprobadas Próximas ({approved.length})
                    </h2>
                    <div className="space-y-3">
                        {approved.map(a => (
                            <AppointmentCard key={a.id} appt={a} typeLabel={typeLabel(a)} />
                        ))}
                    </div>
                </section>
            )}

            {/* Vacío */}
            {!loading && pending.length === 0 && approved.length === 0 && history.length === 0 && (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                    <div className="text-5xl mb-4 opacity-30">📅</div>
                    <p className="font-bold text-slate-700">Sin solicitudes aún</p>
                    <p className="text-sm text-slate-400 mt-1">Presiona "Solicitar Cita" para coordinar tu primera visita.</p>
                </div>
            )}

            {/* Historial */}
            {history.length > 0 && (
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Historial</h2>
                    <div className="space-y-3">
                        {history.map(a => (
                            <AppointmentCard key={a.id} appt={a} typeLabel={typeLabel(a)} />
                        ))}
                    </div>
                </section>
            )}

            {/* Modal solicitar cita */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 duration-300">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
                            <div className="flex items-center gap-2.5">
                                <Calendar className="w-5 h-5 text-teal-600" />
                                <h2 className="font-extrabold text-slate-800 text-base">Solicitar Cita</h2>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {formSuccess ? (
                            <div className="p-8 flex flex-col items-center text-center">
                                <CheckCircle2 className="w-16 h-16 text-teal-500 mb-4" />
                                <h3 className="font-extrabold text-slate-800 text-lg">¡Solicitud enviada!</h3>
                                <p className="text-slate-500 text-sm mt-2">El equipo revisará tu solicitud en 24-48 horas.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-5 space-y-5">

                                {formError && (
                                    <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        <p className="text-sm text-red-700 font-semibold">{formError}</p>
                                    </div>
                                )}

                                {/* Tipo de cita */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Tipo de cita</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {TYPE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setType(opt.value)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                                                    type === opt.value
                                                        ? 'border-teal-400 bg-teal-50 text-teal-800'
                                                        : 'border-slate-100 hover:border-slate-200 text-slate-700'
                                                }`}
                                            >
                                                <span className="text-xl">{opt.icon}</span>
                                                <span className="font-semibold text-sm">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Calendario */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                        Fecha <span className="font-normal normal-case text-slate-400">(lunes no disponibles)</span>
                                    </label>
                                    {/* Month nav */}
                                    <div className="flex items-center justify-between mb-2">
                                        <button type="button" onClick={prevMonth} className="p-1.5 rounded-xl hover:bg-slate-100">
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-sm font-bold text-slate-700 capitalize">
                                            {calMonth.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button type="button" onClick={nextMonth} className="p-1.5 rounded-xl hover:bg-slate-100">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {/* Day headers */}
                                    <div className="grid grid-cols-7 mb-1">
                                        {['D','L','M','M','J','V','S'].map((d, i) => (
                                            <div key={i} className={`text-center text-[10px] font-black py-1 ${i === 1 ? 'text-slate-300' : 'text-slate-400'}`}>{d}</div>
                                        ))}
                                    </div>
                                    {/* Days grid */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {calDays.map((cell, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                disabled={!cell.date || !cell.available}
                                                onClick={() => cell.date && cell.available && setSelectedDate(cell.date)}
                                                className={`aspect-square rounded-xl text-sm font-bold transition-all ${
                                                    !cell.date
                                                        ? 'invisible'
                                                        : cell.selected
                                                            ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                                                            : cell.available
                                                                ? 'hover:bg-teal-50 hover:text-teal-700 text-slate-700'
                                                                : 'text-slate-200 cursor-not-allowed'
                                                }`}
                                            >
                                                {cell.date?.getDate()}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedDate && (
                                        <p className="text-xs text-teal-600 font-bold mt-2 text-center">
                                            {selectedDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                        </p>
                                    )}
                                </div>

                                {/* Hora */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Hora</label>
                                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                                        {TIME_SLOTS.map(slot => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => setSelectedTime(slot)}
                                                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                    selectedTime === slot
                                                        ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                                }`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Duración */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Duración</label>
                                    <div className="flex gap-2">
                                        {DURATION_OPTIONS.map(d => (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => setDuration(d.value)}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                                    duration === d.value
                                                        ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Descripción */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                        Notas <span className="font-normal normal-case text-slate-400">(opcional)</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Motivo o notas especiales…"
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-50 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal resize-none"
                                    />
                                </div>

                                {/* Nota informativa */}
                                <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
                                    <Clock className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-sky-700 font-medium leading-relaxed">
                                        Las solicitudes son revisadas en <strong>24-48 horas</strong> por el equipo. Recibirás una confirmación por correo y en el portal.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={sending || !selectedDate || !selectedTime}
                                    className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl py-4 transition-all active:scale-[.98] shadow-md shadow-teal-200 text-sm uppercase tracking-wider"
                                >
                                    {sending ? (
                                        <>
                                            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                            Enviando…
                                        </>
                                    ) : 'Enviar Solicitud'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function AppointmentCard({ appt, typeLabel }: { appt: Appointment; typeLabel?: { icon: string; label: string } }) {
    const formattedDate = new Date(appt.requestedDate).toLocaleDateString('es-PR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });

    return (
        <div className={`border rounded-2xl p-4 ${STATUS_STYLES[appt.status]}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{typeLabel?.icon || '📅'}</span>
                        <span className="font-bold text-sm truncate">{typeLabel?.label || appt.type}</span>
                        <span className={`ml-auto text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[appt.status]}`}>
                            {STATUS_ICONS[appt.status]} {STATUS_LABELS[appt.status]}
                        </span>
                    </div>
                    <p className="text-xs font-semibold capitalize">{formattedDate} · {appt.requestedTime}</p>
                    <p className="text-[11px] mt-0.5 opacity-70">Duración: {appt.durationMins} min · {appt.patient.name}</p>
                    {appt.description && (
                        <p className="text-xs mt-1.5 italic opacity-80">{appt.description}</p>
                    )}
                    {appt.status === 'REJECTED' && appt.rejectedReason && (
                        <p className="text-xs mt-2 bg-red-100 rounded-xl px-3 py-1.5 font-medium">{appt.rejectedReason}</p>
                    )}
                    {appt.status === 'APPROVED' && appt.approvedBy && (
                        <p className="text-[11px] mt-1.5 opacity-60">Aprobada por {appt.approvedBy.name}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
