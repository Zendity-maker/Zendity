"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Send, Clock, User, Printer, Loader2, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import SchedulePrintView from "@/components/hr/SchedulePrintView";

const SHIFT_LABELS: Record<string, string> = {
    MORNING:        "Diurno 6AM–2PM",
    EVENING:        "Vespertino 2PM–10PM",
    NIGHT:          "Nocturno 10PM–6AM",
    FULL_DAY:       "Turno Largo 6AM–6PM (12h)",
    FULL_NIGHT:     "Turno Largo 6PM–6AM (12h)",
    SUPERVISOR_DAY: "Supervisor 9AM–6PM"
};

const SHIFT_STYLES: Record<string, string> = {
    MORNING:        "bg-amber-50 text-amber-700 border-amber-200",
    EVENING:        "bg-indigo-50 text-indigo-700 border-indigo-200",
    NIGHT:          "bg-slate-100 text-slate-700 border-slate-200",
    FULL_DAY:       "bg-emerald-50 text-emerald-700 border-emerald-200",
    FULL_NIGHT:     "bg-violet-50 text-violet-700 border-violet-200",
    SUPERVISOR_DAY: "bg-purple-100 text-purple-700 border-purple-300"
};

const COLOR_OPTIONS = ["RED", "YELLOW", "GREEN", "BLUE", "ALL", "NONE"];

const COLOR_STYLES: Record<string, string> = {
    RED: "bg-red-100 text-red-700 border-red-200",
    YELLOW: "bg-yellow-100 text-yellow-700 border-yellow-200",
    GREEN: "bg-green-100 text-green-700 border-green-200",
    BLUE: "bg-blue-100 text-blue-700 border-blue-200",
    ALL: "bg-slate-100 text-slate-700 border-slate-200",
    NONE: "bg-slate-600 text-white border-slate-500"
};

function getMondayOf(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDate(date: Date) {
    return date.toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' });
}

type ShiftEntry = {
    tempId: string;
    userId: string;
    userName: string;
    date: string;
    shiftType: string;
    colorGroup: string | null;
    notes?: string;
    isAbsent?: boolean;
    isManual?: boolean;
    customStartTime?: string | null; // ISO string
    customEndTime?: string | null;
    customDescription?: string | null;
};

function formatTimeLabel(iso: string | null | undefined) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
}

/** Convierte ISO string a "HH:MM" en hora local para el input type="time". */
function extractHHMM(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

/** Combina una fecha base (YYYY-MM-DD) con HH:MM y devuelve ISO. */
function combineDateAndTime(dateStr: string, hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d.toISOString();
}

export default function ScheduleBuilderPage() {
    const { user } = useAuth();
    const hqId = (user as any)?.hqId || (user as any)?.headquartersId || "";

    const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
    const [staff, setStaff] = useState<any[]>([]);
    const [shifts, setShifts] = useState<ShiftEntry[]>([]);
    const [publishedSchedule, setPublishedSchedule] = useState<any>(null);
    const [draftId, setDraftId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Impresión PDF
    const [exporting, setExporting] = useState(false);
    const [hqBranding, setHqBranding] = useState<{ name: string; logoUrl: string | null }>({ name: 'Vivid Senior Living', logoUrl: null });
    const printRef = useRef<HTMLDivElement>(null);

    // Modal conflicto DRAFT existente
    const [draftConflict, setDraftConflict] = useState<{ existingScheduleId: string; shiftCount: number; createdAt: string } | null>(null);
    const [deletingDraft, setDeletingDraft] = useState(false);
    const canDeleteDraft = !!user && ['DIRECTOR', 'ADMIN'].includes((user as any).role);

    useEffect(() => {
        fetch('/api/public/hq/branding')
            .then(r => r.json())
            .then(d => {
                if (d.success && d.hq) setHqBranding({ name: d.hq.name, logoUrl: d.hq.logoUrl });
            })
            .catch(() => null);
    }, []);
    const [absentModal, setAbsentModal] = useState<{
        shift: any;
        result: any;
        countdown: number;
    } | null>(null);
    const [processingAbsent, setProcessingAbsent] = useState<string | null>(null);

    // Errores de validación del inline manual (por tempId)
    const [manualErrors, setManualErrors] = useState<Record<string, string>>({});

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    useEffect(() => {
        if (!hqId) return;
        fetchStaff();
        fetchSchedule();
    }, [hqId, weekStart]);

    const fetchStaff = async () => {
        try {
            const res = await fetch(`/api/hr/staff?hqId=${hqId}`);
            const data = await res.json();
            // La API puede devolver array directo O { success, staff }
            const staffList = Array.isArray(data) ? data : (data.staff || data.employees || []);
            setStaff(staffList.filter((s: any) =>
                ['CAREGIVER', 'SUPERVISOR', 'NURSE', 'CLEANING'].includes(s.role)
            ));
        } catch (e) { console.error(e); }
    };

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const iso = weekStart.toISOString();
            const res = await fetch(`/api/hr/schedule?hqId=${hqId}&weekStart=${iso}`);
            const data = await res.json();
            if (data.success && data.schedules.length > 0) {
                const s = data.schedules[0];
                setDraftId(s.id);
                setPublishedSchedule(s.status === 'PUBLISHED' ? s : null);
                const loaded: ShiftEntry[] = s.shifts.map((sh: any) => ({
                    tempId: sh.id,
                    userId: sh.userId,
                    userName: sh.user?.name || '',
                    date: sh.date.split('T')[0],
                    shiftType: sh.shiftType,
                    colorGroup: sh.colorGroup,
                    notes: sh.notes || '',
                    isAbsent: sh.isAbsent || false,
                    isManual: sh.isManual || false,
                    customStartTime: sh.customStartTime || null,
                    customEndTime: sh.customEndTime || null,
                    customDescription: sh.customDescription || null
                }));
                setShifts(loaded);
            } else {
                setShifts([]);
                setDraftId(null);
                setPublishedSchedule(null);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const addShift = (date: Date) => {
        if (!staff.length) return;
        const newShift: ShiftEntry = {
            tempId: `temp-${Date.now()}`,
            userId: staff[0].id,
            userName: staff[0].name,
            date: date.toISOString().split('T')[0],
            shiftType: 'MORNING',
            colorGroup: 'GREEN'
        };
        setShifts(prev => [...prev, newShift]);
    };

    /**
     * Activa modo manual inline en el card:
     * setea isManual=true + defaults 10:00/15:00 en la fecha del shift.
     */
    const enterManualMode = (tempId: string) => {
        setShifts(prev => prev.map(s => {
            if (s.tempId !== tempId) return s;
            const startISO = combineDateAndTime(s.date, s.customStartTime ? extractHHMM(s.customStartTime) : '10:00');
            const endISO = combineDateAndTime(s.date, s.customEndTime ? extractHHMM(s.customEndTime) : '15:00');
            return {
                ...s,
                isManual: true,
                customStartTime: startISO,
                customEndTime: endISO,
            };
        }));
        setManualErrors(prev => { const next = { ...prev }; delete next[tempId]; return next; });
    };

    /** Sale de modo manual y vuelve a MORNING por default. */
    const exitManualMode = (tempId: string) => {
        setShifts(prev => prev.map(s => s.tempId === tempId
            ? { ...s, isManual: false, customStartTime: null, customEndTime: null, customDescription: null, shiftType: 'MORNING', colorGroup: s.colorGroup || 'GREEN' }
            : s));
        setManualErrors(prev => { const next = { ...prev }; delete next[tempId]; return next; });
    };

    /** Actualiza una de las horas (start/end) inline con validación. */
    const updateManualTime = (tempId: string, field: 'start' | 'end', hhmm: string) => {
        setShifts(prev => prev.map(s => {
            if (s.tempId !== tempId) return s;
            const newISO = combineDateAndTime(s.date, hhmm);
            const nextShift = field === 'start'
                ? { ...s, customStartTime: newISO }
                : { ...s, customEndTime: newISO };

            // Validación: inicio debe ser antes que fin
            if (nextShift.customStartTime && nextShift.customEndTime) {
                const ss = new Date(nextShift.customStartTime).getTime();
                const ee = new Date(nextShift.customEndTime).getTime();
                setManualErrors(prevErr => {
                    const next = { ...prevErr };
                    if (ss >= ee) next[tempId] = 'Hora inválida: inicio debe ser antes que fin';
                    else delete next[tempId];
                    return next;
                });
            }
            return nextShift;
        }));
    };

    const updateShift = (tempId: string, field: string, value: string) => {
        setShifts(prev => prev.map(s => {
            if (s.tempId !== tempId) return s;
            if (field === 'userId') {
                const found = staff.find(st => st.id === value);
                return { ...s, userId: value, userName: found?.name || '' };
            }
            return { ...s, [field]: value };
        }));
    };

    const removeShift = (tempId: string) => {
        setShifts(prev => prev.filter(s => s.tempId !== tempId));
    };

    const handlePrintSchedule = async () => {
        if (!printRef.current) return;
        setExporting(true);
        try {
            printRef.current.style.display = 'block';
            await new Promise(r => setTimeout(r, 500));

            const canvas = await html2canvas(printRef.current, {
                scale: 2, useCORS: true, logging: false, allowTaint: true,
            });
            printRef.current.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            // Landscape A4 para una página completa
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeightScaled = (canvas.height * imgWidth) / canvas.width;

            // Si cabe en una página, centrar verticalmente; si no, desde el tope
            const yOffset = imgHeightScaled < pdfHeight - (margin * 2)
                ? margin + (pdfHeight - (margin * 2) - imgHeightScaled) / 2
                : margin;

            pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, Math.min(imgHeightScaled, pdfHeight - (margin * 2)));
            pdf.autoPrint();
            window.open(pdf.output('bloburl'), '_blank');
        } catch (err) {
            console.error('Print schedule error:', err);
            alert('Error generando el PDF del horario.');
        } finally {
            setExporting(false);
        }
    };

    const postSchedule = async (overwrite: boolean) => {
        const res = await fetch('/api/hr/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hqId,
                weekStartDate: weekStart.toISOString(),
                createdByUserId: user?.id,
                overwrite,
                shifts: shifts.map(s => ({
                    userId: s.userId,
                    date: s.date,
                    shiftType: s.shiftType,
                    colorGroup: s.colorGroup || null,
                    notes: s.notes || null,
                    isManual: s.isManual || false,
                    customStartTime: s.customStartTime || null,
                    customEndTime: s.customEndTime || null,
                    customDescription: s.customDescription || null
                }))
            })
        });
        return { status: res.status, data: await res.json() };
    };

    const saveSchedule = async () => {
        if (shifts.length === 0) {
            alert('Agrega al menos un turno antes de guardar.');
            return;
        }
        if (!hqId) {
            alert('Error: no se detectó la sede activa. Recarga la página.');
            return;
        }
        setSaving(true);
        try {
            const { status, data } = await postSchedule(false);
            if (data.success) {
                setDraftId(data.schedule.id);
                alert('✓ Horario guardado como borrador');
            } else if (status === 409 && data.conflict === 'DRAFT_EXISTS') {
                // Abrir modal de confirmación
                setDraftConflict({
                    existingScheduleId: data.existingScheduleId,
                    shiftCount: data.shiftCount,
                    createdAt: data.createdAt,
                });
            } else if (status === 409 && data.status === 'PUBLISHED') {
                alert('Ya existe un horario PUBLICADO para esta semana. Usa "Editar horario publicado" primero.');
            } else {
                alert(data.error || 'Error guardando el horario');
            }
        } catch (e) { alert('Error guardando el horario'); } finally { setSaving(false); }
    };

    const confirmOverwriteDraft = async () => {
        setSaving(true);
        try {
            const { data } = await postSchedule(true);
            if (data.success) {
                setDraftId(data.schedule.id);
                setDraftConflict(null);
                alert('✓ Borrador sobrescrito con los turnos actuales.');
            } else {
                alert(data.error || 'Error al sobrescribir');
            }
        } catch {
            alert('Error de conexión');
        } finally { setSaving(false); }
    };

    const deleteExistingDraft = async () => {
        if (!draftConflict) return;
        const dateStr = new Date(draftConflict.createdAt).toLocaleDateString('es-PR', { day: 'numeric', month: 'short', year: 'numeric' });
        if (!confirm(`¿Eliminar borrador del ${dateStr} (${draftConflict.shiftCount} turnos)?\nEsta acción no se puede deshacer.`)) return;
        setDeletingDraft(true);
        try {
            const res = await fetch(`/api/hr/schedule/${draftConflict.existingScheduleId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setDraftConflict(null);
                alert('✓ Borrador eliminado. Ahora puedes volver a guardar.');
                fetchSchedule();
            } else {
                alert(data.error || 'Error eliminando borrador');
            }
        } catch {
            alert('Error de conexión');
        } finally { setDeletingDraft(false); }
    };

    const publishSchedule = async () => {
        if (!draftId) return;
        if (!confirm('¿Publicar este horario? El equipo podrá verlo.')) return;
        try {
            const res = await fetch('/api/hr/schedule/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId: draftId })
            });
            const data = await res.json();
            if (data.success) {
                setPublishedSchedule(data.schedule);
                alert('✅ Horario publicado correctamente');
            }
        } catch (e) { alert('Error publicando el horario'); }
    };

    const unpublishSchedule = async () => {
        if (!draftId) return;
        if (!confirm('¿Editar el horario publicado? El estado cambiará a borrador y podrás modificarlo antes de volver a publicar.')) return;
        try {
            const res = await fetch('/api/hr/schedule/unpublish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId: draftId })
            });
            const data = await res.json();
            if (data.success) {
                setPublishedSchedule(null);
                alert('✓ Horario en modo edición. Modifica los turnos y vuelve a publicar.');
            }
        } catch (e) {
            alert('Error al editar el horario.');
        }
    };

    const markAbsent = async (shift: ShiftEntry) => {
        // Si el turno no está guardado aún, guardar primero
        if (shift.tempId.startsWith('temp-')) {
            alert('Guarda el horario primero antes de marcar ausencias.');
            return;
        }
        setProcessingAbsent(shift.tempId);
        try {
            const res = await fetch('/api/hr/schedule/absent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheduledShiftId: shift.tempId,
                    markedById: user?.id,
                    hqId
                })
            });
            const data = await res.json();
            if (data.success) {
                // Marcar visualmente como ausente
                setShifts(prev => prev.map(s =>
                    s.tempId === shift.tempId ? { ...s, isAbsent: true } : s
                ));
                // Iniciar countdown de 15 minutos
                let countdown = 15 * 60;
                const timer = setInterval(() => {
                    countdown--;
                    setAbsentModal(prev => prev ? { ...prev, countdown } : null);
                    if (countdown <= 0) {
                        clearInterval(timer);
                        // Auto-redistribuir
                        if (data.suggestedAssignee && data.absentColorGroup) {
                            fetch('/api/hr/schedule/redistribute', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    scheduledShiftId: data.suggestedAssignee.shift?.id || shift.tempId,
                                    targetUserId: data.suggestedAssignee.id,
                                    color: data.absentColorGroup,
                                    hqId,
                                    isAutoAssigned: true
                                })
                            });
                        }
                        setAbsentModal(null);
                        alert(`Redistribucion automatica completada. Grupo ${data.absentColorGroup} asignado a ${data.suggestedAssignee?.name || 'cuidador disponible'}.`);
                    }
                }, 1000);
                setAbsentModal({ shift, result: data, countdown });
            }
        } catch (e) {
            alert('Error marcando ausencia');
        } finally {
            setProcessingAbsent(null);
        }
    };

    const redistributeManually = async (targetUserId: string, targetName: string) => {
        if (!absentModal) return;
        try {
            const res = await fetch('/api/hr/schedule/redistribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheduledShiftId: absentModal.result.suggestedAssignee?.shift?.id || absentModal.shift.tempId,
                    targetUserId,
                    color: absentModal.result.absentColorGroup,
                    hqId,
                    assignedById: user?.id,
                    isAutoAssigned: false
                })
            });
            const data = await res.json();
            if (data.success) {
                setAbsentModal(null);
                alert(`✓ Grupo ${absentModal.result.absentColorGroup} asignado manualmente a ${targetName}`);
            }
        } catch (e) {
            alert('Error en redistribucion manual');
        }
    };

    const weekLabel = `${weekStart.toLocaleDateString('es-PR', { month: 'long', day: 'numeric' })} — ${addDays(weekStart, 6).toLocaleDateString('es-PR', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    return (
        <>
        <div className="space-y-6 pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-6 h-6 text-teal-400" />
                            <h1 className="text-2xl font-black">Constructor de Horarios</h1>
                            {publishedSchedule && (
                                <span className="bg-teal-500 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">Publicado</span>
                            )}
                        </div>
                        <p className="text-slate-500 text-sm">Asigna turnos, grupos de color y personal para la semana</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setWeekStart(prev => addDays(prev, -7))} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-bold min-w-[200px] text-center">{weekLabel}</span>
                        <button onClick={() => setWeekStart(prev => addDays(prev, 7))} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid semanal */}
            <div className="grid grid-cols-7 gap-3">
                {weekDays.map(day => {
                    const dateStr = day.toISOString().split('T')[0];
                    const dayShifts = shifts.filter(s => s.date === dateStr);
                    const isToday = day.toDateString() === new Date().toDateString();

                    return (
                        <div key={dateStr} className={`bg-white rounded-2xl border ${isToday ? 'border-teal-400 shadow-teal-100 shadow-lg' : 'border-slate-200'} p-3 min-h-[200px] flex flex-col`}>
                            <div className={`text-xs font-black uppercase tracking-widest mb-3 pb-2 border-b ${isToday ? 'text-teal-600 border-teal-200' : 'text-slate-500 border-slate-100'}`}>
                                {formatDate(day)}
                            </div>
                            <div className="space-y-2 flex-1">
                                {dayShifts.map(shift => {
                                    const assignedStaff = staff.find(s => s.id === shift.userId);
                                    const isCleaning = assignedStaff?.role === 'CLEANING';
                                    return (
                                    <div key={shift.tempId} className={`rounded-xl p-2 border space-y-1.5 ${isCleaning ? 'bg-orange-50 border-orange-200' : shift.isManual ? 'bg-teal-50 border-teal-200' : shift.shiftType === 'SUPERVISOR_DAY' ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex items-center justify-between gap-1">
                                            {isCleaning && (
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-orange-100 text-orange-700 border-orange-300">
                                                    Limpieza
                                                </span>
                                            )}
                                            {!isCleaning && shift.isManual && (
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-teal-100 text-teal-700 border-teal-300">
                                                    {formatTimeLabel(shift.customStartTime)}–{formatTimeLabel(shift.customEndTime)}
                                                </span>
                                            )}
                                            {!isCleaning && !shift.isManual && (
                                                <>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${SHIFT_STYLES[shift.shiftType] || SHIFT_STYLES.MORNING}`}>
                                                        {SHIFT_LABELS[shift.shiftType]?.split(' ')[0] || shift.shiftType}
                                                    </span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${COLOR_STYLES[shift.colorGroup || 'NONE']}`}>
                                                        {shift.colorGroup || 'Sin color'}
                                                    </span>
                                                </>
                                            )}
                                            <button onClick={() => removeShift(shift.tempId)} className="text-slate-500 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <select
                                            value={shift.userId}
                                            onChange={e => updateShift(shift.tempId, 'userId', e.target.value)}
                                            className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none focus:border-teal-400"
                                        >
                                            {staff.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                    {s.role === 'CLEANING' ? ' · Limpieza' : s.role === 'SUPERVISOR' ? ' · Supervisor' : s.role === 'NURSE' ? ' · Enfermero/a' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {!shift.isManual && (
                                            <>
                                                <select
                                                    value={shift.shiftType}
                                                    onChange={e => {
                                                        if (e.target.value === '__MANUAL__') {
                                                            enterManualMode(shift.tempId);
                                                        } else {
                                                            updateShift(shift.tempId, 'shiftType', e.target.value);
                                                        }
                                                    }}
                                                    className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none focus:border-teal-400"
                                                >
                                                    {Object.entries(SHIFT_LABELS).map(([k, v]) => {
                                                        const assignedStaff = staff.find(s => s.id === shift.userId);
                                                        if (k === 'SUPERVISOR_DAY' && assignedStaff?.role !== 'SUPERVISOR') return null;
                                                        return <option key={k} value={k}>{v}</option>;
                                                    })}
                                                    <option disabled>──────────</option>
                                                    <option value="__MANUAL__">✏️ Horario manual...</option>
                                                </select>
                                                <select
                                                    value={shift.colorGroup || 'NONE'}
                                                    onChange={e => updateShift(shift.tempId, 'colorGroup', e.target.value === 'NONE' ? '' : e.target.value)}
                                                    className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none focus:border-teal-400"
                                                >
                                                    {COLOR_OPTIONS.map(c => (
                                                        <option key={c} value={c}>{c === 'NONE' ? 'Sin asignar' : c === 'ALL' ? 'Todos los colores' : `Grupo ${c}`}</option>
                                                    ))}
                                                </select>
                                            </>
                                        )}
                                        {shift.isManual && (
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="time"
                                                        value={extractHHMM(shift.customStartTime)}
                                                        onChange={e => updateManualTime(shift.tempId, 'start', e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Escape') exitManualMode(shift.tempId); }}
                                                        className={`flex-1 text-[11px] bg-white border rounded-lg px-1.5 py-1 font-bold text-teal-700 focus:outline-none focus:border-teal-500 ${manualErrors[shift.tempId] ? 'border-red-400' : 'border-teal-300'}`}
                                                        autoFocus
                                                    />
                                                    <span className="text-[10px] text-teal-600 font-bold">→</span>
                                                    <input
                                                        type="time"
                                                        value={extractHHMM(shift.customEndTime)}
                                                        onChange={e => updateManualTime(shift.tempId, 'end', e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Escape') exitManualMode(shift.tempId); }}
                                                        className={`flex-1 text-[11px] bg-white border rounded-lg px-1.5 py-1 font-bold text-teal-700 focus:outline-none focus:border-teal-500 ${manualErrors[shift.tempId] ? 'border-red-400' : 'border-teal-300'}`}
                                                    />
                                                    <button
                                                        onClick={() => exitManualMode(shift.tempId)}
                                                        className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                                                        title="Salir de modo manual"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                {manualErrors[shift.tempId] && (
                                                    <p className="text-[10px] text-red-600 font-bold px-1">{manualErrors[shift.tempId]}</p>
                                                )}
                                                <select
                                                    value={shift.colorGroup || 'NONE'}
                                                    onChange={e => updateShift(shift.tempId, 'colorGroup', e.target.value === 'NONE' ? '' : e.target.value)}
                                                    className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none focus:border-teal-400"
                                                >
                                                    {COLOR_OPTIONS.map(c => (
                                                        <option key={c} value={c}>{c === 'NONE' ? 'Sin asignar' : c === 'ALL' ? 'Todos los colores' : `Grupo ${c}`}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <input
                                            type="text"
                                            value={shift.notes || ''}
                                            onChange={e => updateShift(shift.tempId, 'notes', e.target.value)}
                                            placeholder="Notas del turno (opcional)"
                                            className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-500 placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
                                        />
                                        {!shift.isAbsent ? (
                                            <button
                                                onClick={() => markAbsent(shift)}
                                                disabled={processingAbsent === shift.tempId}
                                                className="w-full text-[10px] font-bold text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 rounded-lg py-1 transition-all mt-1 disabled:opacity-50"
                                            >
                                                {processingAbsent === shift.tempId
                                                    ? 'Procesando...'
                                                    : shift.tempId.startsWith('temp-')
                                                        ? 'Guarda primero'
                                                        : 'Marcar Ausente'}
                                            </button>
                                        ) : (
                                            <div className="w-full text-center text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 rounded-lg py-1 mt-1">
                                                AUSENTE
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => addShift(day)}
                                className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl py-2 transition-all border border-dashed border-slate-200 hover:border-teal-300"
                            >
                                <Plus className="w-3 h-3" /> Agregar turno
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Resumen por día */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-teal-500" />
                    Resumen de la semana
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['MORNING', 'EVENING', 'NIGHT', 'SUPERVISOR_DAY'].map(type => {
                        const count = shifts.filter(s => s.shiftType === type).length;
                        const isSupervisor = type === 'SUPERVISOR_DAY';
                        return (
                            <div key={type} className={`rounded-xl p-4 border ${isSupervisor ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100'}`}>
                                <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isSupervisor ? 'text-purple-700' : 'text-slate-500'}`}>{SHIFT_LABELS[type]}</p>
                                <p className={`text-2xl font-black ${isSupervisor ? 'text-purple-800' : 'text-slate-800'}`}>{count}</p>
                                <p className={`text-xs ${isSupervisor ? 'text-purple-600' : 'text-slate-500'}`}>turnos programados</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-500" />
                    <div>
                        <p className="text-sm font-bold text-slate-700">{shifts.length} turnos en este borrador</p>
                        <p className="text-xs text-slate-500">{publishedSchedule ? 'Horario publicado — el equipo puede verlo' : 'Borrador — aún no visible para el equipo'}</p>
                    </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {/* Botón imprimir — solo DIRECTOR, ADMIN, HR */}
                    {user && ['DIRECTOR', 'ADMIN'].includes((user as any).role) && shifts.length > 0 && (
                        <button
                            onClick={handlePrintSchedule}
                            disabled={exporting}
                            className="px-5 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-sm"
                        >
                            {exporting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                            ) : (
                                <><Printer className="w-4 h-4" /> Imprimir horario</>
                            )}
                        </button>
                    )}
                    <button
                        onClick={saveSchedule}
                        disabled={saving || shifts.length === 0}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
                    >
                        {saving ? 'Guardando...' : `Guardar borrador (${shifts.length} turnos)`}
                    </button>
                    {publishedSchedule && (
                        <button
                            onClick={unpublishSchedule}
                            className="px-6 py-3 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-xl transition-all text-sm border border-amber-300"
                        >
                            Editar horario publicado
                        </button>
                    )}
                    <button
                        onClick={publishSchedule}
                        disabled={!draftId || !!publishedSchedule}
                        className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 text-sm shadow-lg shadow-teal-500/20"
                    >
                        <Send className="w-4 h-4" />
                        Publicar horario
                    </button>
                </div>
            </div>
        </div>

        {absentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-red-600 font-bold text-sm">!</span>
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800">Empleado Ausente</h3>
                            <p className="text-sm text-slate-500">{absentModal.shift.userName} — Grupo {absentModal.result.absentColorGroup}</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                        <p className="text-sm font-bold text-amber-800 mb-1">Redistribucion automatica en:</p>
                        <p className="text-3xl font-black text-amber-600">
                            {Math.floor(absentModal.countdown / 60)}:{String(absentModal.countdown % 60).padStart(2, '0')}
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                            Sugerido: {absentModal.result.suggestedAssignee?.name || 'calculando...'}
                        </p>
                    </div>

                    {absentModal.result.activeShifts?.length > 0 && (
                        <div className="space-y-2 mb-4">
                            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Asignar manualmente a:</p>
                            {absentModal.result.activeShifts.map((s: any) => (
                                <button
                                    key={s.shift?.user?.id || s.shift?.userId}
                                    onClick={() => redistributeManually(s.shift?.user?.id, s.shift?.user?.name)}
                                    className="w-full flex items-center justify-between bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all text-left"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{s.shift?.user?.name}</p>
                                        <p className="text-xs text-slate-500">{s.currentLoad} residentes actuales</p>
                                    </div>
                                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full">Asignar</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => setAbsentModal(null)}
                        className="w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cerrar (la redistribucion automatica continua)
                    </button>
                </div>
            </div>
        )}

        {/* Offscreen render para impresión */}
        <SchedulePrintView
            ref={printRef}
            weekStart={weekStart}
            weekDays={weekDays}
            shifts={shifts}
            staff={staff}
            isPublished={!!publishedSchedule}
            hqName={hqBranding.name}
            hqLogoUrl={hqBranding.logoUrl}
            generatedByName={user?.name || 'Supervisor'}
        />

        {/* Modal conflicto DRAFT existente */}
        {draftConflict && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center text-xl font-black">!</div>
                        <div>
                            <h3 className="font-black text-slate-800">Borrador existente</h3>
                            <p className="text-xs font-bold text-amber-700">Ya hay un borrador para esta semana</p>
                        </div>
                    </div>
                    <div className="px-6 py-5 space-y-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
                            <div className="flex justify-between mb-2">
                                <span className="text-slate-500 font-bold">Creado:</span>
                                <span className="text-slate-800 font-bold">
                                    {new Date(draftConflict.createdAt).toLocaleDateString('es-PR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-bold">Turnos:</span>
                                <span className="text-slate-800 font-black">{draftConflict.shiftCount}</span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                            Si sobrescribes, el borrador anterior será <strong>reemplazado</strong> por los {shifts.length} turnos actuales. Esta acción no se puede deshacer.
                        </p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-wrap">
                        <button
                            onClick={() => setDraftConflict(null)}
                            disabled={saving || deletingDraft}
                            className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        {canDeleteDraft && (
                            <button
                                onClick={deleteExistingDraft}
                                disabled={saving || deletingDraft}
                                className="flex-1 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {deletingDraft ? 'Eliminando...' : 'Eliminar borrador'}
                            </button>
                        )}
                        <button
                            onClick={confirmOverwriteDraft}
                            disabled={saving || deletingDraft}
                            className="flex-1 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Sobrescribiendo...' : 'Sobrescribir'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
