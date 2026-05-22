"use client";

/**
 * /family/calendar — Editorial Calm
 *
 * Magazine-style. Serif display protagonista. Hairlines en lugar de cards.
 * Mucho whitespace. Sin emojis.
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
} from "lucide-react";
import { IconCitas } from "@/components/icons/ZendityIcons";

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

// ── humanTime helper (copia exacta de /family/page.tsx) ──
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

function Diamond() {
    return (
        <div className="flex justify-center py-12">
            <span className="text-stone-300 text-base tracking-[1em]">◆ ◆ ◆</span>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-8 text-center">
            {children}
        </p>
    );
}

const MONTHS_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function FamilyCalendarEditorial() {
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
                    title:         typeOption.label,
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
        <div className="bg-stone-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8 md:-my-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 sm:py-24">

                {/* ═══ MASTHEAD ═══ */}
                <header className="text-center mb-16">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-medium mb-6">
                        Agenda
                    </p>
                    <div className="flex justify-center mb-5">
                        <IconCitas size={56} />
                    </div>
                    <h1
                        className="font-serif text-stone-900 leading-[1.05] tracking-tight mb-5"
                        style={{
                            fontSize: "clamp(2.75rem, 9vw, 4.5rem)",
                            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                        }}
                    >
                        Citas
                    </h1>
                    <div className="flex items-center justify-center gap-3 mb-5">
                        <span className="block w-12 h-px bg-stone-300" />
                        <span className="text-stone-300 text-xs">◆</span>
                        <span className="block w-12 h-px bg-stone-300" />
                    </div>
                    <p className="font-serif italic text-stone-500 text-base max-w-sm mx-auto leading-relaxed">
                        Visitas, llamadas y momentos especiales con tu familiar
                    </p>

                    <div className="mt-10">
                        <button
                            onClick={openModal}
                            className="font-serif italic text-base text-teal-700 hover:text-teal-800 underline decoration-stone-300 hover:decoration-teal-600 underline-offset-[6px] decoration-1 transition-colors"
                        >
                            Agendar una cita
                        </button>
                    </div>
                </header>

                {loading && (
                    <div className="text-center py-16">
                        <span className="font-serif italic text-stone-300 text-lg">cargando…</span>
                    </div>
                )}

                {/* ═══ EMPTY STATE ═══ */}
                {isEmpty && (
                    <>
                        <Diamond />
                        <div className="text-center max-w-md mx-auto py-12">
                            <Calendar className="w-16 h-16 mx-auto text-stone-300 mb-8" strokeWidth={1} />
                            <p
                                className="font-serif italic text-stone-500 leading-relaxed mb-8"
                                style={{ fontSize: "1.375rem" }}
                            >
                                Aún no tienes citas<br />agendadas
                            </p>
                            <button
                                onClick={openModal}
                                className="font-serif italic text-base text-teal-700 hover:text-teal-800 underline decoration-stone-300 hover:decoration-teal-600 underline-offset-[6px] decoration-1 transition-colors"
                            >
                                Agendar la primera
                            </button>
                        </div>
                    </>
                )}

                {/* ═══ PRÓXIMAS ═══ */}
                {upcoming.length > 0 && (
                    <>
                        <Diamond />
                        <section>
                            <SectionLabel>Próximas</SectionLabel>
                            <div className="max-w-xl mx-auto">
                                {upcoming.map(a => (
                                    <AppointmentRow key={a.id} appt={a} />
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {/* ═══ PASADAS ═══ */}
                {history.length > 0 && (
                    <>
                        <Diamond />
                        <section>
                            <SectionLabel>Pasadas</SectionLabel>
                            <div className="max-w-xl mx-auto opacity-80">
                                {history.map(a => (
                                    <AppointmentRow key={a.id} appt={a} muted />
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {/* ═══ COLOFÓN ═══ */}
                <footer className="text-center mt-20 sm:mt-28 pb-8">
                    <p className="text-stone-300 text-xs tracking-[0.5em] mb-3">◆ ◆ ◆</p>
                    <p className="font-serif italic text-stone-400 text-xs leading-relaxed">
                        Las solicitudes son revisadas<br />en 24 a 48 horas
                    </p>
                </footer>
            </div>

            {/* ═══ MODAL ═══ */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
                    <div
                        className="bg-stone-50 ring-1 ring-stone-200 rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 duration-300"
                        style={{ boxShadow: "0 24px 64px -16px rgba(15,110,120,0.2)" }}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-8 pt-8 pb-6 sticky top-0 bg-stone-50 z-10 rounded-t-3xl">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-1">
                                    Nueva
                                </p>
                                <h2
                                    className="font-serif text-stone-900 tracking-tight"
                                    style={{
                                        fontSize: "2rem",
                                        fontVariationSettings: "'opsz' 48, 'SOFT' 50",
                                    }}
                                >
                                    Agendar cita
                                </h2>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 rounded-full hover:bg-stone-100 transition-colors"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5 text-stone-500" strokeWidth={1.5} />
                            </button>
                        </div>

                        {formSuccess ? (
                            <div className="px-8 py-16 flex flex-col items-center text-center">
                                <CheckCircle2 className="w-14 h-14 text-teal-600 mb-6" strokeWidth={1.25} />
                                <p
                                    className="font-serif italic text-stone-700 leading-relaxed mb-3"
                                    style={{ fontSize: "1.5rem" }}
                                >
                                    Solicitud enviada
                                </p>
                                <p className="font-serif italic text-stone-400 text-sm">
                                    El equipo te responderá pronto
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-8">

                                {formError && (
                                    <div className="flex items-center gap-2.5 border-b border-red-300 pb-3">
                                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={1.5} />
                                        <p className="font-serif italic text-sm text-red-600">{formError}</p>
                                    </div>
                                )}

                                {/* Tipo de cita */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-4">
                                        Tipo
                                    </label>
                                    <div className="space-y-px">
                                        {TYPE_OPTIONS.map(opt => {
                                            const Icon = opt.Icon;
                                            const active = type === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setType(opt.value)}
                                                    className={`w-full flex items-center gap-4 py-3 border-b border-stone-200 text-left transition-colors ${
                                                        active
                                                            ? 'text-teal-700'
                                                            : 'text-stone-700 hover:bg-stone-100/50'
                                                    }`}
                                                >
                                                    <Icon
                                                        className={`w-4 h-4 ${active ? 'text-teal-600' : 'text-stone-400'}`}
                                                        strokeWidth={1.5}
                                                    />
                                                    <span
                                                        className="font-serif italic flex-1"
                                                        style={{ fontSize: "1.0625rem" }}
                                                    >
                                                        {opt.label}
                                                    </span>
                                                    {active && (
                                                        <span className="text-teal-600 text-xs">◆</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Fecha */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-4">
                                        Fecha
                                        <span className="ml-2 normal-case tracking-normal font-serif italic text-stone-400 text-xs">
                                            (lunes no disponibles)
                                        </span>
                                    </label>
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            type="button"
                                            onClick={prevMonth}
                                            className="p-1.5 rounded-full hover:bg-stone-100 transition-colors"
                                            aria-label="Mes anterior"
                                        >
                                            <ChevronLeft className="w-4 h-4 text-stone-500" strokeWidth={1.5} />
                                        </button>
                                        <span className="font-serif italic text-stone-700 capitalize text-base">
                                            {calMonth.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={nextMonth}
                                            className="p-1.5 rounded-full hover:bg-stone-100 transition-colors"
                                            aria-label="Mes siguiente"
                                        >
                                            <ChevronRight className="w-4 h-4 text-stone-500" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 mb-2">
                                        {['D','L','M','M','J','V','S'].map((d, i) => (
                                            <div
                                                key={i}
                                                className={`text-center text-[10px] uppercase tracking-[0.2em] py-1 ${
                                                    i === 1 ? 'text-stone-200' : 'text-stone-400'
                                                }`}
                                            >
                                                {d}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {calDays.map((cell, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                disabled={!cell.date || !cell.available}
                                                onClick={() => cell.date && cell.available && setSelectedDate(cell.date)}
                                                className={`aspect-square rounded-full text-sm tabular-nums font-sans transition-colors ${
                                                    !cell.date
                                                        ? 'invisible'
                                                        : cell.selected
                                                            ? 'bg-teal-600 text-white'
                                                            : cell.available
                                                                ? 'text-stone-700 hover:bg-stone-200/60'
                                                                : 'text-stone-300 cursor-not-allowed'
                                                }`}
                                            >
                                                {cell.date?.getDate()}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedDate && (
                                        <p className="font-serif italic text-teal-700 text-sm mt-4 text-center">
                                            {selectedDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                        </p>
                                    )}
                                </div>

                                {/* Hora */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-4">
                                        Hora
                                    </label>
                                    <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                                        {TIME_SLOTS.map(slot => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => setSelectedTime(slot)}
                                                className={`py-2 text-xs tabular-nums font-sans rounded-full transition-colors ${
                                                    selectedTime === slot
                                                        ? 'bg-teal-600 text-white'
                                                        : 'text-stone-600 hover:bg-stone-200/60'
                                                }`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Duración */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-4">
                                        Duración
                                    </label>
                                    <div className="flex gap-2">
                                        {DURATION_OPTIONS.map(d => (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => setDuration(d.value)}
                                                className={`flex-1 py-2.5 font-serif italic text-sm rounded-full transition-colors ${
                                                    duration === d.value
                                                        ? 'bg-teal-600 text-white'
                                                        : 'text-stone-600 hover:bg-stone-200/60 ring-1 ring-stone-200'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notas */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium mb-3">
                                        Notas
                                        <span className="ml-2 normal-case tracking-normal font-serif italic text-stone-400 text-xs">
                                            (opcional)
                                        </span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Motivo o detalles…"
                                        className="w-full bg-transparent border-0 border-b border-stone-200 px-0 py-2 focus:outline-none focus:border-teal-600 transition-colors font-serif italic text-stone-800 placeholder:text-stone-400 resize-none"
                                        style={{ fontSize: "1.0625rem" }}
                                    />
                                </div>

                                {/* Botones */}
                                <div className="flex items-center justify-between pt-4 border-t border-stone-200">
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(false)}
                                        className="font-serif italic text-stone-500 hover:text-stone-700 text-sm transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sending || !selectedDate || !selectedTime}
                                        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-serif italic rounded-full px-7 py-3 text-sm transition-colors"
                                    >
                                        {sending ? (
                                            <>
                                                <span className="animate-spin inline-block w-3.5 h-3.5 border border-white border-t-transparent rounded-full" />
                                                Enviando
                                            </>
                                        ) : 'Enviar solicitud'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Row editorial: fecha izquierda, contenido derecha ──
function AppointmentRow({ appt, muted = false }: { appt: Appointment; muted?: boolean }) {
    const d = new Date(appt.requestedDate);
    const day = d.getDate();
    const monthAbbr = MONTHS_ABBR[d.getMonth()];
    const weekday = d.toLocaleDateString('es-PR', { weekday: 'long' });
    const typeOption = TYPE_OPTIONS.find(t => t.value === appt.type);
    const Icon = typeOption?.Icon || Calendar;
    const label = typeOption?.label || appt.title;

    const statusTone =
        appt.status === 'PENDING'  ? 'text-amber-700' :
        appt.status === 'APPROVED' ? 'text-teal-700' :
                                     'text-stone-400';

    return (
        <article className={`group flex items-start gap-6 py-6 border-b border-stone-200 hover:bg-stone-100/50 transition-colors -mx-4 px-4 rounded-sm ${muted ? 'opacity-70' : ''}`}>
            {/* Fecha grande */}
            <div className="flex-shrink-0 w-16 text-center">
                <p
                    className="font-serif text-stone-900 leading-none tracking-tight tabular-nums"
                    style={{
                        fontSize: "2.25rem",
                        fontVariationSettings: "'opsz' 48, 'SOFT' 50",
                    }}
                >
                    {day}
                </p>
                <p className="font-serif italic text-stone-400 text-xs mt-1 lowercase">
                    {monthAbbr}
                </p>
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={1.5} />
                    <p
                        className="font-serif text-stone-900 tracking-tight"
                        style={{
                            fontSize: "1.25rem",
                            fontVariationSettings: "'opsz' 24, 'SOFT' 50",
                        }}
                    >
                        {label}
                    </p>
                </div>
                <p className="font-serif italic text-stone-500 text-sm capitalize">
                    {weekday}
                    <span className="mx-2 text-stone-300">·</span>
                    <span className="font-sans not-italic tabular-nums text-stone-600">{appt.requestedTime}</span>
                    <span className="mx-2 text-stone-300">·</span>
                    <span className="font-sans not-italic tabular-nums text-stone-500">{appt.durationMins} min</span>
                </p>

                {appt.description && (
                    <p
                        className="font-serif italic text-stone-600 leading-relaxed mt-3"
                        style={{ fontSize: "0.9375rem" }}
                    >
                        &ldquo;{appt.description}&rdquo;
                    </p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs">
                    <span className={`uppercase tracking-[0.25em] text-[10px] font-medium ${statusTone}`}>
                        {STATUS_LABELS[appt.status]}
                    </span>
                    {appt.status === 'APPROVED' && appt.approvedBy && (
                        <span className="font-serif italic text-stone-400">
                            — confirmada por {appt.approvedBy.name}
                        </span>
                    )}
                    {appt.status === 'APPROVED' && appt.approvedAt && (
                        <span className="font-serif italic text-stone-400">
                            {humanTime(appt.approvedAt)}
                        </span>
                    )}
                </div>

                {appt.status === 'REJECTED' && appt.rejectedReason && (
                    <p className="font-serif italic text-stone-500 text-sm mt-3 pl-3 border-l border-stone-300 leading-relaxed">
                        {appt.rejectedReason}
                    </p>
                )}
            </div>
        </article>
    );
}
