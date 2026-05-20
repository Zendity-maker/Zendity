"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Search, ChevronRight, Loader2, Printer, AlertTriangle,
    CheckCircle2, Clock, Users, ClipboardList, ShieldAlert, ChevronDown,
    ChevronUp, X,
} from "lucide-react";
import Link from "next/link";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Employee { id: string; name: string; role: string; }
interface ShiftSessionItem {
    id: string; startTime: string; endTime: string | null;
    shiftType: string; shiftLabel: string; durationH: string | null;
    handoverCompleted: boolean; isOpen: boolean;
}
interface AuditEntry {
    time: string; type: string; label: string; detail: string;
    severity: 'ok' | 'warn' | 'critical';
}
interface PatientAudit {
    id: string; name: string; room: string; colorGroup: string;
    hasActiveUPP: boolean;
    isAway?: boolean;
    leaveType?: 'HOSPITAL' | 'DIALYSIS' | 'OTHER' | null;
    entries: AuditEntry[];
    gaps: { label: string; severity: 'warn' | 'critical' }[];
    counts: Record<string, number>;
}
interface ShiftAudit {
    shiftSessionId: string; caregiverName: string;
    shiftType: string; shiftStart: string; shiftEnd: string | null; isOpen: boolean;
    colorGroups: string[];
    totalResidents: number;
    patients: PatientAudit[];
    summary: Record<string, number>;
    handover: {
        completed: boolean; completedAt: string | null;
        supervisorSignedAt: string | null; supervisorName: string | null;
        incomingName: string | null; colorGroups: string[];
    } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' });

const SHIFT_LABELS: Record<string, { label: string; emoji: string; bg: string; border: string }> = {
    MORNING: { label: 'Turno Diurno',     emoji: '☀️', bg: 'bg-amber-50',  border: 'border-amber-200' },
    EVENING: { label: 'Turno Vespertino', emoji: '🌆', bg: 'bg-blue-50',   border: 'border-blue-200' },
    NIGHT:   { label: 'Guardia Nocturna', emoji: '🌙', bg: 'bg-slate-100', border: 'border-slate-300' },
};
const COLOR_DOT: Record<string, string> = {
    RED: 'bg-red-500', YELLOW: 'bg-amber-400', BLUE: 'bg-blue-500',
    GREEN: 'bg-emerald-500', ALL: 'bg-purple-500',
};
const COLOR_LABEL: Record<string, string> = {
    RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde', ALL: 'Todos',
};
const SEV_STYLES = {
    ok:       { row: 'border-l-2 border-emerald-300', dot: 'bg-emerald-400', text: 'text-emerald-700' },
    warn:     { row: 'border-l-2 border-amber-400',   dot: 'bg-amber-400',   text: 'text-amber-700' },
    critical: { row: 'border-l-2 border-red-500',     dot: 'bg-red-500',     text: 'text-red-700' },
};

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// ─── Componente: tarjeta de residente ─────────────────────────────────────────

function PatientCard({ p }: { p: PatientAudit }) {
    const [open, setOpen] = useState(false);
    const hasGaps = p.gaps.length > 0;
    const hasCritical = p.gaps.some(g => g.severity === 'critical');

    return (
        <div className={`rounded-2xl border overflow-hidden print:break-inside-avoid ${hasCritical ? 'border-red-300' : hasGaps ? 'border-amber-300' : 'border-slate-200'}`}>
            {/* Header del residente */}
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors print:cursor-default
                    ${hasCritical ? 'bg-red-50 hover:bg-red-100' : hasGaps ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-slate-50'}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[p.colorGroup] || 'bg-slate-400'}`} />
                    <div>
                        <p className="font-black text-slate-800 text-sm">{p.name}</p>
                        <p className="text-[11px] text-slate-500 font-medium">
                            Hab. {p.room} · Grupo {COLOR_LABEL[p.colorGroup] || p.colorGroup}
                            {p.hasActiveUPP && <span className="ml-1 text-orange-600 font-bold">· UPP Activa</span>}
                            {p.isAway && (
                                <span className="ml-2 inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[10px]">
                                    {p.leaveType === 'HOSPITAL' ? '🏥 Hospital' :
                                     p.leaveType === 'DIALYSIS' ? '🩺 Diálisis' :
                                     '✈️ Fuera del hogar'}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Counters */}
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold">
                        {p.counts.baths > 0 && <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">🛁 {p.counts.baths}</span>}
                        {p.counts.meals > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🍽️ {p.counts.meals}</span>}
                        {p.counts.medsOk > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">💊 {p.counts.medsOk}</span>}
                        {p.counts.medsOmit > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ {p.counts.medsOmit}</span>}
                        {p.counts.rotations > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">🔄 {p.counts.rotations}</span>}
                    </div>
                    {hasGaps && (
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${hasCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.gaps.length} brecha{p.gaps.length > 1 ? 's' : ''}
                        </span>
                    )}
                    <span className="text-slate-400 print:hidden">
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                </div>
            </button>

            {/* Contenido expandido — siempre visible en print */}
            <div className={`${open ? 'block' : 'hidden'} print:block`}>
                {/* Brechas */}
                {p.gaps.length > 0 && (
                    <div className="px-5 py-3 border-t border-dashed border-slate-200 bg-slate-50 space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Brechas detectadas</p>
                        {p.gaps.map((g, i) => (
                            <div key={i} className={`flex items-center gap-2 text-xs font-bold ${g.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                                <span>{g.severity === 'critical' ? '🔴' : '🟡'}</span>
                                {g.label}
                            </div>
                        ))}
                    </div>
                )}

                {/* Timeline */}
                {p.entries.length === 0 ? (
                    <div className="px-5 py-6 text-center text-slate-400 border-t border-slate-100">
                        <p className="font-semibold text-sm">Sin actividad registrada en este turno</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {p.entries.map((e, i) => {
                            const sev = SEV_STYLES[e.severity];
                            return (
                                <div key={i} className={`flex items-start gap-4 px-5 py-3 ${sev.row}`}>
                                    <div className="shrink-0 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                            <span className="text-[11px] font-black text-slate-500 whitespace-nowrap">{fmtTime(e.time)}</span>
                                            <span className="text-sm font-bold text-slate-800">{e.label}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium mt-0.5">{e.detail}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Línea de firma física */}
                <div className="px-5 py-4 bg-slate-50 border-t border-dashed border-slate-200 print:block hidden">
                    <div className="flex gap-8 text-[10px] text-slate-400 font-medium">
                        <div className="flex-1 border-b border-slate-300 pb-4"></div>
                        <div className="flex-1 border-b border-slate-300 pb-4"></div>
                    </div>
                    <div className="flex gap-8 text-[10px] text-slate-400 font-medium mt-1">
                        <div className="flex-1 text-center">Cuidador(a)</div>
                        <div className="flex-1 text-center">Supervisor(a)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function ShiftAuditPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState<'employee' | 'sessions' | 'audit'>('employee');

    // Step 1: selección de empleado
    const [search, setSearch]           = useState("");
    const [employees, setEmployees]     = useState<Employee[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Step 2: lista de turnos
    const [sessions, setSessions]       = useState<ShiftSessionItem[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Step 3: auditoría
    const [audit, setAudit]             = useState<ShiftAudit | null>(null);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [selectedSession, setSelectedSession] = useState<ShiftSessionItem | null>(null);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) router.replace('/login');
        if (!authLoading && user && !ALLOWED_ROLES.includes(user.role || '')) router.replace('/');
    }, [user, authLoading, router]);

    // Cargar staff de la sede
    useEffect(() => {
        if (!user) return;
        setLoadingStaff(true);
        const hqId = (user as any).hqId || (user as any).headquartersId || '';
        fetch(`/api/care/supervisor?hqId=${hqId}`)
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    const staff: Employee[] = (d.staff || []).map((s: any) => ({
                        id: s.id, name: s.name, role: s.role
                    }));
                    setEmployees(staff);
                }
            })
            .catch(console.error)
            .finally(() => setLoadingStaff(false));
    }, [user]);

    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelectEmployee = async (emp: Employee) => {
        setSelectedEmployee(emp);
        setStep('sessions');
        setLoadingSessions(true);
        setError(null);
        try {
            const res = await fetch(`/api/care/supervisor/shift-audit/sessions?userId=${emp.id}`);
            const data = await res.json();
            if (data.success) setSessions(data.sessions || []);
            else setError(data.error || 'Error cargando turnos');
        } catch {
            setError('Error de conexión');
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleSelectSession = async (sess: ShiftSessionItem) => {
        setSelectedSession(sess);
        setStep('audit');
        setLoadingAudit(true);
        setError(null);
        try {
            const res = await fetch(`/api/care/supervisor/shift-audit?shiftSessionId=${sess.id}`);
            const data = await res.json();
            if (data.success) setAudit(data.audit);
            else setError(data.error || 'Error cargando auditoría');
        } catch {
            setError('Error de conexión');
        } finally {
            setLoadingAudit(false);
        }
    };

    const handlePrint = () => window.print();

    if (authLoading) return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white">
            {/* ── Print header ── */}
            <div className="hidden print:block px-8 pt-6 pb-4 border-b border-slate-300">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Zéndity · Auditoría de Turno</p>
                        <h1 className="text-xl font-black text-slate-800 mt-0.5">
                            {audit?.caregiverName} — {audit ? (SHIFT_LABELS[audit.shiftType]?.label || audit.shiftType) : ''}
                        </h1>
                        {audit && (
                            <p className="text-xs text-slate-500 mt-0.5">
                                {fmtDate(audit.shiftStart)} · {fmtTime(audit.shiftStart)} → {audit.shiftEnd ? fmtTime(audit.shiftEnd) : 'Turno abierto'}
                            </p>
                        )}
                    </div>
                    <div className="text-right text-[10px] text-slate-400">
                        <p>Impreso: {new Date().toLocaleString('es-PR')}</p>
                        <p className="font-bold">Confidencial · Uso interno</p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-6 md:p-8 print:max-w-full print:p-4 pb-24">

                {/* ── Header navegación ── */}
                <div className="flex items-center gap-4 mb-6 print:hidden">
                    {step !== 'employee' ? (
                        <button onClick={() => setStep(step === 'audit' ? 'sessions' : 'employee')}
                            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                    ) : (
                        <Link href="/care/supervisor" className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                    )}
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <ClipboardList className="w-6 h-6 text-teal-600" /> Auditoría de Turno
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">
                            {step === 'employee' && 'Selecciona un empleado'}
                            {step === 'sessions' && `${selectedEmployee?.name} — Selecciona un turno`}
                            {step === 'audit' && `${selectedEmployee?.name} · ${selectedSession?.shiftLabel} · ${selectedSession ? fmtDate(selectedSession.startTime) : ''}`}
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}

                {/* ══════════════════════════════════════════════ */}
                {/* PASO 1 — Selección de empleado                */}
                {/* ══════════════════════════════════════════════ */}
                {step === 'employee' && (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar empleado por nombre…"
                                    className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400"
                                />
                            </div>
                        </div>
                        {loadingStaff ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                            </div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="font-semibold text-sm">Sin resultados</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredEmployees.map(emp => (
                                    <button key={emp.id} onClick={() => handleSelectEmployee(emp)}
                                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 text-sm font-black text-teal-700">
                                                {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{emp.name}</p>
                                                <p className="text-[11px] text-slate-500 font-medium capitalize">{emp.role.toLowerCase()}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════ */}
                {/* PASO 2 — Selección de turno                   */}
                {/* ══════════════════════════════════════════════ */}
                {step === 'sessions' && (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <p className="text-sm text-slate-500 font-medium">Últimos 30 días · {sessions.length} turno(s) encontrados</p>
                        </div>
                        {loadingSessions ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="font-semibold text-sm">Sin turnos registrados en los últimos 30 días</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {sessions.map(sess => {
                                    const meta = SHIFT_LABELS[sess.shiftType] || SHIFT_LABELS.MORNING;
                                    return (
                                        <button key={sess.id} onClick={() => handleSelectSession(sess)}
                                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0 text-xl`}>
                                                    {meta.emoji}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="font-bold text-slate-800 text-sm">{meta.label}</p>
                                                        {sess.isOpen && (
                                                            <span className="text-[9px] font-black bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full uppercase">Abierto</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                        {fmtDate(sess.startTime)} · {fmtTime(sess.startTime)}
                                                        {sess.endTime && ` → ${fmtTime(sess.endTime)}`}
                                                        {sess.durationH && ` · ${sess.durationH}h`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {sess.handoverCompleted
                                                    ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">Handover ✓</span>
                                                    : sess.isOpen
                                                        ? null
                                                        : <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">Sin handover</span>
                                                }
                                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════ */}
                {/* PASO 3 — Auditoría completa                   */}
                {/* ══════════════════════════════════════════════ */}
                {step === 'audit' && (
                    <>
                        {loadingAudit ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium text-sm">Compilando auditoría del turno…</p>
                                </div>
                            </div>
                        ) : audit ? (
                            <div className="space-y-5">

                                {/* ── Header del turno ── */}
                                <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 text-white shadow-xl print:bg-white print:text-slate-900 print:border print:border-slate-300 print:shadow-none">
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div>
                                            <p className="text-teal-400 text-[10px] font-black uppercase tracking-widest mb-1 print:text-teal-600">
                                                {SHIFT_LABELS[audit.shiftType]?.emoji} {SHIFT_LABELS[audit.shiftType]?.label || audit.shiftType}
                                                {audit.isOpen && <span className="ml-2 bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">En curso</span>}
                                            </p>
                                            <h2 className="text-2xl font-black">{audit.caregiverName}</h2>
                                            <p className="text-slate-400 text-sm font-medium mt-1 print:text-slate-600">
                                                {fmtDate(audit.shiftStart)} · {fmtTime(audit.shiftStart)}
                                                {audit.shiftEnd ? ` → ${fmtTime(audit.shiftEnd)}` : ' → (turno abierto)'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {audit.colorGroups.map(c => (
                                                    <span key={c} className="flex items-center gap-1.5 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full print:border print:border-slate-300 print:bg-white print:text-slate-700">
                                                        <span className={`w-2 h-2 rounded-full ${COLOR_DOT[c] || 'bg-slate-400'}`} />
                                                        Grupo {COLOR_LABEL[c] || c}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={handlePrint}
                                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-2xl text-sm font-bold transition-colors print:hidden">
                                            <Printer className="w-4 h-4" /> Imprimir
                                        </button>
                                    </div>
                                </div>

                                {/* ── Resumen KPIs ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Residentes', value: audit.totalResidents, icon: '👥', bg: 'bg-slate-50', border: 'border-slate-200' },
                                        { label: 'Brechas', value: audit.summary.totalGaps,
                                          icon: audit.summary.totalGaps === 0 ? '✅' : audit.summary.totalCritical > 0 ? '🔴' : '🟡',
                                          bg: audit.summary.totalCritical > 0 ? 'bg-red-50' : audit.summary.totalGaps > 0 ? 'bg-amber-50' : 'bg-emerald-50',
                                          border: audit.summary.totalCritical > 0 ? 'border-red-200' : audit.summary.totalGaps > 0 ? 'border-amber-200' : 'border-emerald-200' },
                                        { label: 'Sin actividad', value: audit.summary.patientsNoActivity,
                                          icon: audit.summary.patientsNoActivity > 0 ? '⚠️' : '✅',
                                          bg: audit.summary.patientsNoActivity > 0 ? 'bg-red-50' : 'bg-emerald-50',
                                          border: audit.summary.patientsNoActivity > 0 ? 'border-red-200' : 'border-emerald-200' },
                                        { label: 'Meds omitidos', value: audit.summary.totalMedsOmit,
                                          icon: audit.summary.totalMedsOmit > 0 ? '⚠️' : '✅',
                                          bg: audit.summary.totalMedsOmit > 0 ? 'bg-red-50' : 'bg-emerald-50',
                                          border: audit.summary.totalMedsOmit > 0 ? 'border-red-200' : 'border-emerald-200' },
                                    ].map((kpi, i) => (
                                        <div key={i} className={`${kpi.bg} border ${kpi.border} rounded-[1.5rem] p-4 flex flex-col items-center text-center`}>
                                            <span className="text-2xl mb-1">{kpi.icon}</span>
                                            <p className="text-2xl font-black text-slate-800">{kpi.value}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Detalle de actividad ── */}
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[11px] font-bold">
                                    {[
                                        { label: 'Baños',    value: audit.summary.totalBaths,    icon: '🛁' },
                                        { label: 'Comidas',  value: audit.summary.totalMeals,    icon: '🍽️' },
                                        { label: 'Meds ✓',  value: audit.summary.totalMedsOk,   icon: '💊' },
                                        { label: 'Vitales',  value: audit.summary.totalVitals,   icon: '📊' },
                                        { label: 'Rotac.',   value: audit.summary.totalRotations,icon: '🔄' },
                                        { label: 'Pañales',  value: audit.summary.totalDiapers,  icon: '🩺' },
                                    ].map((item, i) => (
                                        <div key={i} className="bg-white border border-slate-200 rounded-[1.25rem] py-3 px-2">
                                            <div className="text-lg">{item.icon}</div>
                                            <div className="text-slate-800 font-black">{item.value}</div>
                                            <div className="text-slate-500">{item.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Estado del Handover ── */}
                                {audit.handover ? (
                                    <div className={`rounded-2xl border px-5 py-4 flex items-start gap-4 ${audit.handover.completed && audit.handover.supervisorSignedAt ? 'bg-emerald-50 border-emerald-200' : audit.handover.completed ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="text-2xl">{audit.handover.completed && audit.handover.supervisorSignedAt ? '✅' : audit.handover.completed ? '🟡' : '🔴'}</div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">
                                                {audit.handover.completed && audit.handover.supervisorSignedAt
                                                    ? 'Handover completado y firmado por supervisor'
                                                    : audit.handover.completed
                                                        ? 'Handover completado — pendiente firma supervisor'
                                                        : 'Handover NO completado'}
                                            </p>
                                            <div className="text-xs text-slate-600 font-medium mt-1 space-y-0.5">
                                                {audit.handover.completedAt && <p>Cerró turno: {fmtTime(audit.handover.completedAt)}</p>}
                                                {audit.handover.incomingName && <p>Entrante: {audit.handover.incomingName}</p>}
                                                {audit.handover.supervisorName && <p>Firmado por: {audit.handover.supervisorName}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-100 border border-slate-300 rounded-2xl px-5 py-4 text-sm text-slate-600 font-medium">
                                        Sin handover registrado para este turno
                                    </div>
                                )}

                                {/* ── Por residente ── */}
                                <div>
                                    <h3 className="font-black text-slate-700 text-xs uppercase tracking-widest mb-3">
                                        Detalle por residente ({audit.patients.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {audit.patients.map(p => <PatientCard key={p.id} p={p} />)}
                                    </div>
                                </div>

                                {/* ── Sección de firma física (solo print) ── */}
                                <div className="hidden print:block mt-8 pt-6 border-t-2 border-slate-300">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Certificación de Auditoría</p>
                                    <div className="grid grid-cols-3 gap-8">
                                        {['Cuidador(a)', 'Supervisor(a)', 'Director(a)'].map(role => (
                                            <div key={role}>
                                                <div className="border-b-2 border-slate-400 pb-8 mb-2"></div>
                                                <p className="text-[10px] font-bold text-slate-500 text-center">{role}</p>
                                                <p className="text-[10px] text-slate-400 text-center mt-0.5">Firma · Nombre · Fecha</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-400 text-center mt-4">
                                        Zéndity Healthcare Management Platform · Documento confidencial de uso interno · {new Date().toLocaleDateString('es-PR')}
                                    </p>
                                </div>

                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
