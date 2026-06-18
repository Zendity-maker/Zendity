"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    MessageCircle, Calendar, Users, Send, Loader2, RefreshCw, Inbox, ArrowRight, Plus,
} from "lucide-react";
import NewContactLogModal from "@/components/family-contact-logs/NewContactLogModal";

/**
 * /coordinator — Home del hub "Comunicación Familiar".
 *
 * Sprint Coordinador Paso 4 (jun-2026): el shell viejo de 3 KPIs simples
 * se reemplaza por el Cumplimiento Board (motor del paso 4). Los accesos
 * rápidos (mensajes, citas, broadcast, referir) se preservan abajo.
 *
 * Phase 1 (este commit): KPI strip + barra de avance + tabla de familias
 * con semáforo (vencida/pendiente/contactada).
 * Phase 2 (futura): panel "Zendy sugiere" con priorización (citas próximas
 * + quejas abiertas + días sin contacto).
 */

const HUB_ROLES = ['COORDINATOR', 'ADMIN', 'DIRECTOR', 'NURSE'];

const STATUS_LABEL: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' }> = {
    contactada: { label: 'Contactada', tone: 'good' },
    pendiente:  { label: 'Pendiente',  tone: 'warn' },
    vencida:    { label: 'Vencida',    tone: 'bad'  },
};

const OUTCOME_LABEL: Record<string, string> = {
    VOICEMAIL:    'buzón',
    NO_ANSWER:    'no contestó',
    WRONG_NUMBER: 'número equivocado',
};

interface BoardPatient {
    patientId:          string;
    name:               string;
    roomNumber:         string | null;
    status:             'contactada' | 'pendiente' | 'vencida';
    lastSpokeAt:        string | null;
    daysSinceSpoke:     number | null;
    attemptsThisMonth:  number;
    lastAttemptOutcome: string | null;
}

interface BoardKPI {
    total:                  number;
    contactadas:            number;
    pendientes:             number;
    vencidas:               number;
    daysElapsed:            number;
    daysInMonth:            number;
    vencidaThresholdDays:   number;
}

function formatShortDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-PR', { day: '2-digit', month: 'short' });
}

function monthName(): string {
    return new Date().toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });
}

export default function CoordinatorDashboardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [boardLoading, setBoardLoading]         = useState(true);
    const [kpi, setKpi]                           = useState<BoardKPI | null>(null);
    const [patients, setPatients]                 = useState<BoardPatient[]>([]);

    const [shortcutLoading, setShortcutLoading]   = useState(true);
    const [unreadConversations, setUnread]        = useState(0);
    const [totalConversations, setTotalConvs]     = useState(0);
    const [pendingAppointments, setPendingAppts]  = useState(0);

    const [modalOpen, setModalOpen]               = useState(false);
    const [modalPatient, setModalPatient]         = useState<string | undefined>(undefined);

    const allowed = user && (
        HUB_ROLES.includes(user.role || '') ||
        ((user as any).secondaryRoles ?? []).some((r: string) => HUB_ROLES.includes(r))
    );

    const fetchBoard = async () => {
        setBoardLoading(true);
        try {
            const res = await fetch('/api/coordinator/compliance-board');
            if (res.ok) {
                const j = await res.json();
                if (j.success) {
                    setKpi(j.kpi);
                    setPatients(j.patients);
                }
            }
        } catch (e) {
            console.error('compliance-board fetch', e);
        } finally {
            setBoardLoading(false);
        }
    };

    const fetchShortcuts = async () => {
        setShortcutLoading(true);
        try {
            const [msgRes, apptRes] = await Promise.all([
                fetch('/api/corporate/family-messages'),
                fetch('/api/corporate/family-appointments?status=PENDING'),
            ]);
            if (msgRes.ok) {
                const j = await msgRes.json();
                const convs = j?.conversations || [];
                setTotalConvs(convs.length);
                setUnread(convs.filter((c: any) => c.unreadCount > 0).length);
            }
            if (apptRes.ok) {
                const j = await apptRes.json();
                setPendingAppts((j?.appointments || []).length);
            }
        } catch (e) {
            console.error('shortcuts fetch', e);
        } finally {
            setShortcutLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && allowed) {
            fetchBoard();
            fetchShortcuts();
        }
        if (!authLoading && !allowed) router.replace('/');
    }, [authLoading, allowed, router]);

    const progressPct = useMemo(() => {
        if (!kpi || kpi.total === 0) return 0;
        return Math.round((kpi.contactadas / kpi.total) * 100);
    }, [kpi]);

    const openRegisterFor = (patientId: string) => {
        setModalPatient(patientId);
        setModalOpen(true);
    };

    if (authLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
    }
    if (!allowed) return null;

    return (
        <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">

            {/* Header */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Cumplimiento de Contacto Familiar</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Una conversación o reunión lograda por residente, cada mes
                        {kpi ? ` · vencida si pasan más de ${kpi.vencidaThresholdDays} días` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                        {monthName().replace(/^./, c => c.toUpperCase())}
                    </div>
                    <button
                        onClick={() => { fetchBoard(); fetchShortcuts(); }}
                        disabled={boardLoading}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-xl transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${boardLoading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Contactadas" tone="good" value={kpi?.contactadas ?? 0} suffix={kpi ? `/ ${kpi.total}` : ''} loading={boardLoading} />
                <KpiCard label="Pendientes" tone="warn" value={kpi?.pendientes ?? 0} loading={boardLoading} />
                <KpiCard label="Vencidas" tone="bad" value={kpi?.vencidas ?? 0} loading={boardLoading} />
                <KpiCard label="Días del mes" tone="neutral" value={kpi?.daysElapsed ?? 0} suffix={kpi ? `/ ${kpi.daysInMonth}` : ''} loading={boardLoading} />
            </div>

            {/* Progress bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex justify-between items-baseline mb-2.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avance del mes</span>
                    <span className="text-sm font-extrabold text-teal-700">
                        {progressPct}%
                        {kpi && kpi.pendientes + kpi.vencidas > 0 && (
                            <span className="text-slate-500 font-normal"> · faltan {kpi.pendientes + kpi.vencidas} familias</span>
                        )}
                    </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-teal-600 rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h2 className="text-sm font-extrabold text-slate-800">Familias del mes</h2>
                    <span className="text-xs text-slate-500">Pendientes primero</span>
                </div>

                {boardLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                    </div>
                ) : patients.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-sm text-slate-500">Sin residentes activos en la sede.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-5 py-2.5">Residente</th>
                                <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-5 py-2.5 hidden sm:table-cell">Último contacto</th>
                                <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-5 py-2.5 hidden sm:table-cell">Días</th>
                                <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-5 py-2.5">Estado</th>
                                <th className="px-5 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.map(p => {
                                const meta = STATUS_LABEL[p.status];
                                return (
                                    <tr key={p.patientId} className="border-b border-slate-50 last:border-b-0">
                                        <td className="px-5 py-3.5">
                                            <Link
                                                href={`/corporate/medical/patients/${p.patientId}?tab=calls`}
                                                className="font-bold text-sm text-slate-800 hover:text-teal-700 transition-colors"
                                            >
                                                {p.name}
                                            </Link>
                                            {p.roomNumber && <p className="text-xs text-slate-400 mt-0.5">Hab. {p.roomNumber}</p>}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-500 hidden sm:table-cell">{formatShortDate(p.lastSpokeAt)}</td>
                                        <td className="px-5 py-3.5 text-sm hidden sm:table-cell">
                                            <DaysCell days={p.daysSinceSpoke} status={p.status} />
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <StatusBadge tone={meta.tone} label={meta.label} />
                                            {p.attemptsThisMonth > 0 && (
                                                <p className="text-[11px] text-slate-500 mt-1.5">
                                                    {p.attemptsThisMonth} {p.attemptsThisMonth === 1 ? 'intento' : 'intentos'} este mes
                                                    {p.lastAttemptOutcome && ` · ${OUTCOME_LABEL[p.lastAttemptOutcome] || p.lastAttemptOutcome}`}
                                                    {' '}<span className="text-slate-400">(no cuenta como conversación)</span>
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            {p.status !== 'contactada' && (
                                                <button
                                                    onClick={() => openRegisterFor(p.patientId)}
                                                    className="text-xs font-bold text-teal-700 border border-slate-200 hover:border-teal-300 hover:bg-teal-50 rounded-lg px-3 py-1.5 transition-colors"
                                                >
                                                    Registrar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Accesos rápidos (preservados del shell anterior) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">Accesos rápidos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <Link
                        href="/corporate/family-messages"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group"
                    >
                        <Inbox className="w-5 h-5 text-teal-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Conversaciones</p>
                            <p className="text-xs text-slate-500">
                                {shortcutLoading ? '…' : `${unreadConversations} sin leer · de ${totalConversations}`}
                            </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                    </Link>
                    <Link
                        href="/corporate/family-appointments"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group"
                    >
                        <Calendar className="w-5 h-5 text-amber-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Citas familiares</p>
                            <p className="text-xs text-slate-500">
                                {shortcutLoading ? '…' : `${pendingAppointments} por aprobar`}
                            </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                    </Link>
                    <Link
                        href="/corporate/family-broadcast"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group"
                    >
                        <Send className="w-5 h-5 text-teal-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Enviar comunicado</p>
                            <p className="text-xs text-slate-500">Broadcast a familias registradas</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                    </Link>
                    <Link
                        href="/coordinator/refer"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group"
                    >
                        <Users className="w-5 h-5 text-teal-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Referir al equipo</p>
                            <p className="text-xs text-slate-500">Ruta a Enfermería, TS o Administración</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                    </Link>
                    <Link
                        href="/coordinator/calls"
                        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group md:col-span-2"
                    >
                        <MessageCircle className="w-5 h-5 text-teal-600" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Bitácora de llamadas</p>
                            <p className="text-xs text-slate-500">Historial completo + directorio interactivo</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                    </Link>
                </div>
            </div>

            {/* Modal de Registrar — patient pre-locked desde el board */}
            <NewContactLogModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreated={() => { fetchBoard(); }}
                lockedPatientId={modalPatient}
            />
        </div>
    );
}

// ─── Subcomponentes ────────────────────────────────────────────────────

function KpiCard({ label, value, suffix, tone, loading }: {
    label:    string;
    value:    number;
    suffix?:  string;
    tone:     'good' | 'warn' | 'bad' | 'neutral';
    loading?: boolean;
}) {
    const toneClass = tone === 'good'
        ? 'text-teal-700'
        : tone === 'warn'
            ? 'text-amber-700'
            : tone === 'bad'
                ? 'text-red-700'
                : 'text-slate-800';
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-extrabold mt-1.5 ${toneClass}`}>
                {loading ? '…' : value}
                {suffix && <span className="text-sm text-slate-400 font-bold ml-1">{suffix}</span>}
            </p>
        </div>
    );
}

function StatusBadge({ tone, label }: { tone: 'good' | 'warn' | 'bad'; label: string }) {
    const cls = tone === 'good'
        ? 'bg-teal-50 text-teal-700 border-teal-100'
        : tone === 'warn'
            ? 'bg-amber-50 text-amber-700 border-amber-100'
            : 'bg-red-50 text-red-700 border-red-100';
    const dotCls = tone === 'good' ? 'bg-teal-600' : tone === 'warn' ? 'bg-amber-500' : 'bg-red-500';
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border ${cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`}></span>
            {label}
        </span>
    );
}

function DaysCell({ days, status }: { days: number | null; status: 'contactada' | 'pendiente' | 'vencida' }) {
    if (days === null) return <span className="text-slate-400">—</span>;
    const cls = status === 'vencida' ? 'text-red-700' : status === 'pendiente' ? 'text-amber-700' : 'text-teal-700';
    return <span className={`font-bold ${cls}`}>{days}</span>;
}
