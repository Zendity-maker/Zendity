"use client";

/**
 * /family/calendar — Humanista Suave
 *
 * Cards blancas, fondo cálido neutro, tipografía sans bold, acento brand.
 */

import { useState, useEffect } from "react";
import {
    Calendar,
    X,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Home,
    Video,
    Phone,
    Briefcase,
    PartyPopper,
    Plus,
    CalendarPlus,
} from "lucide-react";
import { IconCitas } from "@/components/icons/ZendityIcons";
import { formatASTDate, AST_TZ_LABEL, astMidnightUTC } from "@/lib/dates";

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

const TYPE_OPTIONS: { value: AppointmentType; label: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
    { value: 'VISIT',            label: 'Visita presencial',     Icon: Home },
    { value: 'VIDEO_CALL',       label: 'Videollamada',          Icon: Video },
    { value: 'PHONE_CALL',       label: 'Llamada telefónica',    Icon: Phone },
    { value: 'DIRECTOR_MEETING', label: 'Reunión con director',  Icon: Briefcase },
    { value: 'SPECIAL_OCCASION', label: 'Ocasión especial',      Icon: PartyPopper },
];

const DURATION_OPTIONS = [
    { value: 30,  label: '30 min' },
    { value: 60,  label: '1 hora' },
    { value: 120, label: '2 horas' },
];

const STATUS_LABELS: Record<AppStatus, string> = {
    PENDING:  'Pendiente',
    APPROVED: 'Aprobada',
    REJECTED: 'No aprobada',
};

// Empty state guía: tipos disponibles (sin SPECIAL_OCCASION)
const EMPTY_GUIDE: { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; desc: string }[] = [
    { Icon: Home,      title: 'Visita presencial',     desc: 'Visita a tu familiar en la residencia' },
    { Icon: Video,     title: 'Videollamada',          desc: 'Conecta por video desde donde estés' },
    { Icon: Phone,     title: 'Llamada telefónica',    desc: 'Habla por teléfono con tu familiar' },
    { Icon: Briefcase, title: 'Reunión con director',  desc: 'Coordina una reunión con el equipo' },
];

function humanTime(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    const hour = d.getHours();

    if (diffMin < 5) return "justo ahora";
    if (diffMin < 60) return `hace ${diffMin} minutos`;

    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        if (hour < 12) return "esta mañana";
        if (hour < 18) return "esta tarde";
        return "esta noche";
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
    if (isYesterday) {
        if (hour < 12) return "ayer en la mañana";
        if (hour < 18) return "ayer en la tarde";
        return "anoche";
    }

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return d.toLocaleDateString("es-PR", { weekday: "long" });
    return d.toLocaleDateString("es-PR", { day: "numeric", month: "long" });
}

function generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let h = 10; h < 18; h++) {
        for (const m of [0, 30]) {
            if (h === 17 && m === 30) break;
            const period = h < 12 ? 'AM' : 'PM';
            const displayH = h > 12 ? h - 12 : h;
            slots.push(`${displayH}:${m === 0 ? '00' : '30'} ${period}`);
        }
    }
    return slots;
}

const TIME_SLOTS = generateTimeSlots();

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
            // Anclar la fecha elegida a medianoche AST (no medianoche local del browser).
            // Sin esto, un familiar en Madrid clickeando "28 may" enviaría 2026-05-27T22:00Z
            // y el server lo guardaría como 27-may AST → cita en el día equivocado.
            const astAnchoredDate = astMidnightUTC(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
            );
            const res = await fetch('/api/family/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    title:         typeOption.label,
                    description:   description.trim() || null,
                    requestedDate: astAnchoredDate.toISOString(),
                    requestedTime: selectedTime,
                    durationMins:  duration,
                }),
            });
            const data = await res.json();
            if (res.status === 409) {
                setFormError(data.error || 'Ya existe una cita en este horario. Elige otro.');
            } else if (data.success) {
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
        const firstDay = new Date(year, month, 1).getDay();
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

    const now = new Date();
    const pending  = appointments.filter(a => a.status === 'PENDING');
    const approved = appointments.filter(a => a.status === 'APPROVED' && new Date(a.requestedDate) >= now);
    const upcoming = [...pending, ...approved].sort((a, b) =>
        new Date(a.requestedDate).getTime() - new Date(b.requestedDate).getTime()
    );
    const history  = appointments
        .filter(a => a.status === 'REJECTED' || (a.status === 'APPROVED' && new Date(a.requestedDate) < now))
        .sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime());

    const isEmpty = !loading && upcoming.length === 0 && history.length === 0;

    return (
        <div className="bg-[#FAFAF8] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">

            {/* Header de página */}
            <header className="bg-white border-b border-stone-100 px-4 py-5">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3">
                        <IconCitas size={24} />
                        <div>
                            <h1 className="font-bold text-slate-800 text-xl leading-tight">Citas y Visitas</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Solicita y gestiona tus visitas</p>
                        </div>
                    </div>
                    {/* Microcopy de zona — la familia vive fuera de PR; aclaramos que las horas
                        mostradas son la hora del lugar físico (Vivid en Puerto Rico), no la del
                        browser. Cada cita además incluye etiqueta inline + botón "Añadir al
                        calendario" que descarga un .ics con instante UTC para que el calendario
                        nativo del familiar haga la conversión a su hora local automática. */}
                    <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                        Las horas mostradas son <span className="font-semibold">hora de Vivid (Puerto Rico · AST, UTC-4)</span>.
                        Usa <span className="font-semibold">Añadir al calendario</span> para que la cita aparezca en tu hora local.
                    </p>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

                {/* Botón solicitar */}
                <button
                    onClick={openModal}
                    className="w-full bg-brand hover:bg-brand text-white rounded-full py-3 px-6 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                    Solicitar nueva cita
                </button>

                {loading && (
                    <div className="text-center py-12">
                        <span className="text-sm text-slate-400">Cargando…</span>
                    </div>
                )}

                {/* Empty state guía */}
                {isEmpty && (
                    <div className="space-y-6">
                        <div className="text-center py-8">
                            <Calendar className="w-12 h-12 mx-auto text-slate-200 mb-4" strokeWidth={1.5} />
                            <p className="text-sm text-slate-400">Aún no tienes citas agendadas</p>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                Conoce los tipos de visita disponibles
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {EMPTY_GUIDE.map(({ Icon, title, desc }) => (
                                    <div
                                        key={title}
                                        className="bg-brand/10 border border-brand/20 rounded-xl p-4 flex items-start gap-3"
                                    >
                                        <Icon className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                        <div>
                                            <p className="font-semibold text-sm text-slate-800">{title}</p>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Próximas */}
                {upcoming.length > 0 && (
                    <section>
                        <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                            Próximas
                        </p>
                        <div>
                            {upcoming.map(a => (
                                <AppointmentCard key={a.id} appt={a} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Pasadas */}
                {history.length > 0 && (
                    <section>
                        <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                            Pasadas
                        </p>
                        <div>
                            {history.map(a => (
                                <AppointmentCard key={a.id} appt={a} muted />
                            ))}
                        </div>
                    </section>
                )}

                <p className="text-xs text-slate-400 text-center pt-4 pb-2">
                    Las solicitudes son revisadas en 24 a 48 horas
                </p>
            </div>

            {/* MODAL */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl border border-slate-100 w-full max-w-md max-h-[92vh] overflow-y-auto shadow-xl">

                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 p-5 sticky top-0 bg-white z-10 rounded-t-3xl">
                            <h2 className="font-bold text-slate-800 text-lg">Solicitar cita</h2>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5 text-slate-500" strokeWidth={1.5} />
                            </button>
                        </div>

                        {formSuccess ? (
                            <div className="px-6 py-12 flex flex-col items-center text-center">
                                <CheckCircle2 className="w-14 h-14 text-brand mb-4" strokeWidth={1.5} />
                                <p className="font-bold text-slate-800 text-lg mb-1">Solicitud enviada</p>
                                <p className="text-sm text-slate-500">El equipo te responderá pronto</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-5 space-y-5">

                                {formError && (
                                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                        <p className="text-sm text-red-600">{formError}</p>
                                    </div>
                                )}

                                {/* Tipo de cita — grid 2x2 (+ ocasión especial) */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                        Tipo de cita
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {TYPE_OPTIONS.map(opt => {
                                            const Icon = opt.Icon;
                                            const active = type === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setType(opt.value)}
                                                    className={`bg-white border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-colors ${
                                                        active
                                                            ? 'border-brand-secondary bg-brand/10'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <Icon
                                                        className={active ? 'w-5 h-5 text-brand' : 'w-5 h-5 text-slate-500'}
                                                        strokeWidth={1.5}
                                                    />
                                                    <span className={`text-xs font-semibold text-center leading-tight ${active ? 'text-brand' : 'text-slate-700'}`}>
                                                        {opt.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Fecha */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                        Fecha <span className="normal-case tracking-normal font-normal text-slate-400">(lunes no disponibles)</span>
                                    </p>
                                    <div className="flex items-center justify-between mb-3">
                                        <button
                                            type="button"
                                            onClick={prevMonth}
                                            className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                                            aria-label="Mes anterior"
                                        >
                                            <ChevronLeft className="w-4 h-4 text-slate-600" strokeWidth={1.5} />
                                        </button>
                                        <span className="font-semibold text-slate-800 capitalize text-sm">
                                            {calMonth.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={nextMonth}
                                            className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                                            aria-label="Mes siguiente"
                                        >
                                            <ChevronRight className="w-4 h-4 text-slate-600" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 mb-1">
                                        {['D','L','M','M','J','V','S'].map((d, i) => (
                                            <div
                                                key={i}
                                                className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1"
                                            >
                                                {d}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 justify-items-center">
                                        {calDays.map((cell, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                disabled={!cell.date || !cell.available}
                                                onClick={() => cell.date && cell.available && setSelectedDate(cell.date)}
                                                className={`w-9 h-9 rounded-full text-sm tabular-nums transition-colors ${
                                                    !cell.date
                                                        ? 'invisible'
                                                        : cell.selected
                                                            ? 'bg-brand text-white font-semibold'
                                                            : cell.available
                                                                ? 'bg-white text-slate-700 hover:bg-brand/10'
                                                                : 'text-slate-300 cursor-not-allowed'
                                                }`}
                                            >
                                                {cell.date?.getDate()}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedDate && (
                                        <p className="text-sm text-brand font-semibold mt-3 text-center capitalize">
                                            {selectedDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                        </p>
                                    )}
                                </div>

                                {/* Hora */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                        Hora
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TIME_SLOTS.map(slot => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => setSelectedTime(slot)}
                                                className={`rounded-full px-3 py-1.5 text-xs tabular-nums transition-colors ${
                                                    selectedTime === slot
                                                        ? 'bg-brand text-white font-semibold'
                                                        : 'bg-stone-50 text-slate-700 hover:bg-brand/10 border border-slate-200'
                                                }`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Duración */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                        Duración
                                    </p>
                                    <div className="flex gap-2">
                                        {DURATION_OPTIONS.map(d => (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => setDuration(d.value)}
                                                className={`flex-1 py-2 rounded-full text-sm font-semibold transition-colors ${
                                                    duration === d.value
                                                        ? 'bg-brand text-white'
                                                        : 'bg-stone-50 text-slate-700 border border-slate-200 hover:bg-brand/10'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notas */}
                                <div>
                                    <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">
                                        Notas <span className="normal-case tracking-normal font-normal text-slate-400">(opcional)</span>
                                    </p>
                                    <textarea
                                        rows={3}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Motivo o detalles…"
                                        className="w-full bg-stone-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-secondary focus:bg-white transition-colors resize-none"
                                    />
                                </div>
                            </form>
                        )}

                        {/* Footer */}
                        {!formSuccess && (
                            <div className="flex items-center justify-between border-t border-slate-100 p-4 sticky bottom-0 bg-white rounded-b-3xl">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="text-sm text-slate-500 hover:text-slate-700 font-semibold px-3 py-2 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={sending || !selectedDate || !selectedTime}
                                    className="flex items-center gap-2 bg-brand hover:bg-brand disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-full px-6 py-2.5 text-sm transition-colors"
                                >
                                    {sending ? (
                                        <>
                                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                                            Enviando
                                        </>
                                    ) : 'Enviar solicitud'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Card de cita — Humanista Suave
function AppointmentCard({ appt, muted = false }: { appt: Appointment; muted?: boolean }) {
    // Día/mes anclados a AST — antes `d.getDate()` leía la TZ del browser y la
    // diáspora veía un día menos. Ahora siempre se muestra el día de Vivid.
    const { day, monthAbbr } = formatASTDate(appt.requestedDate);
    const typeOption = TYPE_OPTIONS.find(t => t.value === appt.type);
    const label = typeOption?.label || appt.title;

    const badgeClass =
        appt.status === 'PENDING'  ? 'bg-amber-50 text-amber-700' :
        appt.status === 'APPROVED' ? 'bg-brand/10 text-brand' :
                                     'bg-red-50 text-red-600';

    return (
        <article className={`bg-white rounded-2xl border border-slate-100 p-4 mb-3 ${muted ? 'opacity-75' : ''}`}>
            <div className="flex items-start gap-4">
                {/* Fecha vertical (anclada AST) */}
                <div className="flex-shrink-0 w-12 text-center">
                    <p className="text-2xl font-bold text-brand leading-none tabular-nums">{day}</p>
                    <p className="text-xs text-slate-400 uppercase mt-1 font-semibold tracking-wide">{monthAbbr}</p>
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-base font-semibold text-slate-800 leading-tight">{label}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${badgeClass}`}>
                            {STATUS_LABELS[appt.status]}
                        </span>
                    </div>
                    {/* Hora con etiqueta de zona AST — appt.requestedTime ya viene como
                        string AST de la DB; solo añadimos la etiqueta canónica. */}
                    <p className="text-xs text-slate-400">
                        <span className="tabular-nums">{appt.requestedTime}</span>
                        <span className="ml-1 text-slate-400/80">({AST_TZ_LABEL})</span>
                        <span className="mx-1.5">·</span>
                        <span className="tabular-nums">{appt.durationMins} min</span>
                    </p>

                    {appt.description && (
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">{appt.description}</p>
                    )}

                    {appt.status === 'REJECTED' && appt.rejectedReason && (
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed border-l-2 border-red-100 pl-2">
                            {appt.rejectedReason}
                        </p>
                    )}

                    {appt.status === 'APPROVED' && (
                        <>
                            {appt.approvedBy && (
                                <p className="text-xs text-slate-400 mt-2">
                                    Confirmada por {appt.approvedBy.name}
                                    {appt.approvedAt && <> · {humanTime(appt.approvedAt)}</>}
                                </p>
                            )}
                            {/* "Añadir al calendario" — solo aparece en citas APROBADAS.
                                Descarga un .ics con instante UTC absoluto; el calendario
                                nativo del familiar lo convierte a SU hora local. */}
                            <a
                                href={`/api/family/appointments/${appt.id}/ics`}
                                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-brand hover:underline"
                                aria-label="Añadir esta cita al calendario nativo de tu dispositivo"
                            >
                                <CalendarPlus className="w-3.5 h-3.5" strokeWidth={2} />
                                Añadir al calendario
                            </a>
                        </>
                    )}
                </div>
            </div>
        </article>
    );
}
